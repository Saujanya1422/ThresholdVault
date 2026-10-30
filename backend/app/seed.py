"""Database Seeder with Realistic Institutional Demonstration Data."""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.crypto.hash_chain import HashChain
from app.crypto.shamir import ShamirSecretSharing
from app.crypto.shares import Share, format_share
from app.crypto.storage_cipher import StorageCipher
from app.database import Base, SessionLocal, engine
from app.models.db_models import (
    ApprovalDecision,
    AuditLog,
    Custodian,
    CustodianShare,
    CustodianStatus,
    RecoveryApproval,
    RecoveryRequest,
    RecoveryStatus,
    SecretMetadata,
    SecretStatus,
    SecurityPolicy,
    ShareDistributionStatus,
    User,
    UserRole,
)
from app.services.auth_service import hash_password


def seed_database(db: Session) -> None:
    """Populate database with demo accounts, custodians, secrets, and an intact hash-chained audit trail."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # Check if already seeded
    if db.query(User).count() > 0:
        return

    print("Seeding ThresholdVault institutional prototype database...")

    # 1. Security Policy Default
    policy = SecurityPolicy(
        id=1,
        default_threshold=3,
        default_total_shares=5,
        min_threshold=2,
        max_shares=16,
        require_dual_auth=True,
        require_ticket_id=True,
        session_timeout_minutes=60,
        rate_limit_per_minute=120,
        tamper_simulation_flag=False,
    )
    db.add(policy)

    # 2. Institutional Users
    demo_users_data = [
        {
            "email": "admin@thresholdvault.io",
            "full_name": "Marcus Aurelius (Chief Information Security Officer)",
            "role": UserRole.ADMIN,
            "department": "Executive Security Directorate",
            "password": "Admin@Vault2026!",
        },
        {
            "email": "officer@thresholdvault.io",
            "full_name": "Sarah Lin (Lead Security Officer & Cryptographer)",
            "role": UserRole.SECURITY_OFFICER,
            "department": "Cryptographic Key Custody",
            "password": "Officer@Vault2026!",
        },
        {
            "email": "custodian1@thresholdvault.io",
            "full_name": "Dr. Aris Vance",
            "role": UserRole.CUSTODIAN,
            "department": "Treasury Operations",
            "password": "Custodian@123",
        },
        {
            "email": "custodian2@thresholdvault.io",
            "full_name": "Elena Rostova",
            "role": UserRole.CUSTODIAN,
            "department": "Core Infrastructure",
            "password": "Custodian@123",
        },
        {
            "email": "custodian3@thresholdvault.io",
            "full_name": "Marcus Sterling",
            "role": UserRole.CUSTODIAN,
            "department": "Risk & Governance",
            "password": "Custodian@123",
        },
        {
            "email": "custodian4@thresholdvault.io",
            "full_name": "Devon Thorne",
            "role": UserRole.CUSTODIAN,
            "department": "Cloud Security",
            "password": "Custodian@123",
        },
        {
            "email": "custodian5@thresholdvault.io",
            "full_name": "Amina Patel",
            "role": UserRole.CUSTODIAN,
            "department": "Legal & Compliance",
            "password": "Custodian@123",
        },
        {
            "email": "auditor@thresholdvault.io",
            "full_name": "Victor Thorne (Senior Cybersecurity Auditor)",
            "role": UserRole.AUDITOR,
            "department": "Independent Audit & Assurance",
            "password": "Auditor@Vault2026!",
        },
    ]

    user_records = {}
    for udata in demo_users_data:
        user_id = str(uuid.uuid4())
        u = User(
            id=user_id,
            email=udata["email"],
            hashed_password=hash_password(udata["password"]),
            full_name=udata["full_name"],
            role=udata["role"],
            department=udata["department"],
            is_active=True,
        )
        db.add(u)
        user_records[udata["email"]] = u

    db.flush()

    # 3. Institutional Custodians
    custodians_data = [
        ("custodian1@thresholdvault.io", "Dr. Aris Vance", "Treasury Operations", "VP of Treasury Operations"),
        ("custodian2@thresholdvault.io", "Elena Rostova", "Core Infrastructure", "Principal Infrastructure Architect"),
        ("custodian3@thresholdvault.io", "Marcus Sterling", "Risk & Governance", "Director of Operational Risk"),
        ("custodian4@thresholdvault.io", "Devon Thorne", "Cloud Security", "Staff Cryptography Engineer"),
        ("custodian5@thresholdvault.io", "Amina Patel", "Legal & Compliance", "Chief Compliance Counsel"),
    ]

    custodian_records = []
    for email, name, dept, title in custodians_data:
        cid = str(uuid.uuid4())
        user_obj = user_records[email]
        fp_raw = hashlib.sha256(f"PUBKEY_{email}".encode()).hexdigest()[:24].upper()
        fp = ":".join(fp_raw[i:i+2] for i in range(0, len(fp_raw), 2))

        c = Custodian(
            id=cid,
            user_id=user_obj.id,
            full_name=name,
            institutional_email=email,
            department=dept,
            role_title=title,
            status=CustodianStatus.ACTIVE,
            public_key_fingerprint=f"ED25519:{fp}",
        )
        db.add(c)
        custodian_records.append(c)

    db.flush()

    # 4. Hash Chain Audit Ledger Initialization
    prev_hash = HashChain.GENESIS_PREV_HASH
    audit_chain_logs = []

    def append_audit_event(event_type: str, actor: str, action: str, target: str, details: dict, delta_mins: int):
        nonlocal prev_hash
        eid = str(uuid.uuid4())
        ts = (datetime.now(timezone.utc) - timedelta(minutes=delta_mins)).replace(microsecond=0)
        ts_iso = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
        rec_hash = HashChain.compute_hash(
            entry_id=eid,
            timestamp_iso=ts_iso,
            event_type=event_type,
            actor=actor,
            action=action,
            target=target,
            details=details,
            prev_hash=prev_hash,
        )
        import json
        log = AuditLog(
            id=eid,
            timestamp=ts,
            event_type=event_type,
            actor=actor,
            action=action,
            target=target,
            details_json=json.dumps(details),
            prev_hash=prev_hash,
            record_hash=rec_hash,
        )
        db.add(log)
        prev_hash = rec_hash
        audit_chain_logs.append(log)

    append_audit_event(
        "GENESIS_BLOCK",
        "system@thresholdvault.io",
        "INITIALIZE_VAULT",
        "System:Genesis",
        {"version": "1.0.0", "environment": "Institutional-Academic-Demo"},
        180,
    )

    # 5. Pre-registered Institutional Secrets & Shamir Splitting
    secrets_seed = [
        {
            "name": "Master HSM Partition Root Signing Key",
            "desc": "Primary RSA-4096 signing root for high-value wholesale payment clearing.",
            "dept": "Treasury Operations",
            "purpose": "Wholesale Settlement Signing",
            "threshold": 3,
            "total": 5,
            "demo_secret": b"TV-PROD-HSM-PARTITION-ROOT-KEY-4096-AES256GCM-SEED-2026",
        },
        {
            "name": "Tier-1 Certificate Authority Root Private Key",
            "desc": "Offline institutional root CA for internal TLS and zero-trust mTLS issuance.",
            "dept": "Core Infrastructure",
            "purpose": "Root CA Issuance",
            "threshold": 4,
            "total": 5,
            "demo_secret": b"TV-ROOT-CA-OFFLINE-VAULT-ED25519-MASTER-2026",
        },
        {
            "name": "Cross-Chain Liquidity Cold Storage Seed",
            "desc": "Consortium multi-sig cold backup recovery phrase for institutional digital assets.",
            "dept": "Global Markets",
            "purpose": "Cold Storage Vault Backup",
            "threshold": 3,
            "total": 5,
            "demo_secret": b"TV-CROSS-CHAIN-COLD-STORAGE-SHARD-SEED-HEX-66b9a8f4c1",
        },
        {
            "name": "Database Envelope Key (DEK-Master)",
            "desc": "Root key for transparent database encryption across core ledger partitions.",
            "dept": "Cloud Security",
            "purpose": "Envelope Encryption Root",
            "threshold": 2,
            "total": 3,
            "demo_secret": b"TV-DEK-MASTER-AES256-ENVELOPE-ROOT-2026",
        },
    ]

    for s_idx, sdata in enumerate(secrets_seed):
        sid = str(uuid.uuid4())
        vhash = ShamirSecretSharing.compute_hash(sdata["demo_secret"])

        secret_record = SecretMetadata(
            id=sid,
            name=sdata["name"],
            description=sdata["desc"],
            institution="Metropolitan Reserve & Custody Corp",
            department=sdata["dept"],
            purpose=sdata["purpose"],
            threshold=sdata["threshold"],
            total_shares=sdata["total"],
            status=SecretStatus.SPLIT,
            verification_hash=vhash,
            expiry_date=datetime.now(timezone.utc) + timedelta(days=365),
            created_at=datetime.now(timezone.utc) - timedelta(minutes=150 - (s_idx * 20)),
        )
        db.add(secret_record)

        # Shamir Split
        raw_shares = ShamirSecretSharing.split_secret(
            sdata["demo_secret"],
            threshold=sdata["threshold"],
            total_shares=sdata["total"],
        )

        for i, (x, y_payload) in enumerate(raw_shares):
            cust = custodian_records[i]
            share_id = str(uuid.uuid4())
            enc_payload = StorageCipher.encrypt(y_payload)

            share_obj = Share(
                share_id=share_id,
                secret_id=sid,
                x=x,
                payload=y_payload,
                threshold=sdata["threshold"],
                total_shares=sdata["total"],
            )

            c_share = CustodianShare(
                id=share_id,
                secret_id=sid,
                custodian_id=cust.id,
                share_x=x,
                share_id_token=share_id[:12],
                encrypted_payload=enc_payload,
                checksum=share_obj.checksum,
                distribution_status=ShareDistributionStatus.DISTRIBUTED,
                assigned_at=datetime.now(timezone.utc) - timedelta(minutes=145 - (s_idx * 20)),
            )
            db.add(c_share)

        append_audit_event(
            "SECRET_REGISTERED",
            "officer@thresholdvault.io",
            "REGISTER_SECRET",
            f"Secret:{sid}",
            {
                "name": sdata["name"],
                "policy": f"{sdata['threshold']}-of-{sdata['total']}",
                "verification_hash": vhash,
            },
            140 - (s_idx * 20),
        )

    db.flush()

    # 6. Sample Pending Recovery Request
    first_secret = db.query(SecretMetadata).filter(SecretMetadata.name.ilike("%HSM%")).first()
    if first_secret:
        req_id = str(uuid.uuid4())
        rec_req = RecoveryRequest(
            id=req_id,
            secret_id=first_secret.id,
            requested_by_user_id=user_records["officer@thresholdvault.io"].id,
            business_justification="Scheduled annual disaster recovery drill for Wholesale Clearing HSM partition failover.",
            ticket_id="SEC-INC-2026-DR-01",
            required_threshold=first_secret.threshold,
            status=RecoveryStatus.PENDING,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=45),
        )
        db.add(rec_req)

        # 2 of 3 needed custodians already approved
        for i in range(2):
            cust = custodian_records[i]
            # Decrypt share to get armored token
            c_share = db.query(CustodianShare).filter(
                CustodianShare.secret_id == first_secret.id,
                CustodianShare.custodian_id == cust.id,
            ).first()
            raw_payload = StorageCipher.decrypt(c_share.encrypted_payload)
            sh_obj = Share(
                share_id=c_share.id,
                secret_id=first_secret.id,
                x=c_share.share_x,
                payload=raw_payload,
                threshold=first_secret.threshold,
                total_shares=first_secret.total_shares,
            )
            appr = RecoveryApproval(
                id=str(uuid.uuid4()),
                request_id=rec_req.id,
                custodian_id=cust.id,
                decision=ApprovalDecision.APPROVED,
                comment=f"DR authorization approved by {cust.full_name} under policy ref SEC-DR-2026",
                share_submitted=True,
                ephemeral_share_token=format_share(sh_obj),
                ip_address="10.200.4.15",
                created_at=datetime.now(timezone.utc) - timedelta(minutes=30 - (i * 10)),
            )
            db.add(appr)

        append_audit_event(
            "RECOVERY_REQUESTED",
            "officer@thresholdvault.io",
            "INITIATE_RECOVERY",
            f"RecoveryRequest:{req_id}",
            {
                "ticket_id": "SEC-INC-2026-DR-01",
                "secret_name": first_secret.name,
                "required_threshold": first_secret.threshold,
            },
            45,
        )

    db.commit()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    db = SessionLocal()
    seed_database(db)
    db.close()
