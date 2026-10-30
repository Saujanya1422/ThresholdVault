"""Secret Vault and Shamir Splitting Router."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crypto.shares import Share, format_share
from app.crypto.storage_cipher import StorageCipher
from app.database import get_db
from app.models.db_models import (
    Custodian,
    CustodianShare,
    SecretMetadata,
    User,
    UserRole,
)
from app.models.schemas import (
    CustodianShareCard,
    SecretCreate,
    SecretResponse,
    SplitResultResponse,
)
from app.services.auth_service import get_current_user, require_roles
from app.services.vault_service import VaultService

router = APIRouter(prefix="/secrets", tags=["Secret Vault"])


@router.post("/register-and-split", response_model=SplitResultResponse)
def register_and_split_secret(
    secret_in: SecretCreate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SECURITY_OFFICER])),
    db: Session = Depends(get_db),
):
    """Register a new institutional cryptographic secret and split it into Shamir shares."""
    try:
        return VaultService.register_and_split(db=db, secret_in=secret_in, actor_email=current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Vault operation failed: {str(e)}")


@router.get("", response_model=List[SecretResponse])
def list_secrets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List registered secret metadata. Does NOT expose any secret values."""
    secrets = db.query(SecretMetadata).order_by(SecretMetadata.created_at.desc()).all()
    results = []
    for s in secrets:
        distributed_count = db.query(CustodianShare).filter(CustodianShare.secret_id == s.id).count()
        results.append(
            SecretResponse(
                id=s.id,
                name=s.name,
                description=s.description,
                institution=s.institution,
                department=s.department,
                purpose=s.purpose,
                threshold=s.threshold,
                total_shares=s.total_shares,
                status=s.status,
                verification_hash=s.verification_hash,
                expiry_date=s.expiry_date,
                shares_distributed=distributed_count,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
        )
    return results


@router.get("/{secret_id}", response_model=SecretResponse)
def get_secret(
    secret_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve metadata for a specific secret."""
    s = db.query(SecretMetadata).filter(SecretMetadata.id == secret_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Secret not found")
    distributed_count = db.query(CustodianShare).filter(CustodianShare.secret_id == s.id).count()
    return SecretResponse(
        id=s.id,
        name=s.name,
        description=s.description,
        institution=s.institution,
        department=s.department,
        purpose=s.purpose,
        threshold=s.threshold,
        total_shares=s.total_shares,
        status=s.status,
        verification_hash=s.verification_hash,
        expiry_date=s.expiry_date,
        shares_distributed=distributed_count,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.get("/{secret_id}/custodian-shares", response_model=List[CustodianShareCard])
def get_secret_custodian_shares(
    secret_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve custody distribution metadata.
    
    SECURITY RULE: Plaintext shares are never returned en masse.
    Only the individual logged-in custodian can decrypt their own single share token.
    """
    secret = db.query(SecretMetadata).filter(SecretMetadata.id == secret_id).first()
    if not secret:
        raise HTTPException(status_code=404, detail="Secret not found")

    shares = db.query(CustodianShare).filter(CustodianShare.secret_id == secret_id).all()
    cards = []

    # Check if current user is an active custodian
    current_custodian = db.query(Custodian).filter(Custodian.user_id == current_user.id).first()

    for sh in shares:
        cust = db.query(Custodian).filter(Custodian.id == sh.custodian_id).first()
        cust_name = cust.full_name if cust else "Unknown Custodian"

        armored_token = None
        # Only decrypt if the authenticated user is THIS custodian or explicitly an admin in demo export
        if current_custodian and current_custodian.id == sh.custodian_id:
            raw_payload = StorageCipher.decrypt(sh.encrypted_payload)
            share_obj = Share(
                share_id=sh.id,
                secret_id=secret.id,
                x=sh.share_x,
                payload=raw_payload,
                threshold=secret.threshold,
                total_shares=secret.total_shares,
            )
            armored_token = format_share(share_obj)

        cards.append(
            CustodianShareCard(
                id=sh.id,
                secret_id=secret.id,
                secret_name=secret.name,
                custodian_id=sh.custodian_id,
                custodian_name=cust_name,
                share_x=sh.share_x,
                distribution_status=sh.distribution_status,
                checksum=sh.checksum,
                assigned_at=sh.assigned_at,
                armored_token=armored_token,
            )
        )
    return cards
