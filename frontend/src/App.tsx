import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HotkeysModal } from './components/HotkeysModal';
import { DashboardView } from './views/DashboardView';
import { ChartOfAccountsView } from './views/ChartOfAccountsView';
import { JournalVoucherFormView } from './views/JournalVoucherFormView';
import { InvoicesView } from './views/InvoicesView';
import { BillsView } from './views/BillsView';
import { BankingView } from './views/BankingView';
import { ReportsView } from './views/ReportsView';
import { AuditAndSecurityView } from './views/AuditAndSecurityView';
import { DataHubView } from './views/DataHubView';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import './App.css';

const Toast: React.FC = () => {
  const { toast } = useAuth();
  if (!toast) return null;

  return (
    <div className={`toast ${toast.type}`}>
      {toast.type === 'success' && <CheckCircle2 size={18} style={{ color: '#34d399' }} />}
      {toast.type === 'error' && <AlertCircle size={18} style={{ color: '#f87171' }} />}
      {toast.type === 'warning' && <AlertTriangle size={18} style={{ color: '#fbbf24' }} />}
      <span>{toast.message}</span>
    </div>
  );
};

const MainContent: React.FC = () => {
  const { activeTab, sidebarOpen, toggleSidebar } = useAuth();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'coa': return <ChartOfAccountsView />;
      case 'voucher': return <JournalVoucherFormView />;
      case 'invoices': return <InvoicesView />;
      case 'bills': return <BillsView />;
      case 'banking': return <BankingView />;
      case 'reports': return <ReportsView />;
      case 'datahub': return <DataHubView />;
      case 'audit': return <AuditAndSecurityView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className={`app-container${sidebarOpen ? ' sidebar-mobile-open' : ''}`}>
      {/* Mobile overlay backdrop – clicking it closes the sidebar */}
      <div className="sidebar-overlay" onClick={toggleSidebar} />
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="content-body">
          {renderActiveView()}
        </main>
      </div>
      <MobileBottomNav />
      <HotkeysModal />
      <Toast />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <MainContent />
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;
