import React, { useState } from 'react';
import { UserCheck, ChevronDown, Check, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../Common/Badge';

export const RoleSwitcher: React.FC = () => {
  const { user, demoAccounts, switchPersona } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'rose';
      case 'SECURITY_OFFICER':
        return 'violet';
      case 'AUDITOR':
        return 'amber';
      case 'CUSTODIAN':
      default:
        return 'blue';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-navy-700 bg-navy-850/80 hover:bg-navy-800 transition-colors text-xs"
      >
        <Shield className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-slate-300">Identity:</span>
        <span className="font-semibold text-white truncate max-w-[140px]">
          {user?.full_name || 'Select Identity'}
        </span>
        {user && (
          <Badge variant={getRoleVariant(user.role) as any} size="sm">
            {user.role}
          </Badge>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-navy-900 border border-navy-700 shadow-2xl z-40 p-2 overflow-hidden animate-slide-down">
            <div className="px-3 py-2 border-b border-navy-800 mb-1">
              <p className="text-xs font-semibold text-white">Switch Demo Institutional Persona</p>
              <p className="text-[11px] text-slate-400">Instantly test RBAC permissions & multi-custodian quorums</p>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {demoAccounts.map((acc) => {
                const isSelected = user?.email === acc.email;
                return (
                  <button
                    key={acc.email}
                    onClick={() => {
                      switchPersona(acc.email);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                        : 'hover:bg-navy-800 text-slate-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white flex items-center gap-2">
                        {acc.full_name}
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="text-[11px] text-slate-400">{acc.department}</div>
                    </div>
                    <Badge variant={getRoleVariant(acc.role) as any} size="sm">
                      {acc.role}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
