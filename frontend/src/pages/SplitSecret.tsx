import React, { useState } from 'react';
import {
  Split,
  Shield,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  Copy,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import type { SplitResultResponse } from '../types';
import { Badge } from '../components/Common/Badge';
import { useToast } from '../context/ToastContext';

export const SplitSecret: React.FC = () => {
  const [name, setName] = useState('Institutional Master Seed');
  const [department, setDepartment] = useState('Treasury Operations');
  const [purpose, setPurpose] = useState('Master Backup Shard');
  const [threshold, setThreshold] = useState(3);
  const [totalShares, setTotalShares] = useState(5);
  const [secretInput, setSecretInput] = useState('');
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitResult, setSplitResult] = useState<SplitResultResponse | null>(null);

  const { success, error } = useToast();

  const handleSplit = async () => {
    if (threshold > totalShares) {
      error('Invalid Policy', 'Threshold k cannot exceed total shares n.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.registerAndSplitSecret({
        name,
        department,
        institution: 'Metropolitan Reserve & Custody Corp',
        purpose,
        threshold,
        total_shares: totalShares,
        custom_secret: !isGeneratingRandom && secretInput.trim() ? secretInput.trim() : undefined,
      });
      setSplitResult(res);
      success('Secret Split Complete', `Generated ${res.total_shares} valid Shamir shares.`);
    } catch (err: any) {
      error('Splitting Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    success('Copied', `${label} copied to clipboard`);
  };

  const downloadShare = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a);
    success('Downloaded', filename);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Split className="w-5 h-5 text-blue-400" />
          Interactive Shamir Secret Sharing Engine
        </h2>
        <p className="text-xs text-slate-400">
          Split institutional cryptographic keys into distributed threshold polynomial shares over Galois Field GF(2^8).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-navy-700/60 pb-3">
            <h3 className="text-sm font-semibold text-white">Threshold Parameters & Key Material</h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono">
              Field: GF(2^8) (mod 0x11B)
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Key Description / Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Threshold & Total Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-navy-850/60 border border-navy-750">
              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-300">Threshold (k):</span>
                  <span className="text-blue-400 font-mono font-bold text-sm">{threshold}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={totalShares}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-[11px] text-slate-500">Minimum shares required for Lagrange reconstruction</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-300">Total Shares (n):</span>
                  <span className="text-violet-400 font-mono font-bold text-sm">{totalShares}</span>
                </div>
                <input
                  type="range"
                  min={threshold}
                  max={10}
                  value={totalShares}
                  onChange={(e) => setTotalShares(parseInt(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[11px] text-slate-500">Total custodians in the institutional custody ring</p>
              </div>
            </div>

            {/* Secret Generation Mode */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-medium">Secret Key Input Mode</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsGeneratingRandom(true)}
                  className={`flex-1 py-2 rounded-xl border text-center transition-colors ${
                    isGeneratingRandom
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                      : 'bg-navy-950 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  CSPRNG 256-bit Key (Secure)
                </button>
                <button
                  type="button"
                  onClick={() => setIsGeneratingRandom(false)}
                  className={`flex-1 py-2 rounded-xl border text-center transition-colors ${
                    !isGeneratingRandom
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-navy-950 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Custom Secret (Pedagogical)
                </button>
              </div>

              {!isGeneratingRandom && (
                <div className="mt-2 space-y-1">
                  <input
                    type="text"
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                    placeholder="Enter custom test secret (e.g. MyConfidentialMasterSeed2026)"
                    className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-amber-500/40 text-amber-200 font-mono focus:outline-none"
                  />
                  <p className="text-[11px] text-amber-400/80">
                    Custom secrets are accepted for interactive educational exploration.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleSplit}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-xs shadow-glow-blue disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'Evaluating Polynomials over GF(2^8)...' : 'Split Secret into Shares'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Mathematical & Security Properties */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between space-y-4 text-xs">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" />
              Cryptographic Guarantees
            </h3>

            <div className="space-y-3 text-slate-300">
              <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-1">
                <span className="text-[11px] font-semibold text-white">Polynomial Degree:</span>
                <p className="font-mono text-blue-400">d = k - 1 = {threshold - 1}</p>
                <p className="text-[11px] text-slate-400">
                  Degree-{threshold - 1} polynomial requires exactly {threshold} distinct coordinate pairs (x, y) to interpolate.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-1">
                <span className="text-[11px] font-semibold text-white">Information Theoretic Security:</span>
                <p className="text-[11px] text-slate-400">
                  Any coalition of <span className="text-amber-400 font-mono">{threshold - 1}</span> or fewer custodians
                  gains strictly zero mathematical advantage toward discovering the secret.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 space-y-1">
                <span className="text-[11px] font-semibold text-white">Share Armor & Checksums:</span>
                <p className="text-[11px] text-slate-400">
                  Shares are armored with CRC32 integrity checksums and unique UUID bindings to prevent share substitution attacks.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px]">
            <span className="font-semibold">Institutional Note: </span>
            Shares are held encrypted-at-rest. The recovery phase requires authenticated custodian approval plus share contribution.
          </div>
        </div>
      </div>

      {/* Generated Shares Display */}
      {splitResult && (
        <div className="glass-card p-6 rounded-2xl space-y-4 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-700/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Generated SSS Shares ({splitResult.threshold}-of-{splitResult.total_shares})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verification SHA-256 Digest: <span className="font-mono text-blue-400">{splitResult.verification_hash}</span>
              </p>
            </div>
            <Badge variant="emerald" size="sm">
              GF(2^8) Split Complete
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {splitResult.shares.map((sh) => (
              <div
                key={sh.custodian_id}
                className="p-4 rounded-xl bg-navy-850/80 border border-navy-700 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Custodian #{sh.x}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-mono">
                    x = {sh.x}
                  </span>
                </div>

                <div>
                  <div className="text-white font-medium">{sh.custodian_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">{sh.custodian_email}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">CRC32: {sh.checksum}</div>
                </div>

                <div className="p-2 rounded bg-navy-950 border border-navy-800 font-mono text-[10px] text-slate-400 truncate">
                  {sh.armored_share}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => copyToClipboard(sh.armored_share, `Share #${sh.x}`)}
                    className="flex-1 py-1.5 rounded-lg bg-navy-750 hover:bg-navy-700 text-slate-200 border border-navy-650 flex items-center justify-center gap-1 text-[11px]"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={() => downloadShare(sh.download_filename, sh.armored_share)}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center gap-1 text-[11px] font-medium"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
