import React from 'react';
import {
  LayoutDashboard,
  KeyRound,
  Split,
  Users2,
  GitPullRequestDraft,
  ShieldCheck,
  Sliders,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type PageId =
  | 'overview'
  | 'vault'
  | 'split'
  | 'custodians'
  | 'recovery'
  | 'audit'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenGuidedDemo: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onOpenGuidedDemo,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { user } = useAuth();

  const navItems: { id: PageId; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'vault', label: 'Secret Vault', icon: KeyRound },
    { id: 'split', label: 'Split Secret', icon: Split },
    { id: 'custodians', label: 'Custodians', icon: Users2 },
    { id: 'recovery', label: 'Recovery Requests', icon: GitPullRequestDraft },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
    { id: 'settings', label: 'Security Settings', icon: Sliders },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-900 border-r border-navy-700/60 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-navy-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center shadow-glow-blue">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              Threshold<span className="text-blue-400">Vault</span>
            </div>
            <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              Institutional SSS
            </div>
          </div>
        </div>

        {/* Academic Demo Warning Banner */}
        <div className="mx-4 my-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
          <span className="font-medium text-[11px]">Academic Prototype</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 font-mono">GF(2^8)</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700 text-slate-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Guided Demo Launch Card */}
        <div className="p-4 border-t border-navy-700/60 bg-navy-850/40">
          <button
            onClick={onOpenGuidedDemo}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium text-xs hover:from-violet-500 hover:to-blue-500 shadow-glow-violet transition-all duration-200"
          >
            <Sparkles className="w-4 h-4 text-violet-200 animate-spin-slow" />
            <span>Guided Scenarios (A-G)</span>
          </button>
        </div>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-navy-700/60 bg-navy-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-navy-700 border border-navy-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Loading...'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.role || 'CUSTODIAN'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
