"""Institutional Recovery Workflow Service: Multi-Party Quorum and Threshold Reconstruction."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.crypto.shamir import (
    CryptoError,
    DuplicateShareError,
    IncompatibleShareError,
    InsufficientSharesError,
    ShamirSecretSharing,
)
from app.crypto.shares import parse_share
from app.crypto.storage_cipher import StorageCipher
from app.models.db_models import (
    ApprovalDecision,
    Custodian,
    CustodianShare,
    CustodianStatus,
    RecoveryApproval,
    RecoveryRequest,
    RecoveryStatus,
    SecretMetadata,
    SecretStatus,
    User,
    UserRole,
)
from app.models.schemas import (
    ApprovalSubmit,
    RecoveryExecuteResponse,
    RecoveryRequestCreate,
)
from app.services.audit_service import AuditService


class RecoveryService:
    """Manages the lifecycle of secret recovery requests and Shamir reconstruction."""

    @staticmethod
    def create_recovery_request(
        db: Session,
        request_in: RecoveryRequestCreate,
        current_user: User,
    ) -> RecoveryRequest:
        """Submit a new institutional recovery request."""
        # 1. Permission check: Admin or Security Officer can initiate
        if current_user.role not in [UserRole.ADMIN, UserRole.SECURITY_OFFICER]:
            raise PermissionError("Only Security Officers or Administrators can initiate secret recovery requests.")

        # 2. Secret lookup
        secret = db.query(SecretMetadata).filter(SecretMetadata.id == request_in.secret_id).first()
        if not secret:
            raise ValueError(f"Secret with ID '{request_in.secret_id}' not found.")

        # 3. Check for existing pending request
        existing_pending = (
            db.query(RecoveryRequest)
            .filter(
                RecoveryRequest.secret_id == secret.id,
                RecoveryRequest.status.in_([RecoveryStatus.PENDING, RecoveryStatus.RECOVERABLE]),
            )
            .first()
        )
        if existing_pending:
            raise ValueError(
                f"An active recovery request ({existing_pending.ticket_id}) is already pending for this secret."
            )

        # 4. Create request
        req_id = str(uuid.uuid4())
        recovery_req = RecoveryRequest(
            id=req_id,
            secret_id=secret.id,
            requested_by_user_id=current_user.id,
            business_justification=request_in.business_justification,
            ticket_id=request_in.ticket_id,
            required_threshold=secret.threshold,
            status=RecoveryStatus.PENDING,
        )
        db.add(recovery_req)

        # Audit log
        AuditService.log_event(
            db=db,
            event_type="RECOVERY_REQUESTED",
            actor=current_user.email,
            action="INITIATE_RECOVERY",
            target=f"RecoveryRequest:{req_id}",
            details={
                "secret_id": secret.id,
                "secret_name": secret.name,
                "ticket_id": request_in.ticket_id,
                "required_threshold": secret.threshold,
                "business_justification": request_in.business_justification,
            },
        )

        db.commit()
        db.refresh(recovery_req)
        return recovery_req

    @staticmethod
    def submit_custodian_approval(
        db: Session,
        request_id: str,
        custodian_user: User,
        approval_in: ApprovalSubmit,
        client_ip: str = "127.0.0.1",
    ) -> RecoveryApproval:
        """Record an authenticated custodian's approval or rejection and share contribution."""
        # 1. Request lookup
        rec_req = db.query(RecoveryRequest).filter(RecoveryRequest.id == request_id).first()
        if not rec_req:
            raise ValueError("Recovery request not found.")

        if rec_req.status not in [RecoveryStatus.PENDING, RecoveryStatus.RECOVERABLE]:
            raise ValueError(f"Cannot vote on recovery request in '{rec_req.status.value}' state.")

        # 2. Custodian identification
        custodian = (
            db.query(Custodian)
            .filter(
                (Custodian.user_id == custodian_user.id) |
                (Custodian.institutional_email == custodian_user.email)
            )
            .first()
        )
        if not custodian:
            raise PermissionError("Current user is not registered as an institutional key custodian.")

        if custodian.status != CustodianStatus.ACTIVE:
            raise PermissionError("Custodian account is suspended or deactivated; votes cannot be accepted.")

        # 3. Check for duplicate approval
        existing_approval = (
            db.query(RecoveryApproval)
            .filter(
                RecoveryApproval.request_id == rec_req.id,
                RecoveryApproval.custodian_id == custodian.id,
            )
            .first()
        )
        if existing_approval:
            raise ValueError("Duplicate approval detected: this custodian has already submitted a decision.")

        # 4. Resolve share contribution if approving
        share_submitted = False
        share_armored_token = None

        if approval_in.decision == ApprovalDecision.APPROVED:
            # Check if share is explicitly provided, or auto-load from custodian's assigned share vault
            if approval_in.armored_share and approval_in.armored_share.strip():
                # Validate provided share structure
                parsed = parse_share(approval_in.armored_share.strip())
                if parsed.secret_id != rec_req.secret_id:
                    raise IncompatibleShareError("Submitted share does not match the secret requested for recovery.")
                share_armored_token = approval_in.armored_share.strip()
                share_submitted = True
            else:
                # Look up custodian's assigned share for this secret
                cust_share = (
                    db.query(CustodianShare)
                    .filter(
                        CustodianShare.secret_id == rec_req.secret_id,
                        CustodianShare.custodian_id == custodian.id,
                    )
                    .first()
                )
                if cust_share:
                    # Decrypt share payload from encrypted-at-rest storage to construct armored token
                    raw_payload = StorageCipher.decrypt(cust_share.encrypted_payload)
                    from app.crypto.shares import Share, format_share
                    share_obj = Share(
                        share_id=cust_share.id,
                        secret_id=rec_req.secret_id,
                        x=cust_share.share_x,
                        payload=raw_payload,
                        threshold=rec_req.required_threshold,
                        total_shares=rec_req.secret.total_shares,
                    )
                    share_armored_token = format_share(share_obj)
                    share_submitted = True
                else:
                    raise ValueError("No assigned share found for this custodian under the specified secret.")

        # 5. Record approval
        approval_record = RecoveryApproval(
            id=str(uuid.uuid4()),
            request_id=rec_req.id,
            custodian_id=custodian.id,
            decision=approval_in.decision,
            comment=approval_in.comment,
            share_submitted=share_submitted,
            ephemeral_share_token=share_armored_token,
            ip_address=client_ip,
        )
        db.add(approval_record)
        db.flush()

        # 6. Evaluate quorum progress
        valid_approvals = (
            db.query(RecoveryApproval)
            .filter(
                RecoveryApproval.request_id == rec_req.id,
                RecoveryApproval.decision == ApprovalDecision.APPROVED,
                RecoveryApproval.share_submitted == True,
            )
            .count()
        )

        if valid_approvals >= rec_req.required_threshold:
            rec_req.status = RecoveryStatus.RECOVERABLE

        AuditService.log_event(
            db=db,
            event_type="CUSTODIAN_APPROVAL_SUBMITTED",
            actor=custodian.institutional_email,
            action="SUBMIT_APPROVAL",
            target=f"RecoveryRequest:{rec_req.id}",
            details={
                "decision": approval_in.decision.value,
                "share_submitted": share_submitted,
                "current_approved_count": valid_approvals,
                "required_threshold": rec_req.required_threshold,
            },
        )

        db.commit()
        db.refresh(approval_record)
        return approval_record

    @staticmethod
    def execute_recovery(
        db: Session,
        request_id: str,
        executing_user: User,
        reveal_secret: bool = False,
    ) -> RecoveryExecuteResponse:
        """Execute Shamir reconstruction once threshold quorum of valid shares is reached."""
        # 1. Authorization: Admin or Security Officer can execute final recovery
        if executing_user.role not in [UserRole.ADMIN, UserRole.SECURITY_OFFICER]:
            raise PermissionError("Only Security Officers or Administrators can trigger final secret reconstruction.")

        # 2. Request lookup
        rec_req = db.query(RecoveryRequest).filter(RecoveryRequest.id == request_id).first()
        if not rec_req:
            raise ValueError("Recovery request not found.")

        if rec_req.status not in [RecoveryStatus.RECOVERABLE, RecoveryStatus.PENDING]:
            raise ValueError(f"Recovery request cannot be executed in current status '{rec_req.status.value}'.")

        # 3. Collect valid submitted shares
        approvals = (
            db.query(RecoveryApproval)
            .filter(
                RecoveryApproval.request_id == rec_req.id,
                RecoveryApproval.decision == ApprovalDecision.APPROVED,
                RecoveryApproval.share_submitted == True,
                RecoveryApproval.ephemeral_share_token.isnot(None),
            )
            .all()
        )

        if len(approvals) < rec_req.required_threshold:
            rec_req.status = RecoveryStatus.FAILED
            rec_req.failure_reason = (
                f"Insufficient shares: received {len(approvals)}, required {rec_req.required_threshold}"
            )
            db.commit()
            AuditService.log_event(
                db=db,
                event_type="RECOVERY_FAILED_INSUFFICIENT_SHARES",
                actor=executing_user.email,
                action="EXECUTE_RECOVERY",
                target=f"RecoveryRequest:{rec_req.id}",
                details={"shares_received": len(approvals), "threshold": rec_req.required_threshold},
            )
            raise InsufficientSharesError(rec_req.failure_reason)

        # 4. Parse shares
        parsed_shares: List[Tuple[int, bytes]] = []
        for appr in approvals:
            try:
                parsed = parse_share(appr.ephemeral_share_token)
                parsed_shares.append((parsed.x, parsed.payload))
            except Exception as e:
                rec_req.status = RecoveryStatus.FAILED
                rec_req.failure_reason = f"Share validation error: {str(e)}"
                db.commit()
                raise

        # 5. Shamir Lagrange reconstruction
        try:
            reconstructed_bytes = ShamirSecretSharing.reconstruct_secret(
                shares=parsed_shares,
                threshold=rec_req.required_threshold,
            )
        except Exception as e:
            rec_req.status = RecoveryStatus.FAILED
            rec_req.failure_reason = f"Reconstruction failed: {str(e)}"
            db.commit()
            raise

        # 6. Cryptographic Verification against protected SHA-256 hash
        computed_hash = ShamirSecretSharing.compute_hash(reconstructed_bytes)
        expected_hash = rec_req.secret.verification_hash

        if computed_hash.lower() != expected_hash.lower():
            rec_req.status = RecoveryStatus.FAILED
            rec_req.failure_reason = (
                f"Integrity verification failure: computed hash '{computed_hash[:16]}...' "
                f"does not match expected '{expected_hash[:16]}...'"
            )
            db.commit()
            AuditService.log_event(
                db=db,
                event_type="RECOVERY_FAILED_HASH_MISMATCH",
                actor=executing_user.email,
                action="EXECUTE_RECOVERY",
                target=f"RecoveryRequest:{rec_req.id}",
                details={"status": "HASH_MISMATCH_SUSPECTED_CORRUPTION"},
            )
            raise ValueError(rec_req.failure_reason)

        # 7. Success state transition
        rec_req.status = RecoveryStatus.RECOVERED
        rec_req.completed_at = datetime.now(timezone.utc)
        rec_req.secret.status = SecretStatus.RECOVERED

        AuditService.log_event(
            db=db,
            event_type="SECRET_SUCCESSFULLY_RECOVERED",
            actor=executing_user.email,
            action="EXECUTE_RECOVERY",
            target=f"RecoveryRequest:{rec_req.id}",
            details={
                "secret_name": rec_req.secret.name,
                "shares_used": len(parsed_shares),
                "threshold": rec_req.required_threshold,
                "verification_hash": expected_hash,
                "integrity_verified": True,
            },
        )

        db.commit()

        # Format ephemeral recovered secret representation for demo observation
        ephemeral_secret_str = None
        if reveal_secret:
            try:
                ephemeral_secret_str = reconstructed_bytes.decode("utf-8")
            except UnicodeDecodeError:
                ephemeral_secret_str = reconstructed_bytes.hex()

        # Clean up in-memory sensitive buffer
        del reconstructed_bytes

        return RecoveryExecuteResponse(
            success=True,
            message="Secret successfully reconstructed and cryptographically verified against SHA-256 digest.",
            request_id=rec_req.id,
            secret_id=rec_req.secret.id,
            verification_hash=expected_hash,
            shares_used_count=len(parsed_shares),
            status=RecoveryStatus.RECOVERED,
            ephemeral_recovered_secret=ephemeral_secret_str,
        )
