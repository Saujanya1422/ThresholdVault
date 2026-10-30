"""SQLAlchemy ORM models for ThresholdVault."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SECURITY_OFFICER = "SECURITY_OFFICER"
    CUSTODIAN = "CUSTODIAN"
    AUDITOR = "AUDITOR"


class SecretStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SPLIT = "SPLIT"
    RECOVERED = "RECOVERED"
    ARCHIVED = "ARCHIVED"


class CustodianStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DEACTIVATED = "DEACTIVATED"


class ShareDistributionStatus(str, enum.Enum):
    GENERATED = "GENERATED"
    DISTRIBUTED = "DISTRIBUTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"


class RecoveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    RECOVERABLE = "RECOVERABLE"
    RECOVERED = "RECOVERED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class ApprovalDecision(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class User(Base):
    """Institutional system user account."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CUSTODIAN)
    department = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    custodian_profile = relationship("Custodian", back_populates="user", uselist=False)
    recovery_requests = relationship("RecoveryRequest", back_populates="requester")


class Custodian(Base):
    """Authorized key custodian in the institutional custody ring."""
    __tablename__ = "custodians"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, unique=True)
    full_name = Column(String(255), nullable=False)
    institutional_email = Column(String(255), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False)
    role_title = Column(String(100), nullable=False)
    status = Column(Enum(CustodianStatus), default=CustodianStatus.ACTIVE, nullable=False)
    public_key_fingerprint = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    user = relationship("User", back_populates="custodian_profile")
    shares = relationship("CustodianShare", back_populates="custodian")
    approvals = relationship("RecoveryApproval", back_populates="custodian")


class SecretMetadata(Base):
    """Institutional Secret Metadata registry.
    
    IMPORTANT: Never stores plaintext secrets. Contains only cryptographic
    verification digests (SHA-256) and policy metadata.
    """
    __tablename__ = "secrets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    institution = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False)
    purpose = Column(String(255), nullable=False)  # e.g., "HSM Master Signing Key"
    threshold = Column(Integer, nullable=False)     # k
    total_shares = Column(Integer, nullable=False)  # n
    status = Column(Enum(SecretStatus), default=SecretStatus.ACTIVE, nullable=False)
    verification_hash = Column(String(64), nullable=False)  # SHA-256 digest of original secret
    expiry_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    shares = relationship("CustodianShare", back_populates="secret", cascade="all, delete-orphan")
    recovery_requests = relationship("RecoveryRequest", back_populates="secret", cascade="all, delete-orphan")


class CustodianShare(Base):
    """Custody Share Assignment.
    
    Shares are stored encrypted-at-rest with AES-256-GCM using an isolated
    vault master key. Never stored in plaintext.
    """
    __tablename__ = "custodian_shares"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    secret_id = Column(String(36), ForeignKey("secrets.id"), nullable=False, index=True)
    custodian_id = Column(String(36), ForeignKey("custodians.id"), nullable=False, index=True)
    share_x = Column(Integer, nullable=False)       # 1 <= x <= n
    share_id_token = Column(String(64), nullable=False)
    encrypted_payload = Column(Text, nullable=False)  # AES-256-GCM ciphertext of share payload
    checksum = Column(String(16), nullable=False)     # CRC32 of raw payload for rapid validation
    distribution_status = Column(Enum(ShareDistributionStatus), default=ShareDistributionStatus.GENERATED)
    assigned_at = Column(DateTime, default=utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    # Relationships
    secret = relationship("SecretMetadata", back_populates="shares")
    custodian = relationship("Custodian", back_populates="shares")


class RecoveryRequest(Base):
    """Institutional Secret Recovery Workflow Request."""
    __tablename__ = "recovery_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    secret_id = Column(String(36), ForeignKey("secrets.id"), nullable=False, index=True)
    requested_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    business_justification = Column(Text, nullable=False)
    ticket_id = Column(String(64), nullable=False)  # e.g., "SEC-INC-2026-891"
    required_threshold = Column(Integer, nullable=False)
    status = Column(Enum(RecoveryStatus), default=RecoveryStatus.PENDING, nullable=False)
    failure_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    secret = relationship("SecretMetadata", back_populates="recovery_requests")
    requester = relationship("User", back_populates="recovery_requests")
    approvals = relationship("RecoveryApproval", back_populates="recovery_request", cascade="all, delete-orphan")


class RecoveryApproval(Base):
    """Individual Custodian Approval and Share Contribution."""
    __tablename__ = "recovery_approvals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), ForeignKey("recovery_requests.id"), nullable=False, index=True)
    custodian_id = Column(String(36), ForeignKey("custodians.id"), nullable=False, index=True)
    decision = Column(Enum(ApprovalDecision), nullable=False)
    comment = Column(String(255), nullable=True)
    share_submitted = Column(Boolean, default=False)
    # Submitted share armored token is held ephemerally during recovery processing
    ephemeral_share_token = Column(Text, nullable=True)
    ip_address = Column(String(45), default="127.0.0.1")
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    recovery_request = relationship("RecoveryRequest", back_populates="approvals")
    custodian = relationship("Custodian", back_populates="approvals")


class AuditLog(Base):
    """Tamper-evident hash-chained audit ledger.
    
    Each block hashes its full content together with prev_hash, forming
    an immutable cryptographic chain.
    """
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, default=utcnow, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    actor = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    target = Column(String(255), nullable=False)
    details_json = Column(Text, nullable=False)  # Sanitized JSON details
    prev_hash = Column(String(64), nullable=False)
    record_hash = Column(String(64), nullable=False)


class SecurityPolicy(Base):
    """Configurable Institutional Security Policy."""
    __tablename__ = "security_policies"

    id = Column(Integer, primary_key=True, default=1)
    default_threshold = Column(Integer, default=3)
    default_total_shares = Column(Integer, default=5)
    min_threshold = Column(Integer, default=2)
    max_shares = Column(Integer, default=16)
    require_dual_auth = Column(Boolean, default=True)
    require_ticket_id = Column(Boolean, default=True)
    session_timeout_minutes = Column(Integer, default=60)
    rate_limit_per_minute = Column(Integer, default=120)
    tamper_simulation_flag = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
