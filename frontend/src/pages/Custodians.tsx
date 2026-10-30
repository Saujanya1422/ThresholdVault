import React, { useEffect, useState } from 'react';
import {
  Users2,
  UserPlus,
  Shield,
  Key,
  Building,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
} from 'lucide-react';
import type { CustodianItem, CustodianStatus } from '../types';
import { api } from '../services/api';
import { Badge } from '../components/Common/Badge';
import { Modal } from '../components/Common/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const Custodians: React.FC = () => {
  const [custodians, setCustodians] = useState<CustodianItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCustodian, setEditCustodian] = useState<CustodianItem | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Treasury Operations');
  const [roleTitle, setRoleTitle] = useState('VP of Key Operations');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hasRole } = useAuth();
  const { success, error } = useToast();

  const loadCustodians = async () => {
    setIsLoading(true);
    try {
      const data = await api.listCustodians();
      setCustodians(data);
    } catch (err: any) {
      error('Failed to load custodians', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustodians();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createCustodian({
        full_name: fullName,
        institutional_email: email,
        department,
        role_title: roleTitle,
      });
      success('Custodian Created', `Added ${fullName} to institutional custody registry.`);
      setIsCreateOpen(false);
      setFullName('');
      setEmail('');
      loadCustodians();
    } catch (err: any) {
      error('Creation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (custodian: CustodianItem) => {
    const nextStatus: CustodianStatus =
      custodian.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.updateCustodian(custodian.id, { status: nextStatus });
      success('Status Updated', `${custodian.full_name} is now ${nextStatus}.`);
      loadCustodians();
    } catch (err: any) {
      error('Update Failed', err.message);
    }
  };

  const canManage = hasRole(['ADMIN', 'SECURITY_OFFICER']);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users2 className="w-5 h-5 text-blue-400" />
            Institutional Key Custodians
          </h2>
          <p className="text-xs text-slate-400">
            Authorized participants in the threshold quorum ring holding encrypted-at-rest Shamir secret shares.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs shadow-glow-blue transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Custodian</span>
          </button>
        )}
      </div>

      {/* Custodians Roster Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-navy-700/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Custodian Directory</h3>
          <span className="text-xs text-slate-400">{custodians.length} registered custodians</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading custodians directory...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-700/80 bg-navy-850/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Custodian</th>
                  <th className="py-3 px-4">Institutional Email</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">ED25519 Fingerprint</th>
                  <th className="py-3 px-4">Custody Shares</th>
                  <th className="py-3 px-4">Status</th>
                  {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {custodians.map((c) => (
                  <tr key={c.id} className="hover:bg-navy-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-navy-700 border border-navy-600 flex items-center justify-center text-[11px] font-bold text-blue-300">
                          {c.full_name.charAt(0)}
                        </div>
                        <span>{c.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                      {c.institutional_email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div>{c.department}</div>
                      <div className="text-[11px] text-slate-500">{c.role_title}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {c.public_key_fingerprint}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono text-[11px] border border-blue-500/20">
                        {c.assigned_shares_count} shares
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={c.status === 'ACTIVE' ? 'emerald' : 'rose'}
                        size="sm"
                        dot={c.status === 'ACTIVE'}
                      >
                        {c.status}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className={`px-2.5 py-1 rounded-lg border text-xs transition-colors font-medium ${
                            c.status === 'ACTIVE'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          {c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custodian Registration Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Institutional Custodian"
        subtitle="Adds an authorized participant with generated public-key credentials."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Jordan Hayes"
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Institutional Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. jhayes@thresholdvault.io"
              className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500 font-mono"
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
              <label className="block text-slate-300 font-medium mb-1">Role Title *</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-navy-950 border border-navy-750 text-[11px] text-slate-400">
            An ED25519 identity keypair fingerprint will be automatically derived for cryptographic signing.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-navy-750">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 hover:bg-navy-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium shadow-glow-blue disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Add Custodian'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
