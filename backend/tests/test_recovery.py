"""Tests for Recovery Request Workflow and Threshold Execution."""

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


def test_full_recovery_lifecycle():
    """Verify end-to-end recovery: request -> multi-custodian quorum -> reconstruction -> verification."""
    # 1. Login as Security Officer
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "officer@thresholdvault.io", "password": "Officer@Vault2026!"},
    )
    officer_token = login_resp.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # 2. Register fresh secret with 3-of-5 policy
    reg_resp = client.post(
        "/api/v1/secrets/register-and-split",
        headers=officer_headers,
        json={
            "name": "Integration Test Root Secret",
            "institution": "Test Institutional Bank",
            "department": "Security Architecture",
            "purpose": "Integration Testing",
            "threshold": 3,
            "total_shares": 5,
            "custom_secret": "INTEGRATION_TEST_SECRET_VALUE_2026",
        },
    )
    assert reg_resp.status_code == 200
    split_data = reg_resp.json()
    secret_id = split_data["secret_id"]
    verification_hash = split_data["verification_hash"]

    # 3. Security Officer creates recovery request
    req_resp = client.post(
        "/api/v1/recovery/requests",
        headers=officer_headers,
        json={
            "secret_id": secret_id,
            "business_justification": "Automated integration recovery quorum test",
            "ticket_id": "TEST-REC-E2E-001",
        },
    )
    assert req_resp.status_code == 200
    req_data = req_resp.json()
    request_id = req_data["id"]
    assert req_data["status"] == "PENDING"
    assert req_data["required_threshold"] == 3

    # 4. Custodian 1 Approves
    c1_login = client.post(
        "/api/v1/auth/login",
        json={"email": "custodian1@thresholdvault.io", "password": "Custodian@123"},
    )
    c1_headers = {"Authorization": f"Bearer {c1_login.json()['access_token']}"}

    appr1 = client.post(
        f"/api/v1/recovery/requests/{request_id}/approve",
        headers=c1_headers,
        json={"decision": "APPROVED", "comment": "Approved by C1"},
    )
    assert appr1.status_code == 200
    assert appr1.json()["share_submitted"] is True

    # Check status still PENDING (1 / 3)
    check1 = client.get(f"/api/v1/recovery/requests/{request_id}", headers=officer_headers)
    assert check1.json()["status"] == "PENDING"
    assert check1.json()["approvals_count"] == 1

    # 5. Custodian 1 attempts DUPLICATE approval -> must be rejected
    dup_appr = client.post(
        f"/api/v1/recovery/requests/{request_id}/approve",
        headers=c1_headers,
        json={"decision": "APPROVED", "comment": "Duplicate attempt"},
    )
    assert dup_appr.status_code == 400
    assert "Duplicate approval detected" in dup_appr.json()["detail"]

    # 6. Attempt execution with insufficient shares -> must fail
    premature_exec = client.post(
        f"/api/v1/recovery/requests/{request_id}/execute",
        headers=officer_headers,
    )
    assert premature_exec.status_code in [400, 500]

    # Re-fetch request (it was marked FAILED due to insufficient shares)
    # Let's create another request to complete 3-of-5
    req_resp2 = client.post(
        "/api/v1/recovery/requests",
        headers=officer_headers,
        json={
            "secret_id": secret_id,
            "business_justification": "Quorum test round 2",
            "ticket_id": "TEST-REC-E2E-002",
        },
    )
    req_id2 = req_resp2.json()["id"]

    # Custodians 1, 2, 3 approve
    for cust_num in [1, 2, 3]:
        c_login = client.post(
            "/api/v1/auth/login",
            json={"email": f"custodian{cust_num}@thresholdvault.io", "password": "Custodian@123"},
        )
        c_headers = {"Authorization": f"Bearer {c_login.json()['access_token']}"}
        resp = client.post(
            f"/api/v1/recovery/requests/{req_id2}/approve",
            headers=c_headers,
            json={"decision": "APPROVED", "comment": f"Approved by C{cust_num}"},
        )
        assert resp.status_code == 200

    # Status should now be RECOVERABLE (3 / 3 received)
    check2 = client.get(f"/api/v1/recovery/requests/{req_id2}", headers=officer_headers)
    assert check2.json()["status"] == "RECOVERABLE"
    assert check2.json()["approvals_count"] == 3

    # 7. Execute final reconstruction
    exec_resp = client.post(
        f"/api/v1/recovery/requests/{req_id2}/execute?reveal_secret=true",
        headers=officer_headers,
    )
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert exec_data["success"] is True
    assert exec_data["status"] == "RECOVERED"
    assert exec_data["verification_hash"] == verification_hash
    assert exec_data["ephemeral_recovered_secret"] == "INTEGRATION_TEST_SECRET_VALUE_2026"
