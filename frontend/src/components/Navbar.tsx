import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, type CurrencyCode, SUPPORTED_CURRENCIES } from '../context/CurrencyContext';
import type { UserRole } from '../types';
import { 
  Search, Bell, MessageSquare, Shield, Keyboard, PanelLeftOpen,
  Landmark, FileText, ShieldCheck
} from 'lucide-react';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NotificationsDropdown, type NotificationItem } from './NotificationsDropdown';
import { MessagesModal } from './MessagesModal';

export const Navbar: React.FC = () => {
  const { activeRole, setActiveRole, activeTab, setActiveTab, setShowHotkeysModal, sidebarOpen, toggleSidebar, showToast } = useAuth();
  const { currency, setCurrency, currencyConfig, currencies } = useCurrency();

  // Refs for portal positioning
  const bellRef = React.useRef<HTMLButtonElement>(null);

  // Search Modal State
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);

  // Notifications State
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Bank Statement Ready',
      description: 'Chase Operating account has 4 transactions pending double-entry reconciliation.',
      time: '10m ago',
      type: 'info',
      isRead: false,
      tabId: 'banking',
      icon: Landmark
    },
    {
      id: 'notif-2',
      title: 'Overdue Customer Invoice',
      description: 'Invoice #INV-2026-001 for Acme Corp ($5,500) has reached due date.',
      time: '1h ago',
      type: 'warning',
      isRead: false,
      tabId: 'invoices',
      icon: FileText
    },
    {
      id: 'notif-3',
      title: 'Security & Audit Lock',
      description: 'Q1 accounting books locked with immutable SHA-256 audit ledger stamp.',
      time: '1d ago',
      type: 'success',
      isRead: false,
      tabId: 'audit',
      icon: ShieldCheck
    }
  ]);

  // Messages Modal State
  const [showMessages, setShowMessages] = useState<boolean>(false);

  // Global Keyboard Shortcut: Cmd+F or Ctrl+F opens search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    showToast('All notifications marked as read', 'success');
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    showToast('Notifications cleared', 'success');
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
    setShowNotifications(false);
    if (item.tabId) {
      setActiveTab(item.tabId);
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveRole(e.target.value as UserRole);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'voucher':   return 'Vouchers & Tasks';
      case 'coa':       return 'Chart of Accounts';
      case 'banking':   return 'Bank & Accounts';
      case 'invoices':  return 'Invoicing';
      case 'bills':     return 'Bill Pay';
      case 'reports':   return 'Financial Reports';
      case 'datahub':   return 'Import & Export Hub';
      case 'audit':     return 'Audit & Security';
      default:          return 'Dashboard';
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: '#F97316',
    ACCOUNTANT: '#10B981',
    DATA_ENTRY: '#8B5CF6',
    AUDITOR: '#6B7280',
  };

  return (
    <header className="navbar-header" style={{
      background: '#FFFFFF',
      borderBottom: '1px solid #E5E7EB',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      position: 'relative',
      flexShrink: 0,
      padding: '0 16px',
    }}>

      {/* Row 1: sidebar toggle (left) + right controls */}
      <div style={{
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>

        {/* Left: sidebar toggle + title (desktop only inline) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {!sidebarOpen && (
            <button
              id="sidebar-open-btn"
              onClick={toggleSidebar}
              title="Open sidebar"
              className="btn btn-outline"
              style={{ padding: '8px', borderRadius: '10px', width: '38px', height: '38px' }}
            >
              <PanelLeftOpen size={18} style={{ color: '#6B7280' }} />
            </button>
          )}

          {/* Title – visible inline on desktop, hidden here on mobile */}
          <div className="navbar-title-inline">
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
              {getTabTitle()}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 500 }}>
              LedgerFlow Enterprise
            </div>
          </div>
        </div>


      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* 1. Functional Search Bar – hidden on mobile */}
        <div 
          onClick={() => setShowSearchModal(true)}
          className="navbar-search"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: '#F9FAFB',
            borderRadius: '10px',
            border: '1.5px solid #E5E7EB',
            padding: '7px 12px',
            width: '220px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#F97316')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
        >
          <Search size={15} style={{ color: '#9CA3AF', marginRight: '8px', flexShrink: 0 }} />
          <input
            placeholder="Search..."
            readOnly
            value=""
            style={{
              border: 'none', outline: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              color: '#111827',
              width: '100%',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd style={{
            fontSize: '0.68rem', background: '#F3F4F6', color: '#9CA3AF',
            padding: '2px 6px', borderRadius: '5px',
            border: '1px solid #E5E7EB', fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}>⌘F</kbd>
        </div>

        {/* 2. Functional Notifications Bell */}
        <div style={{ position: 'relative' }}>
          <button
            ref={bellRef}
            className="btn btn-outline"
            onClick={() => setShowNotifications(prev => !prev)}
            title="Compliance & Audit Notifications"
            style={{ 
              padding: '8px', 
              borderRadius: '10px', 
              width: '38px', 
              height: '38px', 
              position: 'relative',
              background: showNotifications ? 'rgba(249,115,22,0.1)' : 'transparent',
              borderColor: showNotifications ? '#F97316' : '#E5E7EB'
            }}
          >
            <Bell size={17} style={{ color: showNotifications ? '#F97316' : '#6B7280' }} />
            {/* Notification orange dot & count */}
            {unreadNotificationsCount > 0 && (
              <span style={{
                position: 'absolute', top: '7px', right: '7px',
                width: '8px', height: '8px',
                borderRadius: '50%', background: '#F97316',
                border: '1.5px solid #FFFFFF',
              }} />
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          <NotificationsDropdown
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onClearAll={handleClearAllNotifications}
            onItemClick={handleNotificationClick}
            triggerRef={bellRef}
          />
        </div>

        {/* 3. Functional Messages & Copilot Button */}
        <button 
          className="btn btn-outline" 
          onClick={() => setShowMessages(true)}
          title="Team Notes & AI Financial Assistant"
          style={{ 
            padding: '8px', 
            borderRadius: '10px', 
            width: '38px', 
            height: '38px',
            position: 'relative'
          }}
        >
          <MessageSquare size={17} style={{ color: '#6B7280' }} />
          <span style={{
            position: 'absolute', top: '7px', right: '7px',
            width: '6px', height: '6px',
            borderRadius: '50%', background: '#10B981',
            border: '1px solid #FFFFFF',
          }} />
        </button>

        {/* Hotkeys */}
        <button
          className="btn btn-outline"
          onClick={() => setShowHotkeysModal(true)}
          style={{ padding: '8px 12px', fontSize: '0.82rem', gap: '6px' }}
        >
          <Keyboard size={15} style={{ color: '#6B7280' }} />
          <span style={{ color: '#374151' }}>Hotkeys</span>
        </button>

        {/* Divider – hidden on mobile */}
        <div className="navbar-divider" style={{ width: '1px', height: '28px', background: '#E5E7EB' }} />

        {/* Currency Selector – hidden on small mobile */}
        <div
          title="Switch Active Currency"
          className="navbar-currency"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: '#F0FDF4',
            padding: '6px 11px',
            borderRadius: '10px',
            border: '1.5px solid rgba(16,185,129,0.3)',
            transition: 'border-color 0.15s',
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>{currencyConfig.flag}</span>
          <select
            id="global-currency-select"
            value={currency}
            onChange={(e) => {
              const code = e.target.value as CurrencyCode;
              setCurrency(code);
              showToast(`Currency updated to ${SUPPORTED_CURRENCIES[code].name}`, 'success');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#065F46',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code} style={{ color: '#111827', fontWeight: 600 }}>
                {c.flag} {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {/* Role Selector – hidden on small mobile */}
        <div className="navbar-role" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#FFF4ED',
          padding: '6px 12px',
          borderRadius: '10px',
          border: '1.5px solid rgba(249,115,22,0.25)',
        }}>
          <Shield size={14} style={{ color: roleColors[activeRole] || '#F97316', flexShrink: 0 }} />
          <select
            value={activeRole}
            onChange={handleRoleChange}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#111827',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="ADMIN">Admin / Owner</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="DATA_ENTRY">Data Entry</option>
            <option value="AUDITOR">Auditor (Read-Only)</option>
          </select>
        </div>

        {/* Avatar */}
        <div style={{
          width: '36px', height: '36px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', fontWeight: 800, fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
          flexShrink: 0,
        }}>
          {activeRole === 'ADMIN' ? 'A' : activeRole === 'ACCOUNTANT' ? 'AC' : activeRole === 'DATA_ENTRY' ? 'DE' : 'AU'}
        </div>
      </div>

      </div>

      {/* Global Search Modal (Search... ⌘F) */}
      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      {/* Messages & Financial Copilot Modal */}
      <MessagesModal
        isOpen={showMessages}
        onClose={() => setShowMessages(false)}
      />

      {/* Row 2: Page title – only visible on mobile */}
      <div className="navbar-title-row">
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
          {getTabTitle()}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 500 }}>
          LedgerFlow Enterprise
        </div>
      </div>

    </header>
  );
};
