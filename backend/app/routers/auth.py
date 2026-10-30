"""Authentication Router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Custodian, User, UserRole
from app.models.schemas import LoginRequest, TokenResponse, UserProfileResponse
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    verify_password,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with institutional email and password."""
    user = db.query(User).filter(User.email == creds.email).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        AuditService.log_event(
            db=db,
            event_type="AUTH_FAILURE",
            actor=creds.email,
            action="LOGIN",
            target="AuthService",
            details={"reason": "Invalid credentials", "attempted_email": creds.email},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid institutional email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended or deactivated",
        )

    token = create_access_token({"sub": user.id, "role": user.role.value, "email": user.email})

    custodian = db.query(Custodian).filter(Custodian.user_id == user.id).first()
    custodian_id = custodian.id if custodian else None

    AuditService.log_event(
        db=db,
        event_type="AUTH_SUCCESS",
        actor=user.email,
        action="LOGIN",
        target=f"User:{user.id}",
        details={"role": user.role.value, "department": user.department},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department=user.department,
        custodian_id=custodian_id,
    )


@router.get("/me", response_model=UserProfileResponse)
def get_current_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get active user session profile."""
    custodian = db.query(Custodian).filter(Custodian.user_id == current_user.id).first()
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        department=current_user.department,
        is_active=current_user.is_active,
        custodian_id=custodian.id if custodian else None,
    )


@router.get("/demo-accounts")
def list_demo_accounts(db: Session = Depends(get_db)):
    """List pre-configured demo institutional identities for easy testing."""
    users = db.query(User).all()
    accounts = []
    for u in users:
        custodian = db.query(Custodian).filter(Custodian.user_id == u.id).first()
        accounts.append({
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "department": u.department,
            "custodian_id": custodian.id if custodian else None,
            "demo_password": "Admin@Vault2026!" if u.role == UserRole.ADMIN else "Custodian@123" if u.role == UserRole.CUSTODIAN else "Officer@Vault2026!" if u.role == UserRole.SECURITY_OFFICER else "Auditor@Vault2026!",
        })
    return accounts


@router.post("/switch-demo/{email}", response_model=TokenResponse)
def quick_switch_demo(email: str, db: Session = Depends(get_db)):
    """Quickly switch active persona during development demonstration."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo account not found")

    token = create_access_token({"sub": user.id, "role": user.role.value, "email": user.email})
    custodian = db.query(Custodian).filter(Custodian.user_id == user.id).first()

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department=user.department,
        custodian_id=custodian.id if custodian else None,
    )
