import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/Layout/Sidebar';
import type { PageId } from './components/Layout/Sidebar';
import { Navbar } from './components/Layout/Navbar';
import { GuidedScenariosModal } from './components/Demo/GuidedScenariosModal';

import { Overview } from './pages/Overview';
import { SecretVault } from './pages/SecretVault';
import { SplitSecret } from './pages/SplitSecret';
import { Custodians } from './pages/Custodians';
import { RecoveryRequests } from './pages/RecoveryRequests';
import { AuditLogs } from './pages/AuditLogs';
import { SecuritySettings } from './pages/SecuritySettings';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [isGuidedDemoOpen, setIsGuidedDemoOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getPageTitle = (page: PageId): string => {
    switch (page) {
      case 'overview':
        return 'Institutional Custody Overview';
      case 'vault':
        return 'Secret Vault Registry';
      case 'split':
        return 'Shamir Secret Sharing Engine';
      case 'custodians':
        return 'Custodian Management';
      case 'recovery':
        return 'Recovery Request Quorum Console';
      case 'audit':
        return 'Tamper-Evident Audit Ledger';
      case 'settings':
        return 'Security Policy Configuration';
      default:
        return 'ThresholdVault';
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <Overview onNavigate={setCurrentPage} onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)} />;
      case 'vault':
        return <SecretVault />;
      case 'split':
        return <SplitSecret />;
      case 'custodians':
        return <Custodians />;
      case 'recovery':
        return <RecoveryRequests />;
      case 'audit':
        return <AuditLogs />;
      case 'settings':
        return <SecuritySettings />;
      default:
        return <Overview onNavigate={setCurrentPage} onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* Background Subtle Gradient Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.08),rgba(255,255,255,0))]" />

      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <Navbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenGuidedDemo={() => setIsGuidedDemoOpen(true)}
          currentPageTitle={getPageTitle(currentPage)}
        />

        {/* Page Content View */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {renderPage()}
        </main>

        {/* Institutional Footer */}
        <footer className="border-t border-navy-800/80 bg-navy-900/40 py-4 px-6 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">ThresholdVault</span>
            <span>•</span>
            <span>Institutional Key Custody Prototype</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-blue-400">GF(2^8) SSS Engine</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Synthetic Demonstration Data • Not Production Certified
          </div>
        </footer>
      </div>

      {/* Guided Demonstration Modal */}
      <GuidedScenariosModal
        isOpen={isGuidedDemoOpen}
        onClose={() => setIsGuidedDemoOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
