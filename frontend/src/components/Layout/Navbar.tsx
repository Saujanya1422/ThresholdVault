import React from 'react';
import { Menu, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { RoleSwitcher } from './RoleSwitcher';
import { Badge } from '../Common/Badge';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  onOpenGuidedDemo: () => void;
  currentPageTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileMenu,
  onOpenGuidedDemo,
  currentPageTitle,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-navy-900/80 backdrop-blur-md border-b border-navy-700/60 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            {currentPageTitle}
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Institutional Cryptographic Key Custody and Recovery
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* SSS Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-navy-850 border border-navy-700 text-xs text-slate-300">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-emerald-400">Finite Field GF(2^8) Active</span>
        </div>

        {/* Guided Demo button */}
        <button
          onClick={onOpenGuidedDemo}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Demo Scenarios</span>
        </button>

        {/* Demo Persona Switcher */}
        <RoleSwitcher />
      </div>
    </header>
  );
};
