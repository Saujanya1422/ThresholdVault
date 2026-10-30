import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Shield,
  Eye,
  Lock,
  Download,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Calendar,
  Building2,
  RefreshCw,
} from 'lucide-react';
import type { SecretItem, CustodianShareCard, SplitResultResponse } from '../types';
import { api } from '../services/api';
import { Badge } from '../components/Common/Badge';
import { Modal } from '../components/Common/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SecretVault: React.FC = () => {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedSecretShares, setSelectedSecretShares] = useState<CustodianShareCard[] | null>(null);
  const [inspectSecretName, setInspectSecretName] = useState('');
  const [splitResult, setSplitResult] = useState<SplitResultResponse | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [institution, setInstitution] = useState('Metropolitan Reserve & Custody Corp');
  const [department, setDepartment] = useState('Treasury Operations');
  const [purpose, setPurpose] = useState('Master Wholesale Signing Key');
  const [threshold, setThreshold] = useState(3);
  const [totalShares, setTotalShares] = useState(5);
  const [isEducationalMode, setIsEducationalMode] = useState(false);
  const [customSecret, setCustomSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hasRole, user } = useAuth();
  const { success, error, warning } = useToast();

  const loadSecrets = async () => {
    setIsLoading(true);
    try {
      const data = await api.listSecrets();
      setSecrets(data);
    } catch (e: any) {
      error('Failed to load secrets', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (threshold > totalShares) {
      warning('Invalid Policy', 'Threshold k cannot exceed total shares n.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.registerAndSplitSecret({
        name,
        description,
        institution,
        department,
        purpose,
        threshold,
        total_shares: totalShares,
        custom_secret: isEducationalMode ? customSecret : undefined,
      });

      setSplitResult(result);
      setIsRegisterOpen(false);
      success('Secret Registered & Split', `Successfully generated ${result.total_shares} Shamir shares.`);
      loadSecrets();

      // Reset form
      setName('');
      setDescription('');
      setCustomSecret('');
    } catch (err: any) {
      error('Registration Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInspectShares = async (secret: SecretItem) => {
    setInspectSecretName(secret.name);
    try {
      const shares = await api.getCustodianShares(secret.id);
      setSelectedSecretShares(shares);
    } catch (err: any) {
      error('Failed to load shares metadata', err.message);
    }
  };

  const downloadShareFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a);
    success('Share Exported', `Downloaded ${filename}`);
  };

  const canRegister = hasRole(['ADMIN', 'SECURITY_OFFICER']);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-400" />
            Institutional Secret Vault
          </h2>
          <p className="text-xs text-slate-400">
            Registered cryptographic assets protected via finite-field Shamir Secret Sharing over GF(2^8).
          </p>
        </div>

        {canRegister && (
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs shadow-glow-blue transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register & Split Secret</span>
          </button>
        )}
      </div>

      {/* Educational Notice Banner */}
      <div className="p-4 rounded-xl bg-navy-850/70 border border-navy-700 flex items-start gap-3 text-xs text-slate-300">
        <Lock className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-white">Cryptographic Zero-Knowledge Storage: </span>
          The ThresholdVault database stores zero plaintext secrets. Only a protected SHA-256 verification digest is persisted.
          All custodian shares are encrypted-at-rest with AES-256-GCM.
        </div>
      </div>

      {/* Secrets Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-navy-700/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Registered Master Keys</h3>
          <span className="text-xs text-slate-400">{secrets.length} total records</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading secrets registry...</div>
        ) : secrets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No cryptographic secrets registered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-700/80 bg-navy-850/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Secret Name</th>
                  <th className="py-3 px-4">Department & Purpose</th>
                  <th className="py-3 px-4">Threshold Policy</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification SHA-256 Digest</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {secrets.map((sec) => (
                  <tr key={sec.id} className="hover:bg-navy-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                        <span>{sec.name}</span>
                      </div>
                      {sec.description && (
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">{sec.description}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div>{sec.department}</div>
                      <div className="text-[11px] text-slate-500">{sec.purpose}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono text-[11px] border border-blue-500/20 font-semibold">
                        {sec.threshold}-of-{sec.total_shares}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          sec.status === 'SPLIT'
                            ? 'blue'
                            : sec.status === 'RECOVERED'
                            ? 'emerald'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {sec.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {sec.verification_hash.substring(0, 16)}...
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleInspectShares(sec)}
                        className="px-2.5 py-1 rounded-lg bg-navy-750 hover:bg-navy-700 text-slate-200 border border-navy-650 transition-colors text-xs"
                      >
                        Custody Shares
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Secret Registration Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register & Split Institutional Secret"
        subtitle="Generates polynomial shares over GF(2^8) and assigns custody."
        maxWidth="lg"
      >
        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Secret Asset Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Wholesale Payment Signing Key 2026"
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Department *</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Secret Purpose *</label>
              <input
                type="text"
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational context, disaster recovery procedure ref..."
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Policy Preset Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-2">Threshold Policy (k-of-n)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 2, n: 3, label: '2-of-3 (Light)' },
                { k: 3, n: 5, label: '3-of-5 (Standard)' },
                { k: 4, n: 7, label: '4-of-7 (Enterprise)' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => {
                    setThreshold(p.k);
                    setTotalShares(p.n);
                  }}
                  className={`p-2 rounded-xl border text-center transition-colors ${
                    threshold === p.k && totalShares === p.n
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                      : 'bg-navy-950 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-slate-400">Custom Threshold:</span>
              <input
                type="number"
                min={1}
                max={totalShares}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 rounded bg-navy-950 border border-navy-700 text-center text-white"
              />
              <span className="text-slate-400">of</span>
              <input
                type="number"
                min={threshold}
                max={16}
                value={totalShares}
                onChange={(e) => setTotalShares(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 rounded bg-navy-950 border border-navy-700 text-center text-white"
              />
              <span className="text-slate-400">Custodians</span>
            </div>
          </div>

          {/* Educational Mode Toggle */}
          <div className="pt-2 border-t border-navy-750">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Educational Mode: Custom Test Secret</span>
              <input
                type="checkbox"
                checked={isEducationalMode}
                onChange={(e) => setIsEducationalMode(e.target.checked)}
                className="rounded border-navy-700 bg-navy-950 text-blue-600"
              />
            </div>
            {isEducationalMode ? (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={customSecret}
                  onChange={(e) => setCustomSecret(e.target.value)}
                  placeholder="Enter custom demo secret string..."
                  className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-amber-500/40 text-amber-200 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-amber-400/80">
                  Warning: Custom secret mode is for pedagogical demonstration only.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                Default: A 256-bit cryptographically secure random key (CSPRNG) will be generated.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-750">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 hover:bg-navy-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium shadow-glow-blue disabled:opacity-50"
            >
              {isSubmitting ? 'Splitting...' : 'Split & Distribute'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Share Export Modal (Shown Immediately After Splitting) */}
      {splitResult && (
        <Modal
          isOpen={true}
          onClose={() => setSplitResult(null)}
          title="Shamir Shares Generated Successfully"
          subtitle={`Policy: ${splitResult.threshold}-of-${splitResult.total_shares} SSS over GF(2^8)`}
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{splitResult.message}</span>
            </div>

            <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 font-mono text-[11px]">
              <span className="text-slate-400">Verification Hash: </span>
              <span className="text-blue-300 font-semibold">{splitResult.verification_hash}</span>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-white">Controlled One-Time Custodian Share Export:</h4>
              <p className="text-slate-400 text-[11px]">
                In institutional custody, each share is delivered exclusively to its assigned custodian.
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {splitResult.shares.map((sh) => (
                  <div
                    key={sh.custodian_id}
                    className="p-3 rounded-xl bg-navy-850 border border-navy-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        Share #{sh.x}: {sh.custodian_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{sh.custodian_email}</div>
                      <div className="text-[10px] text-slate-500 font-mono">CRC32: {sh.checksum}</div>
                    </div>
                    <button
                      onClick={() => downloadShareFile(sh.download_filename, sh.armored_share)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .key</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Custody Shares Inspector Modal */}
      {selectedSecretShares && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSecretShares(null)}
          title={`Custody Distribution: ${inspectSecretName}`}
          subtitle="Custodian Ring Status & Share Allocation"
          maxWidth="lg"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-400">
              Plaintext shares are protected. Only authenticated custodians can access their individual allocated share.
            </p>

            <div className="divide-y divide-navy-750 border border-navy-700 rounded-xl overflow-hidden bg-navy-850">
              {selectedSecretShares.map((sc) => (
                <div key={sc.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>Share #{sc.share_x}: {sc.custodian_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Status: {sc.distribution_status} • Checksum: {sc.checksum}
                    </div>
                  </div>
                  {sc.armored_token ? (
                    <button
                      onClick={() =>
                        downloadShareFile(`tv_share_custodian_${sc.share_x}.key`, sc.armored_token!)
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export My Share</span>
                    </button>
                  ) : (
                    <Badge variant="slate" size="sm">
                      Encrypted-at-Rest
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
