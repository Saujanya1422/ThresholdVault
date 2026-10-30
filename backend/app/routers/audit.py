"""Audit Log & Tamper-Evident Ledger Router."""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import User, UserRole
from app.models.schemas import AuditLogItem, AuditVerificationResponse
from app.services.auth_service import get_current_user, require_roles
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("", response_model=List[AuditLogItem])
def get_audit_logs(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    actor: Optional[str] = Query(None, description="Filter by actor email"),
    search: Optional[str] = Query(None, description="Search keyword in action/target/details"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve chronologically linked audit records.
    
    Accessible to all authorized roles. Auditor role has specialized compliance tools.
    """
    logs = AuditService.get_logs(
        db=db,
        event_type=event_type,
        actor=actor,
        search=search,
        limit=limit,
        offset=offset,
    )
    items = []
    for l in logs:
        try:
            details_dict = json.loads(l.details_json) if isinstance(l.details_json, str) else l.details_json
        except Exception:
            details_dict = {"raw": l.details_json}

        items.append(
            AuditLogItem(
                id=l.id,
                timestamp=l.timestamp,
                event_type=l.event_type,
                actor=l.actor,
                action=l.action,
                target=l.target,
                details=details_dict,
                prev_hash=l.prev_hash,
                record_hash=l.record_hash,
            )
        )
    return items


@router.post("/verify-integrity", response_model=AuditVerificationResponse)
def verify_audit_chain_integrity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run sequential cryptographic verification over the entire SHA-256 audit hash chain.
    
    Walks each block from genesis to head, recalculating and matching hashes.
    """
    is_valid, message, count, bad_idx, bad_id = AuditService.verify_integrity(db)
    return AuditVerificationResponse(
        is_valid=is_valid,
        message=message,
        total_blocks_checked=count,
        tampered_index=bad_idx,
        tampered_record_id=bad_id,
    )


@router.post("/simulate-tamper")
def simulate_tamper_attack(
    record_id: Optional[str] = None,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.AUDITOR])),
    db: Session = Depends(get_db),
):
    """DEMO ACTION: Simulate an adversary modifying a database audit record directly.
    
    This deliberately violates the hash chain to prove that verification detects the breach.
    """
    try:
        tampered_record = AuditService.simulate_tamper(db=db, record_id=record_id)
        return {
            "success": True,
            "message": "Tamper attack simulated: altered action and target of audit block without updating hash.",
            "tampered_record_id": tampered_record.id,
            "tampered_actor": tampered_record.actor,
            "tampered_timestamp": tampered_record.timestamp.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/repair-chain")
def repair_audit_chain(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.AUDITOR])),
    db: Session = Depends(get_db),
):
    """DEMO ACTION: Recalculate block hashes sequentially to restore audit chain integrity."""
    count = AuditService.repair_chain(db)
    return {
        "success": True,
        "message": f"Successfully recomputed SHA-256 chain across {count} audit records. Integrity restored.",
        "records_repaired": count,
    }
