"""Recovery Request Workflow Router."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import (
    Custodian,
    RecoveryApproval,
    RecoveryRequest,
    RecoveryStatus,
    SecretMetadata,
    User,
    UserRole,
)
from app.models.schemas import (
    ApprovalSubmit,
    RecoveryApprovalItem,
    RecoveryExecuteResponse,
    RecoveryRequestCreate,
    RecoveryRequestResponse,
)
from app.services.auth_service import get_current_user, require_roles
from app.services.recovery_service import RecoveryService

router = APIRouter(prefix="/recovery", tags=["Recovery Workflow"])


@router.post("/requests", response_model=RecoveryRequestResponse)
def create_recovery_request(
    request_in: RecoveryRequestCreate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SECURITY_OFFICER])),
    db: Session = Depends(get_db),
):
    """Initiate a secret recovery request with business justification."""
    try:
        req = RecoveryService.create_recovery_request(
            db=db,
            request_in=request_in,
            current_user=current_user,
        )
        return _format_request_response(db, req)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/requests", response_model=List[RecoveryRequestResponse])
def list_recovery_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all secret recovery requests with current quorum progress."""
    requests = db.query(RecoveryRequest).order_by(RecoveryRequest.created_at.desc()).all()
    return [_format_request_response(db, r) for r in requests]


@router.get("/requests/{request_id}", response_model=RecoveryRequestResponse)
def get_recovery_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details and custodian approval status for a specific recovery request."""
    req = db.query(RecoveryRequest).filter(RecoveryRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Recovery request not found")
    return _format_request_response(db, req)


@router.post("/requests/{request_id}/approve")
def submit_custodian_vote(
    request_id: str,
    approval_in: ApprovalSubmit,
    req_context: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated custodian submits approval or rejection along with their cryptographic share."""
    client_ip = req_context.client.host if req_context.client else "127.0.0.1"
    try:
        approval = RecoveryService.submit_custodian_approval(
            db=db,
            request_id=request_id,
            custodian_user=current_user,
            approval_in=approval_in,
            client_ip=client_ip,
        )
        return {
            "success": True,
            "approval_id": approval.id,
            "decision": approval.decision.value,
            "share_submitted": approval.share_submitted,
            "message": "Custodian vote and cryptographic share contribution recorded successfully.",
        }
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/requests/{request_id}/execute", response_model=RecoveryExecuteResponse)
def execute_secret_reconstruction(
    request_id: str,
    reveal_secret: bool = Query(False, description="Authorized one-time ephemeral reveal in recovery console"),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SECURITY_OFFICER])),
    db: Session = Depends(get_db),
):
    """Execute Shamir Lagrange reconstruction once threshold approvals and shares are collected."""
    try:
        return RecoveryService.execute_recovery(
            db=db,
            request_id=request_id,
            executing_user=current_user,
            reveal_secret=reveal_secret,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


def _format_request_response(db: Session, req: RecoveryRequest) -> RecoveryRequestResponse:
    secret = db.query(SecretMetadata).filter(SecretMetadata.id == req.secret_id).first()
    requester = db.query(User).filter(User.id == req.requested_by_user_id).first()

    approvals = db.query(RecoveryApproval).filter(RecoveryApproval.request_id == req.id).all()
    approval_items = []
    shares_count = 0
    approved_count = 0

    for a in approvals:
        cust = db.query(Custodian).filter(Custodian.id == a.custodian_id).first()
        if a.decision.value == "APPROVED":
            approved_count += 1
        if a.share_submitted:
            shares_count += 1

        approval_items.append(
            RecoveryApprovalItem(
                id=a.id,
                custodian_id=a.custodian_id,
                custodian_name=cust.full_name if cust else "Unknown",
                custodian_email=cust.institutional_email if cust else "Unknown",
                department=cust.department if cust else "Unknown",
                decision=a.decision,
                comment=a.comment,
                share_submitted=a.share_submitted,
                created_at=a.created_at,
            )
        )

    return RecoveryRequestResponse(
        id=req.id,
        secret_id=req.secret_id,
        secret_name=secret.name if secret else "Unknown",
        secret_purpose=secret.purpose if secret else "Unknown",
        requested_by=requester.full_name if requester else "Unknown",
        requested_by_email=requester.email if requester else "Unknown",
        business_justification=req.business_justification,
        ticket_id=req.ticket_id,
        required_threshold=req.required_threshold,
        total_shares=secret.total_shares if secret else req.required_threshold,
        approvals_count=approved_count,
        shares_submitted_count=shares_count,
        status=req.status,
        failure_reason=req.failure_reason,
        created_at=req.created_at,
        completed_at=req.completed_at,
        approvals=approval_items,
    )
