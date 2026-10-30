"""Tamper-evident hash-chained audit log cryptographic verification engine."""

import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple


class HashChain:
    """Cryptographic hash-chaining engine for immutable audit logs."""

    GENESIS_PREV_HASH = "0" * 64

    @classmethod
    def compute_hash(
        cls,
        entry_id: str,
        timestamp_iso: str,
        event_type: str,
        actor: str,
        action: str,
        target: str,
        details: Dict[str, Any],
        prev_hash: str,
    ) -> str:
        """Compute SHA-256 hash for an audit record linked to the previous block hash."""
        # Canonical JSON string for deterministic hashing
        canonical_details = json.dumps(details, sort_keys=True, separators=(",", ":"))
        payload = f"{entry_id}|{timestamp_iso}|{event_type}|{actor}|{action}|{target}|{canonical_details}|{prev_hash}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def verify_chain(
        cls,
        records: List[Dict[str, Any]]
    ) -> Tuple[bool, Optional[str], Optional[int]]:
        """Verify the cryptographic integrity of the sequential hash chain.
        
        Args:
            records: List of audit record dicts sorted chronologically.
            
        Returns:
            (is_valid, failure_reason, tampered_record_index)
        """
        if not records:
            return True, None, None

        expected_prev_hash = cls.GENESIS_PREV_HASH

        for idx, rec in enumerate(records):
            rec_id = str(rec.get("id", ""))
            ts = str(rec.get("timestamp", ""))
            event_type = str(rec.get("event_type", ""))
            actor = str(rec.get("actor", ""))
            action = str(rec.get("action", ""))
            target = str(rec.get("target", ""))
            details = rec.get("details", {})
            if isinstance(details, str):
                try:
                    details = json.loads(details)
                except Exception:
                    details = {"raw": details}
            
            stored_prev_hash = str(rec.get("prev_hash", ""))
            stored_hash = str(rec.get("record_hash", ""))

            # 1. Verify link to previous hash
            if stored_prev_hash != expected_prev_hash:
                return (
                    False,
                    f"Hash chain broken at index {idx} (ID: {rec_id}): "
                    f"stored prev_hash '{stored_prev_hash}' does not match expected '{expected_prev_hash}'",
                    idx,
                )

            # 2. Recompute current record hash and check against stored hash
            computed_hash = cls.compute_hash(
                entry_id=rec_id,
                timestamp_iso=ts,
                event_type=event_type,
                actor=actor,
                action=action,
                target=target,
                details=details,
                prev_hash=stored_prev_hash,
            )

            if computed_hash != stored_hash:
                return (
                    False,
                    f"Content integrity violation at index {idx} (ID: {rec_id}): "
                    f"payload was modified. Computed hash '{computed_hash}' does not match stored hash '{stored_hash}'",
                    idx,
                )

            expected_prev_hash = stored_hash

        return True, "Chain integrity verified. All cryptographic links and block signatures are intact.", None
