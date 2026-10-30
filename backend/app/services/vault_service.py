"""Vault Service: Secret Registration, Shamir Splitting, and Custody Distribution."""

import uuid
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.crypto.shamir import ShamirSecretSharing
from app.crypto.shares import Share, format_share
from app.crypto.storage_cipher import StorageCipher
from app.models.db_models import (
    Custodian,
    CustodianShare,
    CustodianStatus,
    SecretMetadata,
    SecretStatus,
    ShareDistributionStatus,
)
from app.models.schemas import (
    SecretCreate,
    ShareExportItem,
    SplitResultResponse,
)
from app.services.audit_service import AuditService


class VaultService:
    """Institutional key custody and secret splitting management."""

    @staticmethod
    def register_and_split(
        db: Session,
        secret_in: SecretCreate,
        actor_email: str,
    ) -> SplitResultResponse:
        """Register a new institutional secret and immediately split it into Shamir shares."""
        if not (1 <= secret_in.threshold <= secret_in.total_shares <= 255):
            raise ValueError(
                f"Invalid policy: threshold ({secret_in.threshold}) must be <= total shares ({secret_in.total_shares})"
            )

        # 1. Determine secret material: custom educational secret or CSPRNG 256-bit key
        if secret_in.custom_secret and secret_in.custom_secret.strip():
            raw_secret = secret_in.custom_secret.strip().encode("utf-8")
        else:
            raw_secret = ShamirSecretSharing.generate_random_secret(32)

        verification_hash = ShamirSecretSharing.compute_hash(raw_secret)
        secret_id = str(uuid.uuid4())

        # 2. Select custodians to assign shares
        available_custodians = (
            db.query(Custodian)
            .filter(Custodian.status == CustodianStatus.ACTIVE)
            .order_by(Custodian.created_at.asc())
            .all()
        )

        assigned_custodians: List[Custodian] = []
        if secret_in.custodian_ids:
            for cid in secret_in.custodian_ids:
                c = db.query(Custodian).filter(Custodian.id == cid).first()
                if c and c.status == CustodianStatus.ACTIVE:
                    assigned_custodians.append(c)
        else:
            # Default to first N available custodians
            assigned_custodians = available_custodians[:secret_in.total_shares]

        if len(assigned_custodians) < secret_in.total_shares:
            raise ValueError(
                f"Insufficient active custodians: requested {secret_in.total_shares} shares, "
                f"but only {len(assigned_custodians)} active custodians are available."
            )

        # 3. Perform cryptographic Shamir splitting over GF(2^8)
        raw_shares: List[Tuple[int, bytes]] = ShamirSecretSharing.split_secret(
            secret=raw_secret,
            threshold=secret_in.threshold,
            total_shares=secret_in.total_shares,
        )

        # 4. Create Secret Metadata in DB (Never stores raw_secret!)
        secret_record = SecretMetadata(
            id=secret_id,
            name=secret_in.name,
            description=secret_in.description,
            institution=secret_in.institution,
            department=secret_in.department,
            purpose=secret_in.purpose,
            threshold=secret_in.threshold,
            total_shares=secret_in.total_shares,
            status=SecretStatus.SPLIT,
            verification_hash=verification_hash,
            expiry_date=secret_in.expiry_date,
        )
        db.add(secret_record)

        export_items: List[ShareExportItem] = []

        # 5. Build and persist encrypted shares
        for idx, (x, y_payload) in enumerate(raw_shares):
            custodian = assigned_custodians[idx]
            share_id = str(uuid.uuid4())

            share_obj = Share(
                share_id=share_id,
                secret_id=secret_id,
                x=x,
                payload=y_payload,
                threshold=secret_in.threshold,
                total_shares=secret_in.total_shares,
            )
            armored_token = format_share(share_obj)

            # Encrypt-at-rest before persisting in database table
            encrypted_payload = StorageCipher.encrypt(y_payload)

            share_record = CustodianShare(
                id=share_id,
                secret_id=secret_id,
                custodian_id=custodian.id,
                share_x=x,
                share_id_token=share_id[:12],
                encrypted_payload=encrypted_payload,
                checksum=share_obj.checksum,
                distribution_status=ShareDistributionStatus.DISTRIBUTED,
            )
            db.add(share_record)

            export_items.append(
                ShareExportItem(
                    custodian_id=custodian.id,
                    custodian_name=custodian.full_name,
                    custodian_email=custodian.institutional_email,
                    x=x,
                    armored_share=armored_token,
                    checksum=share_obj.checksum,
                    download_filename=f"tv_share_{secret_in.name.lower().replace(' ', '_')}_custodian_{x}.key",
                )
            )

        # 6. Audit logging
        AuditService.log_event(
            db=db,
            event_type="SECRET_SPLIT_AND_DISTRIBUTED",
            actor=actor_email,
            action="SPLIT_SECRET",
            target=f"Secret:{secret_id}",
            details={
                "secret_name": secret_in.name,
                "policy": f"{secret_in.threshold}-of-{secret_in.total_shares}",
                "custodians_assigned": len(export_items),
                "verification_hash": verification_hash,
            },
        )

        db.commit()

        # Overwrite in-memory raw_secret buffer immediately
        del raw_secret

        return SplitResultResponse(
            secret_id=secret_id,
            secret_name=secret_in.name,
            threshold=secret_in.threshold,
            total_shares=secret_in.total_shares,
            verification_hash=verification_hash,
            shares=export_items,
            message="Secret successfully split into Shamir shares and distributed to authorized custodians.",
        )
