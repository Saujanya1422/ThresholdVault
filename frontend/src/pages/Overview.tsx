import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Users2,
  GitPullRequestDraft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { MetricCard } from '../components/Common/MetricCard';
import { Badge } from '../components/Common/Badge';
import { PolicyDistributionChart } from '../components/Charts/PolicyDistributionChart';
import { RecoveryActivityChart } from '../components/Charts/RecoveryActivityChart';
import type { DashboardMetrics } from '../types';
import { api } from '../services/api';
import type { PageId } from '../components/Layout/Sidebar';

interface OverviewProps {
  onNavigate: (page: PageId) => void;
  onOpenGuidedDemo: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate, onOpenGuidedDemo }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await api.getDashboardMetrics();
      setMetrics(data);
    } catch (e) {
      console.error('Failed to load dashboard metrics', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Institutional Academic Prototype Notice */}
      <div className="glass-card p-5 rounded-2xl border-l-4 border-l-blue-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Institutional Key Custody Quorum Active</h2>
            <Badge variant="blue" size="sm" dot>
              GF(2^8) Finite Field
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Shamir Secret Sharing distributes cryptographic key custody across institutional custodians with zero secret leakage in logs.
          </p>
        </div>
        <button
          onClick={onOpenGuidedDemo}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold hover:from-blue-500 hover:to-violet-500 shadow-glow-blue transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Run Demo Scenarios</span>
        </button>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Demo Secrets"
          value={metrics?.total_secrets ?? 0}
          subtitle={`${metrics?.active_policies ?? 0} active custody policies`}
          icon={KeyRound}
          variant="blue"
          trend="Protected"
        />
        <MetricCard
          title="Active Custodians"
          value={`${metrics?.active_custodians ?? 0} / ${metrics?.total_custodians ?? 0}`}
          subtitle="Authorized quorum ring"
          icon={Users2}
          variant="violet"
          trend="Quorum Ready"
        />
        <MetricCard
          title="Pending Recovery"
          value={metrics?.pending_recovery_requests ?? 0}
          subtitle="Awaiting custodian votes"
          icon={GitPullRequestDraft}
          variant="amber"
          trend="Active Drills"
        />
        <MetricCard
          title="Audit Hash Chain"
          value={metrics?.chain_integrity_status ? 'Verified' : 'Tamper Alert'}
          subtitle={`${metrics?.total_audit_events ?? 0} SHA-256 blocks`}
          icon={ShieldCheck}
          variant={metrics?.chain_integrity_status ? 'emerald' : 'rose'}
          trend={metrics?.chain_integrity_status ? 'Cryptographically Intact' : 'Integrity Broken'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policy Distribution */}
        <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Custody Policy Distribution</h3>
                <p className="text-xs text-slate-400">Threshold policies (k-of-n) across registered secrets</p>
              </div>
              <Badge variant="blue" size="sm">Policies</Badge>
            </div>
            <PolicyDistributionChart data={metrics?.policy_distribution ?? []} />
          </div>
          <div className="pt-4 border-t border-navy-700/60 flex items-center justify-between text-xs text-slate-400">
            <span>Primary Quorum:</span>
            <span className="font-mono text-blue-400 font-semibold">3-of-5 Institutional Standard</span>
          </div>
        </div>

        {/* Recovery Activity */}
        <div className="glass-card p-5 rounded-2xl lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Secret Recovery Telemetry</h3>
                <p className="text-xs text-slate-400">Recovery request outcomes and quorum completion history</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 font-medium">{metrics?.successful_recoveries ?? 0} Recovered</span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-rose-400 font-medium">{metrics?.failed_recoveries ?? 0} Rejected</span>
              </div>
            </div>
            <RecoveryActivityChart data={metrics?.recovery_activity ?? []} />
          </div>
          <div className="pt-4 border-t border-navy-700/60 flex items-center justify-between text-xs text-slate-400">
            <span>Security Model:</span>
            <span className="text-slate-300">Lagrange interpolation only executes when threshold approvals are met</span>
          </div>
        </div>
      </div>

      {/* Recent Audit Ledger Preview */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Tamper-Evident Audit Ledger</h3>
            <p className="text-xs text-slate-400">Recent cryptographically linked security and custody events</p>
          </div>
          <button
            onClick={() => onNavigate('audit')}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            <span>View Full Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-navy-700 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Block Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60">
              {metrics?.recent_audit_events?.map((evt) => (
                <tr key={evt.id} className="hover:bg-navy-800/30 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[11px] font-mono border border-blue-500/20">
                      {evt.event_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 font-medium truncate max-w-[160px]">{evt.actor}</td>
                  <td className="py-2.5 px-3 text-slate-300">{evt.action}</td>
                  <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px] font-mono text-[11px]">{evt.target}</td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                    {evt.record_hash.substring(0, 10)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
