import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, BookOpen, FolderTree, Landmark } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'voucher', label: 'Vouchers', fullLabel: 'Vouchers & Tasks', icon: BookOpen },
    { id: 'coa', label: 'Accounts', fullLabel: 'Chart of Accounts', icon: FolderTree },
    { id: 'banking', label: 'Banking', fullLabel: 'Bank & Accounts', icon: Landmark },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.fullLabel || item.label}
            onClick={() => setActiveTab(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? '#F97316' : '#9CA3AF',
              padding: '6px 2px',
              position: 'relative',
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  width: '32px',
                  height: '3px',
                  borderRadius: '0 0 4px 4px',
                  background: '#F97316',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.6)'
                }}
              />
            )}
            <div
              style={{
                width: '34px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                background: isActive ? 'rgba(249, 115, 22, 0.18)' : 'transparent',
                transition: 'background 0.15s ease'
              }}
            >
              <Icon size={18} style={{ color: isActive ? '#F97316' : '#9CA3AF' }} />
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em'
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
