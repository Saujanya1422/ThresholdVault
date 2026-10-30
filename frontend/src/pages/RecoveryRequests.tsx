import React, { useEffect, useState } from 'react';
import {
  GitPullRequestDraft,
  Plus,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  Play,
  Lock,
  Unlock,
  Key,
} from 'lucide-react';
import type {
  RecoveryRequestItem,
  SecretItem,
  ApprovalDecision,
} from '../types';
import { api } from '../services/api';
import { Badge } from '../components/Common/Badge';
import { Modal } from '../components/Common/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const RecoveryRequests: React.FC = () => {
  const [requests, setRequests] = useState<RecoveryRequestItem[]>([]);
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RecoveryRequestItem | null>(null);

  // New Request Form
  const [selectedSecretId, setSelectedSecretId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [businessJustification, setBusinessJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custodian Vote Form
  const [voteDecision, setVoteDecision] = useState<ApprovalDecision>('APPROVED');
  const [voteComment, setVoteComment] = useState('');
  const [armoredShareInput, setArmoredShareInput] = useState('');
  const [useEncryptedVaultShare, setUseEncryptedVaultShare] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  // Reconstruction Result
  const [reconstructionResult, setReconstructionResult] = useState<any>(null);
  const [revealSecretToggle, setRevealSecretToggle] = useState(false);

  const { user, hasRole } = useAuth();
  const { success, error, warning } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reqData, secData] = await Promise.all([
        api.listRecoveryRequests(),
        api.listSecrets(),
      ]);
      setRequests(reqData);
      setSecrets(secData);
      if (secData.length > 0 && !selectedSecretId) {
        setSelectedSecretId(secData[0].id);
      }
    } catch (err: any) {
      error('Failed to load recovery requests', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSecretId || !ticketId || !businessJustification) {
      warning('Missing Fields', 'Please provide secret, ticket ID, and business justification.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newReq = await api.createRecoveryRequest({
        secret_id: selectedSecretId,
        ticket_id: ticketId,
        business_justification: businessJustification,
      });
      success('Recovery Request Created', `Ticket ${newReq.ticket_id} initialized with PENDING quorum.`);
      setIsInitiateOpen(false);
      setTicketId('');
      setBusinessJustification('');
      loadData();
    } catch (err: any) {
      error('Initiation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (req: RecoveryRequestItem) => {
    setIsVoting(true);
    try {
      await api.approveRecovery(req.id, {
        decision: voteDecision,
        comment: voteComment || `Vote recorded by ${user?.full_name}`,
        armored_share: !useEncryptedVaultShare && armoredShareInput.trim() ? armoredShareInput.trim() : undefined,
      });
      success('Vote Recorded', 'Your cryptographic approval and share contribution have been logged.');
      setVoteComment('');
      setArmoredShareInput('');
      await loadData();
      // Update selected modal if open
      const updated = await api.getRecoveryRequest(req.id);
      setSelectedRequest(updated);
    } catch (err: any) {
      error('Vote Failed', err.message);
    } finally {
      setIsVoting(false);
    }
  };

  const handleExecute = async (req: RecoveryRequestItem) => {
    setIsVoting(true);
    try {
      const res = await api.executeRecovery(req.id, revealSecretToggle);
      setReconstructionResult(res);
      success('Recovery Executed', 'Shamir Lagrange interpolation succeeded; secret integrity verified!');
      await loadData();
      const updated = await api.getRecoveryRequest(req.id);
      setSelectedRequest(updated);
    } catch (err: any) {
      error('Reconstruction Failed', err.message);
    } finally {
      setIsVoting(false);
    }
  };

  const canInitiate = hasRole(['ADMIN', 'SECURITY_OFFICER']);
  const canVote = hasRole(['CUSTODIAN']);
  const canExecute = hasRole(['ADMIN', 'SECURITY_OFFICER']);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GitPullRequestDraft className="w-5 h-5 text-blue-400" />
            Institutional Secret Recovery Workflow
          </h2>
          <p className="text-xs text-slate-400">
            Multi-custodian threshold quorum: requires formal business justification, signed custodian approvals, and Shamir reconstruction.
          </p>
        </div>

        {canInitiate && (
          <button
            onClick={() => setIsInitiateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs shadow-glow-blue transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Initiate Recovery Request</span>
          </button>
        )}
      </div>

      {/* Requests List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-navy-700/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active & Historical Recovery Requests</h3>
          <span className="text-xs text-slate-400">{requests.length} requests</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading recovery workflows...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No secret recovery requests recorded.</div>
        ) : (
          <div className="divide-y divide-navy-800/60">
            {requests.map((r) => {
              const progressPct = Math.min(
                100,
                Math.round((r.shares_submitted_count / r.required_threshold) * 100)
              );
              const isRecoverable = r.status === 'RECOVERABLE';
              const isPending = r.status === 'PENDING';
              const isRecovered = r.status === 'RECOVERED';
              const isFailed = r.status === 'FAILED' || r.status === 'REJECTED';

              return (
                <div key={r.id} className="p-5 hover:bg-navy-850/40 transition-colors space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-white text-sm">{r.ticket_id}</span>
                        <Badge
                          variant={
                            isRecovered
                              ? 'emerald'
                              : isRecoverable
                              ? 'violet'
                              : isPending
                              ? 'blue'
                              : 'rose'
                          }
                          size="sm"
                          dot={isPending || isRecoverable}
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        Target Key: <span className="text-white">{r.secret_name}</span> ({r.secret_purpose})
                      </div>
                      <div className="text-xs text-slate-400">
                        Initiated by <span className="text-slate-200">{r.requested_by}</span> on{' '}
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRequest(r)}
                        className="px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-200 border border-navy-700 text-xs font-medium transition-colors"
                      >
                        Inspect Quorum
                      </button>
                    </div>
                  </div>

                  {/* Business Justification Card */}
                  <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800 text-xs text-slate-300">
                    <span className="text-slate-400 font-semibold">Business Justification: </span>
                    {r.business_justification}
                  </div>

                  {/* Quorum Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Custodian Quorum Progress: {r.shares_submitted_count} of {r.required_threshold} shares submitted
                      </span>
                      <span className="font-mono text-blue-400 font-bold">{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-navy-950 overflow-hidden border border-navy-800">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isRecovered
                            ? 'bg-emerald-500'
                            : isRecoverable
                            ? 'bg-gradient-to-r from-blue-500 to-violet-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Custodians Voting / Reconstruction Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>Approvals logged:</span>
                      <span className="font-semibold text-white">{r.approvals.length} recorded</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && canVote && (
                        <button
                          onClick={() => setSelectedRequest(r)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow-blue transition-all"
                        >
                          Cast Custodian Vote
                        </button>
                      )}

                      {isRecoverable && canExecute && (
                        <button
                          onClick={() => handleExecute(r)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white text-xs font-semibold shadow-glow-emerald transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Execute SSS Reconstruction</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quorum Inspection & Voting Modal */}
      {selectedRequest && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRequest(null)}
          title={`Recovery Quorum: ${selectedRequest.ticket_id}`}
          subtitle={`Key: ${selectedRequest.secret_name} • Required Threshold: ${selectedRequest.required_threshold}`}
          maxWidth="xl"
        >
          <div className="space-y-5 text-xs">
            {/* Status overview */}
            <div className="p-3.5 rounded-xl bg-navy-850 border border-navy-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Status:</span>
                <Badge variant="blue" size="sm">{selectedRequest.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Valid Shares Submitted:</span>
                <span className="font-mono text-white font-bold">
                  {selectedRequest.shares_submitted_count} / {selectedRequest.required_threshold}
                </span>
              </div>
            </div>

            {/* Custodian Voting Form (if eligible) */}
            {canVote && (selectedRequest.status === 'PENDING' || selectedRequest.status === 'RECOVERABLE') && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-400" />
                  Custodian Voting Console ({user?.full_name})
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoteDecision('APPROVED')}
                    className={`py-2 rounded-xl border text-center transition-colors ${
                      voteDecision === 'APPROVED'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-navy-950 border-navy-750 text-slate-400'
                    }`}
                  >
                    Authorize & Submit Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoteDecision('REJECTED')}
                    className={`py-2 rounded-xl border text-center transition-colors ${
                      voteDecision === 'REJECTED'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-300 font-bold'
                        : 'bg-navy-950 border-navy-750 text-slate-400'
                    }`}
                  >
                    Reject Recovery
                  </button>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Authorization Comment</label>
                  <input
                    type="text"
                    value={voteComment}
                    onChange={(e) => setVoteComment(e.target.value)}
                    placeholder="e.g. Identity verified via institutional dual-control protocol"
                    className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none"
                  />
                </div>

                {voteDecision === 'APPROVED' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Share Submission Mode:</span>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useEncryptedVaultShare}
                          onChange={(e) => setUseEncryptedVaultShare(e.target.checked)}
                          className="rounded border-navy-700 bg-navy-950 text-blue-600"
                        />
                        <span>Auto-load from Encrypted Custody Vault</span>
                      </label>
                    </div>

                    {!useEncryptedVaultShare && (
                      <textarea
                        rows={2}
                        value={armoredShareInput}
                        onChange={(e) => setArmoredShareInput(e.target.value)}
                        placeholder="Paste armored share: TVSHR:v1:..."
                        className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 font-mono text-[11px] text-white focus:outline-none"
                      />
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleVote(selectedRequest)}
                  disabled={isVoting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-glow-blue disabled:opacity-50"
                >
                  {isVoting ? 'Recording Decision...' : 'Submit Vote to Ledger'}
                </button>
              </div>
            )}

            {/* Recorded Custodian Decisions List */}
            <div className="space-y-2">
              <h4 className="font-semibold text-white">Custodian Approval Decisions:</h4>
              {selectedRequest.approvals.length === 0 ? (
                <div className="p-4 text-center text-slate-500 bg-navy-950 rounded-xl border border-navy-800">
                  No custodian votes submitted yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedRequest.approvals.map((appr) => (
                    <div
                      key={appr.id}
                      className="p-3 rounded-xl bg-navy-950 border border-navy-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white">{appr.custodian_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{appr.custodian_email}</div>
                        {appr.comment && (
                          <div className="text-[11px] text-slate-300 italic mt-0.5">"{appr.comment}"</div>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <Badge
                          variant={appr.decision === 'APPROVED' ? 'emerald' : 'rose'}
                          size="sm"
                        >
                          {appr.decision}
                        </Badge>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Share: {appr.share_submitted ? 'Submitted' : 'None'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reconstruct Secret (If Threshold Met) */}
            {selectedRequest.shares_submitted_count >= selectedRequest.required_threshold &&
              selectedRequest.status !== 'RECOVERED' &&
              canExecute && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-white">Threshold Quorum Satisfied</h4>
                      <p className="text-slate-400 text-[11px]">
                        All required shares collected. Authorized officer may trigger finite-field reconstruction.
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={revealSecretToggle}
                        onChange={(e) => setRevealSecretToggle(e.target.checked)}
                        className="rounded border-navy-700 bg-navy-950 text-emerald-600"
                      />
                      <span>Ephemeral Console Reveal</span>
                    </label>
                  </div>

                  <button
                    onClick={() => handleExecute(selectedRequest)}
                    disabled={isVoting}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-glow-emerald disabled:opacity-50"
                  >
                    {isVoting ? 'Interpolating over GF(2^8)...' : 'Execute Shamir Lagrange Reconstruction'}
                  </button>
                </div>
              )}

            {/* Reconstructed Result Box */}
            {reconstructionResult && (
              <div className="p-4 rounded-xl bg-navy-950 border border-emerald-500/50 space-y-2 animate-slide-up">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Secret Successfully Recovered & Verified</span>
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  Verification SHA-256 Digest: {reconstructionResult.verification_hash}
                </div>
                {reconstructionResult.ephemeral_recovered_secret && (
                  <div className="p-3 rounded-lg bg-navy-900 border border-navy-750 font-mono text-emerald-300 break-all">
                    <span className="text-slate-400">Recovered Value: </span>
                    {reconstructionResult.ephemeral_recovered_secret}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Initiation Modal */}
      <Modal
        isOpen={isInitiateOpen}
        onClose={() => setIsInitiateOpen(false)}
        title="Initiate Institutional Key Recovery"
        subtitle="Submits a formal disaster recovery request requiring custodian approvals."
        maxWidth="md"
      >
        <form onSubmit={handleInitiate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Target Cryptographic Secret *</label>
            <select
              value={selectedSecretId}
              onChange={(e) => setSelectedSecretId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
            >
              {secrets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.threshold}-of-{s.total_shares} policy)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Incident / Ticket Reference ID *</label>
            <input
              type="text"
              required
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. SEC-INC-2026-FAILOVER-01"
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Institutional Business Justification *</label>
            <textarea
              rows={3}
              required
              value={businessJustification}
              onChange={(e) => setBusinessJustification(e.target.value)}
              placeholder="Formal audit-logged justification: e.g. Primary HSM node hardware degradation requiring cold recovery..."
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-navy-750">
            <button
              type="button"
              onClick={() => setIsInitiateOpen(false)}
              className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 hover:bg-navy-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium shadow-glow-blue disabled:opacity-50"
            >
              {isSubmitting ? 'Initiating...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
