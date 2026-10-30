"""Tests for Authentication and Role-Based Access Control (RBAC)."""

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed_database

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    yield


def test_login_success_and_jwt():
    """Verify login returns valid JWT token and user profile."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "officer@thresholdvault.io", "password": "Officer@Vault2026!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "SECURITY_OFFICER"
    assert data["email"] == "officer@thresholdvault.io"


def test_login_invalid_password():
    """Verify invalid password returns 401 Unauthorized."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "officer@thresholdvault.io", "password": "WrongPassword!"},
    )
    assert resp.status_code == 401
    assert "Invalid institutional email or password" in resp.json()["detail"]


def test_rbac_custodian_cannot_register_secret():
    """Verify Custodian role cannot register secrets (403 Forbidden)."""
    # 1. Login as custodian
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "custodian1@thresholdvault.io", "password": "Custodian@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Attempt secret registration
    reg_resp = client.post(
        "/api/v1/secrets/register-and-split",
        headers=headers,
        json={
            "name": "Unauthorized Test Secret",
            "institution": "Test Bank",
            "department": "Unauthorized",
            "purpose": "Test",
            "threshold": 2,
            "total_shares": 3,
        },
    )
    assert reg_resp.status_code == 403
    assert "Access denied" in reg_resp.json()["detail"]


def test_rbac_auditor_cannot_initiate_recovery():
    """Verify Auditor role cannot initiate secret recovery requests."""
    # 1. Login as auditor
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@thresholdvault.io", "password": "Auditor@Vault2026!"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Attempt recovery initiation
    rec_resp = client.post(
        "/api/v1/recovery/requests",
        headers=headers,
        json={
            "secret_id": "dummy-id",
            "business_justification": "Auditor testing unauthorized action",
            "ticket_id": "AUD-TEST-999",
        },
    )
    assert rec_resp.status_code == 403


def test_unauthenticated_request_rejected():
    """Verify request without token returns 401."""
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401
