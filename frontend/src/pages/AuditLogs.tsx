import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  ShieldAlert,
  Wrench,
  Lock,
} from 'lucide-react';
import type { AuditLogItem, AuditVerificationResult } from '../types';
import { api } from '../services/api';
import { Badge } from '../components/Common/Badge';
import { Modal } from '../components/Common/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Integrity Check State
  const [verificationResult, setVerificationResult] = useState<AuditVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTampering, setIsTampering] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  const { hasRole } = useAuth();
  const { success, error, warning } = useToast();

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.listAuditLogs({
        search: searchQuery.trim() || undefined,
        event_type: selectedEventType || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch (err: any) {
      error('Failed to load audit logs', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedEventType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    try {
      const result = await api.verifyAuditIntegrity();
      setVerificationResult(result);
      if (result.is_valid) {
        success('Audit Chain Verified', `All ${result.total_blocks_checked} blocks cryptographically intact.`);
      } else {
        error('Integrity Violation Detected', result.message);
      }
    } catch (err: any) {
      error('Verification Failed', err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    setIsTampering(true);
    try {
      const res = await api.simulateTamper();
      warning('Tamper Attack Simulated', res.message);
      await loadLogs();
      // Auto-trigger verification to demonstrate detection
      const verifyRes = await api.verifyAuditIntegrity();
      setVerificationResult(verifyRes);
    } catch (err: any) {
      error('Simulation Failed', err.message);
    } finally {
      setIsTampering(false);
    }
  };

  const handleRepairChain = async () => {
    setIsRepairing(true);
    try {
      const res = await api.repairAuditChain();
      success('Chain Repaired', res.message);
      await loadLogs();
      const verifyRes = await api.verifyAuditIntegrity();
      setVerificationResult(verifyRes);
    } catch (err: any) {
      error('Repair Failed', err.message);
    } finally {
      setIsRepairing(false);
    }
  };

  const canTamperOrRepair = hasRole(['ADMIN', 'AUDITOR']);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            Tamper-Evident Audit Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Sequential SHA-256 hash-chaining guarantees immutable proof of institutional custody operations.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs shadow-glow-blue disabled:opacity-50 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isVerifying ? 'Verifying Chain...' : 'Verify Chain Integrity'}</span>
          </button>

          {canTamperOrRepair && (
            <>
              <button
                onClick={handleSimulateTamper}
                disabled={isTampering}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium transition-all"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Simulate Tamper</span>
              </button>

              <button
                onClick={handleRepairChain}
                disabled={isRepairing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-200 border border-navy-700 text-xs font-medium transition-all"
              >
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                <span>Restore Chain</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Verification Result Banner (if run) */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-4 text-xs animate-slide-down ${
            verificationResult.is_valid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.is_valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm text-white">
                {verificationResult.is_valid
                  ? 'Cryptographic Verification Passed'
                  : 'Integrity Violation Detected'}
              </div>
              <p className="mt-0.5">{verificationResult.message}</p>
              <div className="mt-1 font-mono text-[11px] opacity-80">
                Total blocks checked: {verificationResult.total_blocks_checked}
                {verificationResult.tampered_index !== null && (
                  <span> • Tampered Block Index: #{verificationResult.tampered_index}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, target, actor, or details..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-slate-300 focus:outline-none text-xs"
          >
            <option value="">All Event Types</option>
            <option value="GENESIS_BLOCK">GENESIS_BLOCK</option>
            <option value="SECRET_REGISTERED">SECRET_REGISTERED</option>
            <option value="SECRET_SPLIT_AND_DISTRIBUTED">SECRET_SPLIT_AND_DISTRIBUTED</option>
            <option value="RECOVERY_REQUESTED">RECOVERY_REQUESTED</option>
            <option value="CUSTODIAN_APPROVAL_SUBMITTED">CUSTODIAN_APPROVAL_SUBMITTED</option>
            <option value="SECRET_SUCCESSFULLY_RECOVERED">SECRET_SUCCESSFULLY_RECOVERED</option>
            <option value="AUTH_SUCCESS">AUTH_SUCCESS</option>
            <option value="AUTH_FAILURE">AUTH_FAILURE</option>
          </select>

          <button
            onClick={loadLogs}
            className="p-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 border border-navy-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-navy-700/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sequential Hash Chain</h3>
          <span className="text-xs text-slate-400">{logs.length} blocks rendered</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading immutable audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No matching audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-700/80 bg-navy-850/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action & Target</th>
                  <th className="py-3 px-4">Previous Block Hash</th>
                  <th className="py-3 px-4">Record SHA-256 Hash</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60 font-mono text-[11px]">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-navy-800/30 transition-colors font-sans">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-[10px] border border-blue-500/20 font-semibold">
                        {l.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-[11px] truncate max-w-[150px]">
                      {l.actor}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{l.action}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate max-w-[160px]">{l.target}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {l.prev_hash.substring(0, 10)}...
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-400 text-[11px]">
                      {l.record_hash.substring(0, 10)}...
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="px-2.5 py-1 rounded-lg bg-navy-750 hover:bg-navy-700 text-slate-200 border border-navy-650 text-xs"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Block Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Block: ${selectedLog.id}`}
          subtitle={`Event: ${selectedLog.event_type} • Timestamp: ${selectedLog.timestamp}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-navy-850 border border-navy-700">
              <div>
                <span className="text-slate-400">Actor:</span>
                <p className="font-semibold text-white font-mono mt-0.5">{selectedLog.actor}</p>
              </div>
              <div>
                <span className="text-slate-400">Action:</span>
                <p className="font-semibold text-white mt-0.5">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-slate-400">Target Resource:</span>
                <p className="font-mono text-slate-300 mt-0.5">{selectedLog.target}</p>
              </div>
              <div>
                <span className="text-slate-400">Integrity Link:</span>
                <p className="font-mono text-emerald-400 mt-0.5">SHA-256 Chained</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">prev_hash: </span>
                <span className="text-slate-400">{selectedLog.prev_hash}</span>
              </div>
              <div>
                <span className="text-slate-500">record_hash: </span>
                <span className="text-blue-400 font-semibold">{selectedLog.record_hash}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Sanitized Audit Event Details:</span>
              <pre className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
