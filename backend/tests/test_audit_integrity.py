"""Tests for Tamper-Evident Hash-Chained Audit Ledger."""

import pytest
from app.database import Base, SessionLocal, engine
from app.models.db_models import AuditLog
from app.seed import seed_database
from app.services.audit_service import AuditService


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    yield


def test_audit_chain_initial_integrity():
    """Verify seeded audit ledger has an intact cryptographic hash chain."""
    db = SessionLocal()
    try:
        is_valid, msg, count, bad_idx, _ = AuditService.verify_integrity(db)
        assert is_valid is True
        assert count > 0
        assert bad_idx is None
        assert "intact" in msg.lower()
    finally:
        db.close()


def test_tamper_detection_in_hash_chain():
    """Verify that tampering with an audit record is immediately detected by the verification engine."""
    db = SessionLocal()
    try:
        # Verify clean state first
        is_valid_before, _, _, _, _ = AuditService.verify_integrity(db)
        assert is_valid_before is True

        # Tamper with an existing record
        tampered_entry = AuditService.simulate_tamper(db)
        assert tampered_entry is not None

        # Verification must now fail
        is_valid_after, error_msg, count, bad_idx, bad_id = AuditService.verify_integrity(db)
        assert is_valid_after is False
        assert bad_idx is not None
        assert bad_id == tampered_entry.id
        assert "integrity violation" in error_msg.lower() or "broken" in error_msg.lower()

        # Repair chain
        repaired_count = AuditService.repair_chain(db)
        assert repaired_count > 0

        # Verification must succeed again
        is_valid_repaired, _, _, _, _ = AuditService.verify_integrity(db)
        assert is_valid_repaired is True
    finally:
        db.close()
