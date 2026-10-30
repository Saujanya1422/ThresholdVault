import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Shield,
  Clock,
  Zap,
  Save,
  CheckCircle2,
  Info,
  Lock,
} from 'lucide-react';
import type { SecurityPolicy } from '../types';
import { api } from '../services/api';
import { Badge } from '../components/Common/Badge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SecuritySettings: React.FC = () => {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable Form fields
  const [defaultThreshold, setDefaultThreshold] = useState(3);
  const [defaultTotalShares, setDefaultTotalShares] = useState(5);
  const [requireDualAuth, setRequireDualAuth] = useState(true);
  const [requireTicketId, setRequireTicketId] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [rateLimit, setRateLimit] = useState(120);

  const { hasRole } = useAuth();
  const { success, error, warning } = useToast();

  const loadPolicy = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSecurityPolicy();
      setPolicy(data);
      setDefaultThreshold(data.default_threshold);
      setDefaultTotalShares(data.default_total_shares);
      setRequireDualAuth(data.require_dual_auth);
      setRequireTicketId(data.require_ticket_id);
      setSessionTimeout(data.session_timeout_minutes);
      setRateLimit(data.rate_limit_per_minute);
    } catch (err: any) {
      error('Failed to load settings', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (defaultThreshold > defaultTotalShares) {
      warning('Invalid Policy', 'Default threshold cannot exceed default total shares.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateSecurityPolicy({
        default_threshold: defaultThreshold,
        default_total_shares: defaultTotalShares,
        require_dual_auth: requireDualAuth,
        require_ticket_id: requireTicketId,
        session_timeout_minutes: sessionTimeout,
        rate_limit_per_minute: rateLimit,
      });
      setPolicy(updated);
      success('Policy Saved', 'Institutional security settings updated successfully.');
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = hasRole(['ADMIN']);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            Security & Quorum Policy Settings
          </h2>
          <p className="text-xs text-slate-400">
            Configure institutional threshold rules, session governance, and rate limits for key recovery drills.
          </p>
        </div>

        {!isAdmin && (
          <Badge variant="amber" size="sm">
            Read-Only: Requires Administrator Role to Edit
          </Badge>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Config Form */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl space-y-5 text-xs">
          <div className="border-b border-navy-700/60 pb-3">
            <h3 className="text-sm font-semibold text-white">Default Threshold Policy Parameters</h3>
            <p className="text-slate-400 text-[11px]">Applied to newly registered institutional keys by default.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Default Threshold (k)</label>
              <input
                type="number"
                disabled={!isAdmin}
                min={1}
                max={defaultTotalShares}
                value={defaultThreshold}
                onChange={(e) => setDefaultThreshold(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Default Custodian Shares (n)</label>
              <input
                type="number"
                disabled={!isAdmin}
                min={defaultThreshold}
                max={16}
                value={defaultTotalShares}
                onChange={(e) => setDefaultTotalShares(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
              />
            </div>
          </div>

          <div className="border-b border-navy-700/60 pb-3 pt-2">
            <h3 className="text-sm font-semibold text-white">Access Governance Rules</h3>
            <p className="text-slate-400 text-[11px]">Institutional dual-control and audit validation constraints.</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-navy-950 border border-navy-800 cursor-pointer">
              <div>
                <span className="font-semibold text-white">Enforce Dual-Control Quorum</span>
                <p className="text-[11px] text-slate-400">
                  Requires both authorized officer initiation and authenticated custodian approvals.
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={requireDualAuth}
                onChange={(e) => setRequireDualAuth(e.target.checked)}
                className="rounded border-navy-700 bg-navy-900 text-blue-600 disabled:opacity-50"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-navy-950 border border-navy-800 cursor-pointer">
              <div>
                <span className="font-semibold text-white">Mandatory Incident Ticket ID</span>
                <p className="text-[11px] text-slate-400">
                  Every secret recovery request must link to a valid enterprise security incident ticket.
                </p>
              </div>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={requireTicketId}
                onChange={(e) => setRequireTicketId(e.target.checked)}
                className="rounded border-navy-700 bg-navy-900 text-blue-600 disabled:opacity-50"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Session Timeout (Minutes)</label>
              <input
                type="number"
                disabled={!isAdmin}
                min={5}
                max={1440}
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Demo Rate Limit (Reqs / Min)</label>
              <input
                type="number"
                disabled={!isAdmin}
                min={10}
                max={1000}
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value) || 120)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-xs shadow-glow-blue disabled:opacity-50 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Updating Policies...' : 'Save Policy Changes'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Architectural Explanations */}
        <div className="glass-card p-6 rounded-2xl space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Institutional Architecture Notes
          </h3>

          <div className="space-y-3 text-slate-300">
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-1">
              <span className="font-semibold text-white">Demonstrative Scope:</span>
              <p className="text-[11px] text-slate-400">
                This academic prototype uses SQLite for local execution. In production, policies bind to hardware security modules (HSMs) and KMS key encryption keys.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-1">
              <span className="font-semibold text-white">Reconstruction vs Signing:</span>
              <p className="text-[11px] text-slate-400">
                Shamir Secret Sharing reconstructs the secret once threshold shares are assembled. For signing without secret reconstruction, institutions use Threshold Signature Schemes (TSS / MPC like FROST).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-1">
              <span className="font-semibold text-white">Cryptographic Verification:</span>
              <p className="text-[11px] text-slate-400">
                Reconstructed secrets are verified in-memory against SHA-256 digests before approval. The secret value is wiped immediately after processing.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
