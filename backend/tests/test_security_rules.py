"""Tests to prevent cryptographic leakage in logs, database columns, and API responses."""

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models.db_models import CustodianShare, SecretMetadata
from app.seed import seed_database

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    yield


def test_no_secret_leakage_in_metadata_api():
    """Verify secrets listing API returns metadata only, never plaintext secrets."""
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "officer@thresholdvault.io", "password": "Officer@Vault2026!"},
    )
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get("/api/v1/secrets", headers=headers)
    assert resp.status_code == 200
    secrets_list = resp.json()
    assert len(secrets_list) > 0

    for s in secrets_list:
        assert "secret" not in s
        assert "plain_secret" not in s
        assert "raw_secret" not in s
        assert "verification_hash" in s
        # verification hash must be 64-char hex (SHA-256)
        assert len(s["verification_hash"]) == 64


def test_shares_encrypted_at_rest_in_database():
    """Verify that stored shares in SQLite are AES-256-GCM ciphertexts, not plaintext tokens."""
    db = SessionLocal()
    try:
        shares = db.query(CustodianShare).all()
        assert len(shares) > 0
        for sh in shares:
            # Stored payload must be base64 encrypted string, not beginning with TVSHR or raw bytes
            assert not sh.encrypted_payload.startswith("TVSHR:")
            assert len(sh.encrypted_payload) > 28
    finally:
        db.close()


def test_no_credential_or_key_leakage_in_audit_logs():
    """Verify that audit log details do not contain sensitive tokens or passwords."""
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@thresholdvault.io", "password": "Auditor@Vault2026!"},
    )
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get("/api/v1/audit?limit=100", headers=headers)
    assert resp.status_code == 200
    logs = resp.json()
    for l in logs:
        details_str = str(l["details"]).lower()
        assert "password" not in details_str or "[redacted" in details_str
        assert "tvshr:" not in details_str
