"""Pydantic schemas for ThresholdVault API requests and responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field

from app.models.db_models import (
    ApprovalDecision,
    CustodianStatus,
    RecoveryStatus,
    SecretStatus,
    ShareDistributionStatus,
    UserRole,
)


# ==================== Auth Schemas ====================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    role: UserRole
    department: str
    custodian_id: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    department: str
    is_active: bool
    custodian_id: Optional[str] = None


# ==================== Custodian Schemas ====================

class CustodianCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    institutional_email: EmailStr
    department: str = Field(..., min_length=2, max_length=100)
    role_title: str = Field(..., min_length=2, max_length=100)
    user_id: Optional[str] = None


class CustodianUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    role_title: Optional[str] = None
    status: Optional[CustodianStatus] = None


class CustodianResponse(BaseModel):
    id: str
    full_name: str
    institutional_email: str
    department: str
    role_title: str
    status: CustodianStatus
    public_key_fingerprint: str
    assigned_shares_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== Secret & Split Schemas ====================

class SecretCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    institution: str = Field(..., min_length=2, max_length=255)
    department: str = Field(..., min_length=2, max_length=100)
    purpose: str = Field(..., min_length=2, max_length=255)
    threshold: int = Field(3, ge=1, le=255)
    total_shares: int = Field(5, ge=1, le=255)
    expiry_date: Optional[datetime] = None
    # If custom_secret is provided (educational mode), it is split; otherwise CSPRNG generates 32 bytes
    custom_secret: Optional[str] = Field(None, description="Educational mode test secret")
    custodian_ids: Optional[List[str]] = Field(None, description="Custodian IDs to assign shares to")


class SecretResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    institution: str
    department: str
    purpose: str
    threshold: int
    total_shares: int
    status: SecretStatus
    verification_hash: str
    expiry_date: Optional[datetime] = None
    shares_distributed: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShareExportItem(BaseModel):
    custodian_id: str
    custodian_name: str
    custodian_email: str
    x: int
    armored_share: str
    checksum: str
    download_filename: str


class SplitResultResponse(BaseModel):
    secret_id: str
    secret_name: str
    threshold: int
    total_shares: int
    verification_hash: str
    shares: List[ShareExportItem]
    message: str


class CustodianShareCard(BaseModel):
    id: str
    secret_id: str
    secret_name: str
    custodian_id: str
    custodian_name: str
    share_x: int
    distribution_status: ShareDistributionStatus
    checksum: str
    assigned_at: datetime
    armored_token: Optional[str] = None  # Populated only for authorized custodian export


# ==================== Recovery Schemas ====================

class RecoveryRequestCreate(BaseModel):
    secret_id: str
    business_justification: str = Field(..., min_length=10, max_length=1000)
    ticket_id: str = Field(..., min_length=3, max_length=64)


class RecoveryApprovalItem(BaseModel):
    id: str
    custodian_id: str
    custodian_name: str
    custodian_email: str
    department: str
    decision: ApprovalDecision
    comment: Optional[str] = None
    share_submitted: bool
    created_at: datetime


class RecoveryRequestResponse(BaseModel):
    id: str
    secret_id: str
    secret_name: str
    secret_purpose: str
    requested_by: str
    requested_by_email: str
    business_justification: str
    ticket_id: str
    required_threshold: int
    total_shares: int
    approvals_count: int
    shares_submitted_count: int
    status: RecoveryStatus
    failure_reason: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    approvals: List[RecoveryApprovalItem] = []


class ApprovalSubmit(BaseModel):
    decision: ApprovalDecision
    comment: Optional[str] = None
    # Share can either be provided directly by custodian or auto-loaded from their encrypted vault profile
    armored_share: Optional[str] = None


class RecoveryExecuteResponse(BaseModel):
    success: bool
    message: str
    request_id: str
    secret_id: str
    verification_hash: str
    shares_used_count: int
    status: RecoveryStatus
    # Ephemeral display for authorized recovery officer only; never persisted in logs or database
    ephemeral_recovered_secret: Optional[str] = None


# ==================== Audit & Tamper Schemas ====================

class AuditLogItem(BaseModel):
    id: str
    timestamp: datetime
    event_type: str
    actor: str
    action: str
    target: str
    details: Dict[str, Any]
    prev_hash: str
    record_hash: str


class AuditVerificationResponse(BaseModel):
    is_valid: bool
    message: str
    total_blocks_checked: int
    tampered_index: Optional[int] = None
    tampered_record_id: Optional[str] = None


# ==================== Policy Settings Schemas ====================

class SecurityPolicyResponse(BaseModel):
    default_threshold: int
    default_total_shares: int
    min_threshold: int
    max_shares: int
    require_dual_auth: bool
    require_ticket_id: bool
    session_timeout_minutes: int
    rate_limit_per_minute: int
    tamper_simulation_flag: bool
    updated_at: datetime


class SecurityPolicyUpdate(BaseModel):
    default_threshold: Optional[int] = Field(None, ge=1, le=255)
    default_total_shares: Optional[int] = Field(None, ge=1, le=255)
    require_dual_auth: Optional[bool] = None
    require_ticket_id: Optional[bool] = None
    session_timeout_minutes: Optional[int] = Field(None, ge=5, le=1440)
    rate_limit_per_minute: Optional[int] = Field(None, ge=10, le=1000)


# ==================== Dashboard Schemas ====================

class PolicyDistributionPoint(BaseModel):
    policy: str
    count: int
    percentage: float


class RecoveryActivityPoint(BaseModel):
    label: str
    pending: int
    recovered: int
    failed: int


class DashboardMetricsResponse(BaseModel):
    total_secrets: int
    active_policies: int
    total_custodians: int
    active_custodians: int
    pending_recovery_requests: int
    successful_recoveries: int
    failed_recoveries: int
    total_audit_events: int
    chain_integrity_status: bool
    policy_distribution: List[PolicyDistributionPoint]
    recovery_activity: List[RecoveryActivityPoint]
    recent_audit_events: List[AuditLogItem]
