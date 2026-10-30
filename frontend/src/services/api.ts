import type {
  AuditLogItem,
  AuditVerificationResult,
  CustodianItem,
  CustodianShareCard,
  DashboardMetrics,
  DemoAccount,
  RecoveryRequestItem,
  SecretItem,
  SecurityPolicy,
  SplitResultResponse,
  UserProfile,
} from '../types';

const API_BASE = '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('tv_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      errMsg = errJson.detail || errJson.message || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user_id: string; email: string; full_name: string; role: any; department: string; custodian_id?: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  getMe: () => request<UserProfile>('/auth/me'),
  getDemoAccounts: () => request<DemoAccount[]>('/auth/demo-accounts'),
  switchDemo: (email: string) => request<any>(`/auth/switch-demo/${encodeURIComponent(email)}`, { method: 'POST' }),

  // Dashboard
  getDashboardMetrics: () => request<DashboardMetrics>('/dashboard/metrics'),

  // Secrets
  listSecrets: () => request<SecretItem[]>('/secrets'),
  getSecret: (id: string) => request<SecretItem>(`/secrets/${id}`),
  registerAndSplitSecret: (data: {
    name: string;
    description?: string;
    institution: string;
    department: string;
    purpose: string;
    threshold: number;
    total_shares: number;
    custom_secret?: string;
    custodian_ids?: string[];
  }) => request<SplitResultResponse>('/secrets/register-and-split', { method: 'POST', body: JSON.stringify(data) }),
  getCustodianShares: (secretId: string) => request<CustodianShareCard[]>(`/secrets/${secretId}/custodian-shares`),

  // Custodians
  listCustodians: () => request<CustodianItem[]>('/custodians'),
  getCustodian: (id: string) => request<CustodianItem>(`/custodians/${id}`),
  createCustodian: (data: { full_name: string; institutional_email: string; department: string; role_title: string; user_id?: string }) =>
    request<CustodianItem>('/custodians', { method: 'POST', body: JSON.stringify(data) }),
  updateCustodian: (id: string, data: Partial<CustodianItem>) =>
    request<CustodianItem>(`/custodians/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Recovery
  listRecoveryRequests: () => request<RecoveryRequestItem[]>('/recovery/requests'),
  getRecoveryRequest: (id: string) => request<RecoveryRequestItem>(`/recovery/requests/${id}`),
  createRecoveryRequest: (data: { secret_id: string; business_justification: string; ticket_id: string }) =>
    request<RecoveryRequestItem>('/recovery/requests', { method: 'POST', body: JSON.stringify(data) }),
  approveRecovery: (requestId: string, data: { decision: string; comment?: string; armored_share?: string }) =>
    request<{ success: boolean; message: string }>(`/recovery/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  executeRecovery: (requestId: string, revealSecret: boolean = false) =>
    request<{
      success: boolean;
      message: string;
      request_id: string;
      secret_id: string;
      verification_hash: string;
      shares_used_count: number;
      status: string;
      ephemeral_recovered_secret?: string;
    }>(`/recovery/requests/${requestId}/execute?reveal_secret=${revealSecret}`, { method: 'POST' }),

  // Audit
  listAuditLogs: (params: { search?: string; event_type?: string; actor?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.event_type) q.set('event_type', params.event_type);
    if (params.actor) q.set('actor', params.actor);
    if (params.limit) q.set('limit', String(params.limit));
    return request<AuditLogItem[]>(`/audit?${q.toString()}`);
  },
  verifyAuditIntegrity: () => request<AuditVerificationResult>('/audit/verify-integrity', { method: 'POST' }),
  simulateTamper: (recordId?: string) =>
    request<{ success: boolean; message: string; tampered_record_id: string }>(
      recordId ? `/audit/simulate-tamper?record_id=${recordId}` : '/audit/simulate-tamper',
      { method: 'POST' }
    ),
  repairAuditChain: () => request<{ success: boolean; message: string; records_repaired: number }>('/audit/repair-chain', { method: 'POST' }),

  // Settings
  getSecurityPolicy: () => request<SecurityPolicy>('/settings'),
  updateSecurityPolicy: (data: Partial<SecurityPolicy>) =>
    request<SecurityPolicy>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Demo Scenarios
  runScenario: (scenario: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g') =>
    request<any>(`/demo/scenario-${scenario}`, { method: 'POST' }),
};
