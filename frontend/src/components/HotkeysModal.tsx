import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Keyboard } from 'lucide-react';

export const HotkeysModal: React.FC = () => {
  const { showHotkeysModal, setShowHotkeysModal } = useAuth();

  if (!showHotkeysModal) return null;

  const hotkeysList = [
    { key: 'Alt + N', action: 'Add new Debit/Credit row in Journal Voucher Form' },
    { key: 'Ctrl + Enter', action: 'Post Journal Voucher to Ledger' },
    { key: 'Esc', action: 'Close Modals or Reset Form' },
    { key: 'Alt + 1', action: 'Switch to Dashboard' },
    { key: 'Alt + 2', action: 'Switch to Chart of Accounts' },
    { key: 'Alt + 3', action: 'Switch to Journal Voucher Form' },
    { key: 'Alt + 4', action: 'Switch to Invoices & AR' },
    { key: 'Alt + 5', action: 'Switch to Bills & AP' },
    { key: 'Alt + 6', action: 'Switch to Bank Reconciliation' },
    { key: 'Alt + 7', action: 'Switch to Financial Reports' },
  ];

  return (
    <div className="modal-overlay" onClick={() => setShowHotkeysModal(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', background: '#ffffff' }}>
        <div className="modal-header" style={{ borderColor: '#e4e4e7', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <Keyboard size={22} style={{ color: '#09090b' }} />
            <h3 className="modal-title" style={{ color: '#09090b', fontWeight: 800, margin: 0 }}>Keyboard Hotkeys & Shortcuts</h3>
          </div>
          <button
            onClick={() => setShowHotkeysModal(false)}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {hotkeysList.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#18181b',
                borderRadius: '10px',
                fontSize: '0.9rem'
              }}
            >
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{item.action}</span>
              <kbd style={{
                background: '#09090b',
                border: '1px solid #3f3f46',
                padding: '4px 10px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                color: '#34d399',
                fontWeight: 700,
                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
              }}>
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
