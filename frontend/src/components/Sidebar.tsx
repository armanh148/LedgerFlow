import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderTree,
  BookOpen,
  FileText,
  Receipt,
  Landmark,
  BarChart3,
  ShieldCheck,
  X,
  ChevronRight,
  Wallet,
  ArrowUpDown
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, sidebarOpen, toggleSidebar } = useAuth();

  const mainMenu = [
    { id: 'dashboard', label: 'Dashboard',        icon: LayoutDashboard },
    { id: 'voucher',   label: 'Vouchers & Tasks', icon: BookOpen },
    { id: 'coa',       label: 'Chart of Accounts',icon: FolderTree },
    { id: 'banking',   label: 'Bank & Accounts',  icon: Landmark },
  ];

  const managementMenu = [
    { id: 'invoices', label: 'Invoicing & AR',    icon: FileText },
    { id: 'bills',    label: 'Bills & Payables',  icon: Receipt },
    { id: 'reports',  label: 'Financial Reports', icon: BarChart3 },
    { id: 'datahub',  label: 'Import & Export Hub', icon: ArrowUpDown },
    { id: 'audit',    label: 'Audit & Security',  icon: ShieldCheck },
  ];

  const isMobileView = window.innerWidth <= 768;
  // On desktop: fully hide when closed. On mobile: always render (CSS slides it in/out)
  if (!sidebarOpen && !isMobileView) return null;


  const MenuItem = ({ item }: { item: { id: string; label: string; icon: any } }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const isMobile = window.innerWidth <= 768;
    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          if (isMobile) toggleSidebar(); // close drawer after nav on mobile
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: 'none',
          width: '100%',
          background: isActive ? 'rgba(249,115,22,0.15)' : 'transparent',
          color: isActive ? '#F97316' : '#9CA3AF',
          fontWeight: isActive ? 700 : 500,
          fontSize: '0.875rem',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLButtonElement).style.color = '#E5E7EB';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF';
          }
        }}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span style={{
            position: 'absolute',
            left: 0, top: '20%', bottom: '20%',
            width: '3px',
            borderRadius: '0 3px 3px 0',
            background: '#F97316',
          }} />
        )}
        <span style={{
          width: '32px', height: '32px',
          borderRadius: '8px',
          background: isActive ? 'rgba(249,115,22,0.20)' : 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }}>
          <Icon size={16} style={{ color: isActive ? '#F97316' : '#9CA3AF' }} />
        </span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {isActive && <ChevronRight size={14} style={{ color: '#F97316', opacity: 0.7 }} />}
      </button>
    );
  };

  return (
    <aside className="sidebar-drawer" style={{
      width: '248px',
      background: '#111827',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minHeight: '100vh',
      flexShrink: 0,
    }}>

      {/* Logo + Close Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(249,115,22,0.40)',
            flexShrink: 0,
          }}>
            <Wallet size={18} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600, letterSpacing: '0.05em' }}>ENTERPRISE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>LedgerFlow</div>
          </div>
        </div>

        {/* Close Button */}
        <button
          id="sidebar-close-btn"
          onClick={toggleSidebar}
          title="Close sidebar"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '30px', height: '30px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.06)',
            color: '#6B7280',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color = '#6B7280';
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 4px 8px' }} />

      {/* Main Menu (Hidden on mobile via CSS because these 4 links appear in the mobile bottom footer) */}
      <div className="sidebar-main-menu">
        <div style={{
          fontSize: '0.68rem', fontWeight: 700, color: '#4B5563',
          padding: '0 12px 8px',
          textTransform: 'uppercase', letterSpacing: '0.10em'
        }}>
          Main Menu
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {mainMenu.map(item => <MenuItem key={item.id} item={item} />)}
        </div>
        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 4px 4px' }} />
      </div>

      {/* Management Menu */}
      <div>
        <div style={{
          fontSize: '0.68rem', fontWeight: 700, color: '#4B5563',
          padding: '0 12px 8px',
          textTransform: 'uppercase', letterSpacing: '0.10em'
        }}>
          Management
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {managementMenu.map(item => <MenuItem key={item.id} item={item} />)}
        </div>
      </div>

      {/* Bottom: version */}
      <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.72rem', color: '#374151', textAlign: 'center' }}>
          LedgerFlow v1.0 · Enterprise Edition
        </div>
      </div>
    </aside>
  );
};
