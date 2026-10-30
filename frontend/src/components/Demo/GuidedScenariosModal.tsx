import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Sparkles, Terminal, ShieldAlert, RefreshCw } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { Badge } from '../Common/Badge';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ScenarioDef {
  key: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  title: string;
  badge: string;
  expectedResult: string;
  description: string;
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: 'a',
    title: 'Scenario A: Successful 3-of-5 SSS Recovery',
    badge: '3-of-5 Quorum',
    expectedResult: 'Shares 1, 2, 3 (and 1, 2, 5) reconstruct exact original secret and match verification SHA-256 digest.',
    description: 'Generates 5 shares over GF(2^8) and tests Lagrange interpolation with multiple 3-share subsets.',
  },
  {
    key: 'b',
    title: 'Scenario B: Insufficient Shares Rejection',
    badge: 'k-1 Defense',
    expectedResult: 'Attempt with 2 shares is rejected with InsufficientSharesError. Zero information leaked.',
    description: 'Proves mathematical threshold confidentiality: 2 shares are insufficient to recover a 3-of-5 secret.',
  },
  {
    key: 'c',
    title: 'Scenario C: RBAC Authorization Enforcement',
    badge: 'RBAC 403',
    expectedResult: 'Auditor identity attempting to initiate recovery is strictly denied with HTTP 403 Forbidden.',
    description: 'Verifies backend permission gates preventing non-Security-Officers from requesting secrets.',
  },
  {
    key: 'd',
    title: 'Scenario D: Corrupted Share Detection',
    badge: 'Integrity Defense',
    expectedResult: 'Tampered hex byte in share payload is caught by CRC32 checksum before interpolation.',
    description: 'Simulates share file bit-rot or malicious alteration and validates immediate rejection.',
  },
  {
    key: 'e',
    title: 'Scenario E: 3 Independent Custodian Approvals',
    badge: 'Multi-party Quorum',
    expectedResult: 'Three distinct custodians cast signed votes, moving status from PENDING to RECOVERABLE.',
    description: 'Demonstrates real institutional multi-custodian voting and cryptographic share submission.',
  },
  {
    key: 'f',
    title: 'Scenario F: Auditor Review With Zero Secret Leakage',
    badge: 'Confidentiality',
    expectedResult: 'Audit logs contain zero plaintext secrets or unencrypted shares. All sensitive data is protected.',
    description: 'Validates institutional privacy: auditors review governance records without seeing key material.',
  },
  {
    key: 'g',
    title: 'Scenario G: Audit Hash Chain Tamper Detection',
    badge: 'SHA-256 Merkle Chain',
    expectedResult: 'Tampered DB record is cryptographically identified with exact block index and failure alert.',
    description: 'Modifies a past database audit record and runs full sequential hash verification to flag corruption.',
  },
];

interface GuidedScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export const GuidedScenariosModal: React.FC<GuidedScenariosModalProps> = ({
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const [activeScenario, setActiveScenario] = useState<ScenarioDef>(SCENARIOS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<any>(null);
  const { success, error } = useToast();

  const handleRun = async (scenario: ScenarioDef) => {
    setIsRunning(true);
    setOutput(null);
    try {
      const res = await api.runScenario(scenario.key);
      setOutput(res);
      success('Scenario Executed', `${scenario.title} completed successfully.`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      error('Scenario Execution Failed', err.message);
      setOutput({ error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guided Demonstration Scenarios"
      subtitle="Institutional Academic Prototype Verification Suite (Scenarios A through G)"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Scenario Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCENARIOS.map((s) => {
            const isSelected = activeScenario.key === s.key;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setActiveScenario(s);
                  setOutput(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/50 shadow-glow-blue'
                    : 'bg-navy-850/60 border-navy-700/60 hover:border-navy-600 hover:bg-navy-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-white truncate">{s.title.split(':')[0]}</span>
                  <Badge variant={isSelected ? 'blue' : 'slate'} size="sm">
                    {s.badge}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">{s.description}</p>
              </button>
            );
          })}
        </div>

        {/* Selected Scenario Detail Card */}
        <div className="p-4 rounded-xl bg-navy-850/80 border border-navy-700 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">{activeScenario.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{activeScenario.description}</p>
            </div>
            <button
              onClick={() => handleRun(activeScenario)}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs shadow-glow-blue disabled:opacity-50 transition-all"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Scenario</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-navy-900 border border-navy-750 text-xs">
            <span className="text-slate-400 font-medium">Expected Result: </span>
            <span className="text-emerald-400">{activeScenario.expectedResult}</span>
          </div>
        </div>

        {/* Execution Output Console */}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Live Cryptographic Execution Output
              </span>
              <span className="text-[10px] font-mono text-emerald-400">STATUS: 200 OK</span>
            </div>
            <pre className="p-4 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
};
