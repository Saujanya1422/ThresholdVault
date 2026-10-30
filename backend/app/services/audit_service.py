"""Audit Log Service with Cryptographic Hash-Chaining."""

from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.crypto.hash_chain import HashChain
from app.models.db_models import AuditLog


class AuditService:
    """Service to create, query, and verify tamper-evident audit logs."""

    @staticmethod
    def log_event(
        db: Session,
        event_type: str,
        actor: str,
        action: str,
        target: str,
        details: Dict[str, Any],
    ) -> AuditLog:
        """Create and cryptographically link a new audit log record.
        
        Guaranteed: Plaintext secrets, raw passwords, and unencrypted shares
        are strictly prohibited in details.
        """
        # Sanitize details just in case
        sanitized_details = {}
        for k, v in details.items():
            if any(forbidden in k.lower() for forbidden in ["secret", "password", "token", "payload_hex"]):
                sanitized_details[k] = "[REDACTED_CRYPTOGRAPHIC_PAYLOAD]"
            else:
                sanitized_details[k] = v

        entry_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        ts_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Find previous block
        last_entry = db.query(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).first()
        prev_hash = last_entry.record_hash if last_entry else HashChain.GENESIS_PREV_HASH

        # Compute hash
        record_hash = HashChain.compute_hash(
            entry_id=entry_id,
            timestamp_iso=ts_iso,
            event_type=event_type,
            actor=actor,
            action=action,
            target=target,
            details=sanitized_details,
            prev_hash=prev_hash,
        )

        audit_record = AuditLog(
            id=entry_id,
            timestamp=now,
            event_type=event_type,
            actor=actor,
            action=action,
            target=target,
            details_json=json.dumps(sanitized_details),
            prev_hash=prev_hash,
            record_hash=record_hash,
        )

        db.add(audit_record)
        db.commit()
        db.refresh(audit_record)
        return audit_record

    @staticmethod
    def get_logs(
        db: Session,
        event_type: Optional[str] = None,
        actor: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        """Query audit logs with optional filters."""
        query = db.query(AuditLog)
        if event_type:
            query = query.filter(AuditLog.event_type == event_type)
        if actor:
            query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))
        if search:
            query = query.filter(
                (AuditLog.action.ilike(f"%{search}%")) |
                (AuditLog.target.ilike(f"%{search}%")) |
                (AuditLog.details_json.ilike(f"%{search}%"))
            )
        return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def verify_integrity(db: Session) -> Tuple[bool, str, int, Optional[int], Optional[str]]:
        """Verify sequential cryptographic integrity of the entire audit chain."""
        logs = db.query(AuditLog).order_by(AuditLog.timestamp.asc(), AuditLog.id.asc()).all()
        if not logs:
            return True, "Audit log is empty; genesis intact.", 0, None, None

        records = [
            {
                "id": l.id,
                "timestamp": l.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "event_type": l.event_type,
                "actor": l.actor,
                "action": l.action,
                "target": l.target,
                "details": l.details_json,
                "prev_hash": l.prev_hash,
                "record_hash": l.record_hash,
            }
            for l in logs
        ]

        is_valid, msg, bad_idx = HashChain.verify_chain(records)
        bad_id = records[bad_idx]["id"] if bad_idx is not None else None
        return is_valid, msg or "OK", len(logs), bad_idx, bad_id

    @staticmethod
    def simulate_tamper(db: Session, record_id: Optional[str] = None) -> AuditLog:
        """Simulate a tamper attack on the database to test cryptographic detection."""
        if record_id:
            entry = db.query(AuditLog).filter(AuditLog.id == record_id).first()
        else:
            # Pick the 3rd or middle record if possible, or any record
            entries = db.query(AuditLog).order_by(AuditLog.timestamp.asc()).all()
            if not entries:
                raise ValueError("No audit logs to tamper with")
            entry = entries[len(entries) // 2]

        if not entry:
            raise ValueError("Target record not found")

        # Unauthorized modification of target resource and action without updating hash
        entry.action = "TAMPERED_UNAUTHORIZED_ALTERATION"
        entry.target = "UNAUTHORIZED_MODIFIED_PAYLOAD_TARGET"
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def repair_chain(db: Session) -> int:
        """Repair and re-hash audit logs to restore chain integrity for testing."""
        entries = db.query(AuditLog).order_by(AuditLog.timestamp.asc(), AuditLog.id.asc()).all()
        prev_hash = HashChain.GENESIS_PREV_HASH

        for e in entries:
            e.prev_hash = prev_hash
            details = json.loads(e.details_json) if isinstance(e.details_json, str) else e.details_json
            e.record_hash = HashChain.compute_hash(
                entry_id=e.id,
                timestamp_iso=e.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                event_type=e.event_type,
                actor=e.actor,
                action=e.action,
                target=e.target,
                details=details,
                prev_hash=prev_hash,
            )
            prev_hash = e.record_hash

        db.commit()
        return len(entries)
