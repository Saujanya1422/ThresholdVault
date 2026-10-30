"""Custodian Management Router."""

import hashlib
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import (
    Custodian,
    CustodianShare,
    CustodianStatus,
    User,
    UserRole,
)
from app.models.schemas import (
    CustodianCreate,
    CustodianResponse,
    CustodianUpdate,
)
from app.services.auth_service import get_current_user, require_roles
from app.services.audit_service import AuditService

router = APIRouter(prefix="/custodians", tags=["Custodians"])


@router.get("", response_model=List[CustodianResponse])
def list_custodians(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all registered institutional custodians with assigned share metrics."""
    custodians = db.query(Custodian).order_by(Custodian.created_at.asc()).all()
    results = []
    for c in custodians:
        assigned_count = db.query(CustodianShare).filter(CustodianShare.custodian_id == c.id).count()
        results.append(
            CustodianResponse(
                id=c.id,
                full_name=c.full_name,
                institutional_email=c.institutional_email,
                department=c.department,
                role_title=c.role_title,
                status=c.status,
                public_key_fingerprint=c.public_key_fingerprint,
                assigned_shares_count=assigned_count,
                created_at=c.created_at,
            )
        )
    return results


@router.get("/{custodian_id}", response_model=CustodianResponse)
def get_custodian(
    custodian_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific custodian."""
    c = db.query(Custodian).filter(Custodian.id == custodian_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Custodian not found")
    assigned_count = db.query(CustodianShare).filter(CustodianShare.custodian_id == c.id).count()
    return CustodianResponse(
        id=c.id,
        full_name=c.full_name,
        institutional_email=c.institutional_email,
        department=c.department,
        role_title=c.role_title,
        status=c.status,
        public_key_fingerprint=c.public_key_fingerprint,
        assigned_shares_count=assigned_count,
        created_at=c.created_at,
    )


@router.post("", response_model=CustodianResponse)
def create_custodian(
    cust_in: CustodianCreate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SECURITY_OFFICER])),
    db: Session = Depends(get_db),
):
    """Register a new institutional custodian."""
    existing = db.query(Custodian).filter(Custodian.institutional_email == cust_in.institutional_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A custodian with this email already exists")

    cid = str(uuid.uuid4())
    # Generate deterministic public key fingerprint for demo
    fp = hashlib.sha256(f"CUSTODIAN_PUBKEY_{cust_in.institutional_email}".encode()).hexdigest()[:24].upper()
    formatted_fp = ":".join(fp[i:i+2] for i in range(0, len(fp), 2))

    new_cust = Custodian(
        id=cid,
        user_id=cust_in.user_id,
        full_name=cust_in.full_name,
        institutional_email=cust_in.institutional_email,
        department=cust_in.department,
        role_title=cust_in.role_title,
        status=CustodianStatus.ACTIVE,
        public_key_fingerprint=f"ED25519:{formatted_fp}",
    )
    db.add(new_cust)

    AuditService.log_event(
        db=db,
        event_type="CUSTODIAN_REGISTERED",
        actor=current_user.email,
        action="CREATE_CUSTODIAN",
        target=f"Custodian:{cid}",
        details={
            "name": cust_in.full_name,
            "email": cust_in.institutional_email,
            "department": cust_in.department,
        },
    )

    db.commit()
    db.refresh(new_cust)

    return CustodianResponse(
        id=new_cust.id,
        full_name=new_cust.full_name,
        institutional_email=new_cust.institutional_email,
        department=new_cust.department,
        role_title=new_cust.role_title,
        status=new_cust.status,
        public_key_fingerprint=new_cust.public_key_fingerprint,
        assigned_shares_count=0,
        created_at=new_cust.created_at,
    )


@router.patch("/{custodian_id}", response_model=CustodianResponse)
def update_custodian(
    custodian_id: str,
    cust_update: CustodianUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SECURITY_OFFICER])),
    db: Session = Depends(get_db),
):
    """Update custodian profile or toggle status (Active, Suspended, Deactivated)."""
    c = db.query(Custodian).filter(Custodian.id == custodian_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Custodian not found")

    if cust_update.full_name is not None:
        c.full_name = cust_update.full_name
    if cust_update.department is not None:
        c.department = cust_update.department
    if cust_update.role_title is not None:
        c.role_title = cust_update.role_title
    if cust_update.status is not None:
        c.status = cust_update.status

    AuditService.log_event(
        db=db,
        event_type="CUSTODIAN_UPDATED",
        actor=current_user.email,
        action="UPDATE_CUSTODIAN",
        target=f"Custodian:{c.id}",
        details={"status": c.status.value, "updated_fields": list(cust_update.model_dump(exclude_unset=True).keys())},
    )

    db.commit()
    db.refresh(c)
    assigned_count = db.query(CustodianShare).filter(CustodianShare.custodian_id == c.id).count()

    return CustodianResponse(
        id=c.id,
        full_name=c.full_name,
        institutional_email=c.institutional_email,
        department=c.department,
        role_title=c.role_title,
        status=c.status,
        public_key_fingerprint=c.public_key_fingerprint,
        assigned_shares_count=assigned_count,
        created_at=c.created_at,
    )
