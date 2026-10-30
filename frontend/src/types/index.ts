export type UserRole = 'ADMIN' | 'SECURITY_OFFICER' | 'CUSTODIAN' | 'AUDITOR';

export type SecretStatus = 'ACTIVE' | 'SPLIT' | 'RECOVERED' | 'ARCHIVED';

export type CustodianStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type ShareDistributionStatus = 'GENERATED' | 'DISTRIBUTED' | 'ACKNOWLEDGED';

export type RecoveryStatus = 'PENDING' | 'RECOVERABLE' | 'RECOVERED' | 'REJECTED' | 'FAILED';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  is_active: boolean;
  custodian_id?: string | null;
}

export interface DemoAccount {
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  custodian_id?: string | null;
  demo_password?: string;
}

export interface SecretItem {
  id: string;
  name: string;
  description?: string;
  institution: string;
  department: string;
  purpose: string;
  threshold: int;
  total_shares: int;
  status: SecretStatus;
  verification_hash: string;
  expiry_date?: string | null;
  shares_distributed: number;
  created_at: string;
  updated_at: string;
}

export interface CustodianItem {
  id: string;
  full_name: string;
  institutional_email: string;
  department: string;
  role_title: string;
  status: CustodianStatus;
  public_key_fingerprint: string;
  assigned_shares_count: number;
  created_at: string;
}

export interface CustodianShareCard {
  id: string;
  secret_id: string;
  secret_name: string;
  custodian_id: string;
  custodian_name: string;
  share_x: number;
  distribution_status: ShareDistributionStatus;
  checksum: string;
  assigned_at: string;
  armored_token?: string | null;
}

export interface ShareExportItem {
  custodian_id: string;
  custodian_name: string;
  custodian_email: string;
  x: number;
  armored_share: string;
  checksum: string;
  download_filename: string;
}

export interface SplitResultResponse {
  secret_id: string;
  secret_name: string;
  threshold: number;
  total_shares: number;
  verification_hash: string;
  shares: ShareExportItem[];
  message: string;
}

export interface RecoveryApprovalItem {
  id: string;
  custodian_id: string;
  custodian_name: string;
  custodian_email: string;
  department: string;
  decision: ApprovalDecision;
  comment?: string;
  share_submitted: boolean;
  created_at: string;
}

export interface RecoveryRequestItem {
  id: string;
  secret_id: string;
  secret_name: string;
  secret_purpose: string;
  requested_by: string;
  requested_by_email: string;
  business_justification: string;
  ticket_id: string;
  required_threshold: number;
  total_shares: number;
  approvals_count: number;
  shares_submitted_count: number;
  status: RecoveryStatus;
  failure_reason?: string | null;
  created_at: string;
  completed_at?: string | null;
  approvals: RecoveryApprovalItem[];
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  action: string;
  target: string;
  details: Record<string, any>;
  prev_hash: string;
  record_hash: string;
}

export interface AuditVerificationResult {
  is_valid: boolean;
  message: string;
  total_blocks_checked: number;
  tampered_index?: number | null;
  tampered_record_id?: string | null;
}

export interface SecurityPolicy {
  default_threshold: number;
  default_total_shares: number;
  min_threshold: number;
  max_shares: number;
  require_dual_auth: boolean;
  require_ticket_id: boolean;
  session_timeout_minutes: number;
  rate_limit_per_minute: number;
  tamper_simulation_flag: boolean;
  updated_at: string;
}

export interface DashboardMetrics {
  total_secrets: number;
  active_policies: number;
  total_custodians: number;
  active_custodians: number;
  pending_recovery_requests: number;
  successful_recoveries: number;
  failed_recoveries: number;
  total_audit_events: number;
  chain_integrity_status: boolean;
  policy_distribution: { policy: string; count: number; percentage: number }[];
  recovery_activity: { label: string; pending: number; recovered: number; failed: number }[];
  recent_audit_events: AuditLogItem[];
}
