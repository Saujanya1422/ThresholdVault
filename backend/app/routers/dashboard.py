"""Dashboard Metrics & Recharts Telemetry Router."""

from collections import Counter
import json
from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import (
    AuditLog,
    Custodian,
    CustodianStatus,
    RecoveryRequest,
    RecoveryStatus,
    SecretMetadata,
    SecretStatus,
)
from app.models.schemas import (
    AuditLogItem,
    DashboardMetricsResponse,
    PolicyDistributionPoint,
    RecoveryActivityPoint,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Retrieve live institutional metrics and chart data directly from the SQLite database."""
    total_secrets = db.query(SecretMetadata).count()
    active_policies = (
        db.query(SecretMetadata)
        .filter(SecretMetadata.status.in_([SecretStatus.ACTIVE, SecretStatus.SPLIT]))
        .count()
    )
    total_custodians = db.query(Custodian).count()
    active_custodians = db.query(Custodian).filter(Custodian.status == CustodianStatus.ACTIVE).count()

    pending_recovery = (
        db.query(RecoveryRequest)
        .filter(RecoveryRequest.status.in_([RecoveryStatus.PENDING, RecoveryStatus.RECOVERABLE]))
        .count()
    )
    successful_recoveries = (
        db.query(RecoveryRequest).filter(RecoveryRequest.status == RecoveryStatus.RECOVERED).count()
    )
    failed_recoveries = (
        db.query(RecoveryRequest).filter(RecoveryRequest.status == RecoveryStatus.FAILED).count()
    )

    total_audit_events = db.query(AuditLog).count()

    # Cryptographic audit integrity check
    is_valid, _, _, _, _ = AuditService.verify_integrity(db)

    # 1. Policy distribution data
    secrets = db.query(SecretMetadata).all()
    policy_counts: Dict[str, int] = Counter()
    for s in secrets:
        policy_label = f"{s.threshold}-of-{s.total_shares}"
        policy_counts[policy_label] += 1

    total_policies = len(secrets) or 1
    policy_distribution = [
        PolicyDistributionPoint(
            policy=pol,
            count=cnt,
            percentage=round((cnt / total_policies) * 100, 1),
        )
        for pol, cnt in sorted(policy_counts.items())
    ]
    if not policy_distribution:
        policy_distribution = [PolicyDistributionPoint(policy="3-of-5", count=0, percentage=0.0)]

    # 2. Recovery activity points
    # Aggregate recovery requests by ticket/month or recent batches
    reqs = db.query(RecoveryRequest).order_by(RecoveryRequest.created_at.desc()).limit(10).all()
    recovery_activity = []
    if reqs:
        for r in reversed(reqs):
            label = r.ticket_id
            recovery_activity.append(
                RecoveryActivityPoint(
                    label=label,
                    pending=1 if r.status in [RecoveryStatus.PENDING, RecoveryStatus.RECOVERABLE] else 0,
                    recovered=1 if r.status == RecoveryStatus.RECOVERED else 0,
                    failed=1 if r.status in [RecoveryStatus.FAILED, RecoveryStatus.REJECTED] else 0,
                )
            )
    else:
        recovery_activity = [
            RecoveryActivityPoint(label="SEC-INC-DEMO-1", pending=0, recovered=1, failed=0),
            RecoveryActivityPoint(label="SEC-INC-DEMO-2", pending=1, recovered=0, failed=0),
        ]

    # 3. Recent audit events
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(8).all()
    audit_items = []
    for l in recent_logs:
        details_dict = {}
        try:
            details_dict = json.loads(l.details_json) if isinstance(l.details_json, str) else l.details_json
        except Exception:
            details_dict = {"raw": l.details_json}

        audit_items.append(
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

    return DashboardMetricsResponse(
        total_secrets=total_secrets,
        active_policies=active_policies,
        total_custodians=total_custodians,
        active_custodians=active_custodians,
        pending_recovery_requests=pending_recovery,
        successful_recoveries=successful_recoveries,
        failed_recoveries=failed_recoveries,
        total_audit_events=total_audit_events,
        chain_integrity_status=is_valid,
        policy_distribution=policy_distribution,
        recovery_activity=recovery_activity,
        recent_audit_events=audit_items,
    )
