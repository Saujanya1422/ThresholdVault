"""Security Settings & Institutional Policy Configuration Router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import SecurityPolicy, User, UserRole
from app.models.schemas import SecurityPolicyResponse, SecurityPolicyUpdate
from app.services.auth_service import get_current_user, require_roles
from app.services.audit_service import AuditService

router = APIRouter(prefix="/settings", tags=["Security Settings"])


@router.get("", response_model=SecurityPolicyResponse)
def get_security_policy(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve active institutional security policies."""
    policy = db.query(SecurityPolicy).first()
    if not policy:
        policy = SecurityPolicy(id=1)
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


@router.patch("", response_model=SecurityPolicyResponse)
def update_security_policy(
    update_in: SecurityPolicyUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update institutional threshold policy rules and demo parameters."""
    policy = db.query(SecurityPolicy).first()
    if not policy:
        policy = SecurityPolicy(id=1)
        db.add(policy)

    if update_in.default_threshold is not None:
        policy.default_threshold = update_in.default_threshold
    if update_in.default_total_shares is not None:
        policy.default_total_shares = update_in.default_total_shares

    if policy.default_threshold > policy.default_total_shares:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid policy: default threshold ({policy.default_threshold}) cannot exceed total shares ({policy.default_total_shares})",
        )

    if update_in.require_dual_auth is not None:
        policy.require_dual_auth = update_in.require_dual_auth
    if update_in.require_ticket_id is not None:
        policy.require_ticket_id = update_in.require_ticket_id
    if update_in.session_timeout_minutes is not None:
        policy.session_timeout_minutes = update_in.session_timeout_minutes
    if update_in.rate_limit_per_minute is not None:
        policy.rate_limit_per_minute = update_in.rate_limit_per_minute

    AuditService.log_event(
        db=db,
        event_type="SECURITY_POLICY_UPDATED",
        actor=current_user.email,
        action="UPDATE_POLICY",
        target="SecurityPolicy",
        details=update_in.model_dump(exclude_unset=True),
    )

    db.commit()
    db.refresh(policy)
    return policy
