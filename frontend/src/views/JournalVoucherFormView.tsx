import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import type { Account, JournalEntry, JournalItem, JournalEntryType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Plus, Trash2, RotateCcw, Lock, Send, Search, UploadCloud, FileSpreadsheet, FileCode, ChevronDown, Check } from 'lucide-react';
import { exportToCSV, exportToJSON } from '../utils/exportImportUtils';
import { ImportModal } from '../components/ImportModal';

interface AccountSelectCellProps {
  value: string;
  accounts: Account[];
  onChange: (accountId: string) => void;
}

const AccountSelectCell: React.FC<AccountSelectCellProps> = ({ value, accounts, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedAccount = accounts.find(a => String(a.id) === String(value));

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = Math.max(rect.width, 320);
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - popoverWidth - 10));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 280 && rect.top > 280 ? rect.top - 280 : rect.bottom + 4;

      setDropdownPos({
        top,
        left,
        width: popoverWidth,
      });
      setSearch('');
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      acc.code.toLowerCase().includes(q) ||
      acc.name.toLowerCase().includes(q) ||
      (acc.category && acc.category.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="form-input font-mono"
        title={selectedAccount ? `${selectedAccount.code} | ${selectedAccount.name} (${selectedAccount.category})` : 'Select Account'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          cursor: 'pointer',
          padding: '8px 12px',
          background: '#FFFFFF',
          textAlign: 'left',
          borderColor: isOpen ? 'var(--primary)' : '#E5E7EB',
          boxShadow: isOpen ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : 'none',
          color: selectedAccount ? '#111827' : '#9CA3AF',
          fontWeight: selectedAccount ? 700 : 500,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
          {selectedAccount ? selectedAccount.code : '--'}
        </span>
        <ChevronDown
          size={14}
          color="#9CA3AF"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}
        />
      </button>

      {isOpen && dropdownPos && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'transparent',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              maxHeight: '280px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.12s ease-out',
            }}
          >
            {/* Quick Search */}
            <div style={{ padding: '8px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: '10px' }} />
                <input
                  type="text"
                  placeholder="Search code or account..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    outline: 'none',
                    background: '#FFFFFF',
                    color: '#1F2937',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsOpen(false);
                  }}
                />
              </div>
            </div>

            {/* Account List */}
            <div style={{ overflowY: 'auto', maxHeight: '210px', padding: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: !value ? 'var(--primary-light)' : 'transparent',
                  color: !value ? 'var(--primary-dark)' : '#6B7280',
                  fontSize: '0.82rem',
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (value) (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  if (value) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                -- Select Account --
              </button>

              {filteredAccounts.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>
                  No accounts found
                </div>
              ) : (
                filteredAccounts.map(acc => {
                  const isSelected = String(acc.id) === String(value);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        onChange(String(acc.id));
                        setIsOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                        color: isSelected ? 'var(--primary-dark)' : '#1F2937',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                        marginBottom: '2px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.82rem' }}>
                          {acc.code}
                        </span>
                        <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>|</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.name}
                        </span>
                        {acc.category && (
                          <span style={{ fontSize: '0.72rem', color: '#9CA3AF', marginLeft: '2px', flexShrink: 0 }}>
                            ({acc.category})
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={15} color="var(--primary)" style={{ flexShrink: 0, marginLeft: '6px' }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const JournalVoucherFormView: React.FC = () => {
  const { showToast, activeRole } = useAuth();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState<boolean>(false);
  const voucherTypeRef = useRef<HTMLDivElement>(null);

  const voucherTypes: { value: JournalEntryType; label: string }[] = [
    { value: 'STANDARD', label: 'Standard Journal (JV)' },
    { value: 'PAYMENT', label: 'Payment Voucher (PV)' },
    { value: 'RECEIPT', label: 'Receipt Voucher (RV)' },
    { value: 'CONTRA', label: 'Contra Entry (CV)' },
  ];

  // Form State
  const [entryType, setEntryType] = useState<JournalEntryType>('STANDARD');
  const [entryNumber, setEntryNumber] = useState<string>(`JV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState<string>('');

  const [items, setItems] = useState<JournalItem[]>([
    { account: '', debit: '0.00', credit: '0.00', description: '' },
    { account: '', debit: '0.00', credit: '0.00', description: '' },
  ]);

  // Calculations
  const totalDebit = items.reduce((sum, item) => sum + parseFloat(item.debit || '0'), 0);
  const totalCredit = items.reduce((sum, item) => sum + parseFloat(item.credit || '0'), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.001;

  useEffect(() => {
    fetchAccounts();
    fetchEntries();
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        addRow();
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (isBalanced) {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, isBalanced, entryNumber, date, narration]);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('accounts/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setAccounts(data);
      if (data.length >= 2) {
        setItems([
          { account: data[0].id, debit: '0.00', credit: '0.00', description: '' },
          { account: data[1].id, debit: '0.00', credit: '0.00', description: '' },
        ]);
      }
    } catch (err) {
      showToast('Failed to load chart of accounts', 'error');
    }
  };

  const fetchEntries = async () => {
    try {
      const res = await api.get('journal-entries/');
      setEntries(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      console.error(err);
    }
  };

  const addRow = () => {
    const defaultAcc = accounts.length > 0 ? accounts[0].id : '';
    setItems([...items, { account: defaultAcc, debit: '0.00', credit: '0.00', description: '' }]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 2) {
      showToast('A double-entry voucher requires at least 2 line items.', 'warning');
      return;
    }
    const next = items.filter((_, idx) => idx !== index);
    setItems(next);
  };

  const updateRow = (index: number, field: keyof JournalItem, value: string) => {
    const next = [...items];
    const row = { ...next[index] };

    if (field === 'debit') {
      row.debit = value;
      if (parseFloat(value || '0') > 0) row.credit = '0.00';
    } else if (field === 'credit') {
      row.credit = value;
      if (parseFloat(value || '0') > 0) row.debit = '0.00';
    } else if (field === 'account') {
      row.account = value;
    } else if (field === 'description') {
      row.description = value;
    }

    next[index] = row;
    setItems(next);
  };


  const handleSubmit = async () => {
    if (activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Data Entry role cannot post directly to General Ledger.', 'error');
      return;
    }

    if (!isBalanced) {
      showToast(`Double-Entry Violation: Debits (${formatCurrency(totalDebit)}) must equal Credits (${formatCurrency(totalCredit)}).`, 'error');
      return;
    }

    const unassigned = items.some(i => !i.account);
    if (unassigned) {
      showToast('Please select a valid account for all line items.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      // 1. Create Draft Journal Entry
      const payload = {
        entry_number: entryNumber,
        entry_type: entryType,
        date: date,
        narration: narration || 'Manual Journal Voucher Entry',
        items: items.map(i => ({
          account: i.account,
          debit: parseFloat(i.debit || '0').toFixed(2),
          credit: parseFloat(i.credit || '0').toFixed(2),
          description: i.description
        }))
      };

      const createRes = await api.post('journal-entries/', payload);
      const entryId = createRes.data.id;

      // 2. Immediately Post to Ledger
      await api.post(`journal-entries/${entryId}/post/`);

      showToast(`Successfully posted Voucher ${entryNumber} to General Ledger!`, 'success');

      // Reset Form
      setEntryNumber(`JV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setNarration('');
      if (accounts.length >= 2) {
        setItems([
          { account: accounts[0].id, debit: '0.00', credit: '0.00', description: '' },
          { account: accounts[1].id, debit: '0.00', credit: '0.00', description: '' },
        ]);
      }

      fetchEntries();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to post journal voucher';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async (entryId: string, entryNum: string) => {
    if (activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Data Entry operators cannot reverse entries.', 'error');
      return;
    }

    try {
      await api.post(`journal-entries/${entryId}/reverse/`, { reason: 'User requested reversal' });
      showToast(`Reversal voucher generated for ${entryNum}`, 'success');
      fetchEntries();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Reversal failed', 'error');
    }
  };

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(
      `journal_vouchers_${timestamp}.csv`,
      ['Voucher Number', 'Date', 'Type', 'Status', 'Narration', 'Total Debit', 'Total Credit', 'Balanced'],
      filteredEntries.map(v => [
        v.entry_number,
        v.date,
        v.entry_type,
        v.status,
        v.narration,
        v.total_debit,
        v.total_credit,
        v.is_balanced ? 'YES' : 'NO'
      ])
    );
    showToast(`Exported ${filteredEntries.length} vouchers to CSV`, 'success');
  };

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToJSON(`journal_vouchers_${timestamp}.json`, filteredEntries);
    showToast(`Exported ${filteredEntries.length} vouchers to JSON`, 'success');
  };

  const filteredEntries = entries.filter(e =>
    e.entry_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.entry_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>High-Speed Journal Voucher Form</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Create and post double-entry vouchers with live invariant balance verification (<kbd style={{ color: 'var(--accent-emerald)' }}>Alt+N</kbd> for row, <kbd style={{ color: 'var(--accent-emerald)' }}>Ctrl+Enter</kbd> to post).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleExportCSV} 
              title="Export vouchers to Excel CSV"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} color="#34d399" /> Export CSV
            </button>
            <button 
              className="btn btn-outline" 
              onClick={handleExportJSON} 
              title="Export vouchers to JSON"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileCode size={15} color="#60a5fa" /> Export JSON
            </button>
          </div>

          {activeRole !== 'AUDITOR' && (
            <button 
              className="btn btn-outline" 
              onClick={() => setShowImportModal(true)}
              style={{ fontSize: '0.82rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)', color: '#34d399' }}
            >
              <UploadCloud size={15} /> Import Vouchers
            </button>
          )}
        </div>
      </div>

      {/* Voucher Header Form */}
      <div className="glass-panel" style={{ border: isBalanced ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ position: 'relative' }} ref={voucherTypeRef}>
            <label className="form-label">Voucher Type</label>
            <button
              type="button"
              onClick={() => setShowVoucherTypeDropdown(!showVoucherTypeDropdown)}
              className="form-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left',
                background: '#FFFFFF',
                fontWeight: 500,
                borderColor: showVoucherTypeDropdown ? 'var(--primary)' : undefined,
                boxShadow: showVoucherTypeDropdown ? '0 0 0 3px rgba(249,115,22,0.15)' : undefined
              }}
            >
              <span>{voucherTypes.find(v => v.value === entryType)?.label || 'Select Type'}</span>
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-muted)',
                  transform: showVoucherTypeDropdown ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0
                }}
              />
            </button>

            {showVoucherTypeDropdown && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  onClick={() => setShowVoucherTypeDropdown(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 95,
                    background: '#FFFFFF',
                    border: '1.5px solid var(--primary)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}
                >
                  {voucherTypes.map(v => {
                    const isSelected = entryType === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => {
                          setEntryType(v.value);
                          setShowVoucherTypeDropdown(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: isSelected ? 'var(--primary-light)' : 'transparent',
                          color: isSelected ? 'var(--primary-dark)' : '#1F2937',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <span>{v.label}</span>
                        {isSelected && <Check size={16} color="var(--primary)" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="form-label">Voucher Number</label>
            <input className="form-input font-mono" value={entryNumber} onChange={(e) => setEntryNumber(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Posting Date</label>
            <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Memo / Narration</label>
            <input className="form-input" placeholder="e.g. Monthly Lease Payment" value={narration} onChange={(e) => setNarration(e.target.value)} />
          </div>
        </div>

        {/* Dynamic Line Items Table */}
        <div className="table-container" style={{ marginBottom: '20px' }}>
          <table className="data-table" style={{ minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Account Name & Code</th>
                <th style={{ width: '25%' }}>Description</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Debit ({currencySymbol})</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Credit ({currencySymbol})</th>
                <th style={{ width: '5%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <AccountSelectCell
                      value={item.account}
                      accounts={accounts}
                      onChange={(accountId) => updateRow(index, 'account', accountId)}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      placeholder="Line memo"
                      value={item.description}
                      onChange={(e) => updateRow(index, 'description', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input font-mono"
                      style={{ textAlign: 'right', color: parseFloat(item.debit || '0') > 0 ? '#34d399' : '#fff' }}
                      value={item.debit}
                      onChange={(e) => updateRow(index, 'debit', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input font-mono"
                      style={{ textAlign: 'right', color: parseFloat(item.credit || '0') > 0 ? '#60a5fa' : '#fff' }}
                      value={item.credit}
                      onChange={(e) => updateRow(index, 'credit', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => removeRow(index)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-crimson)', cursor: 'pointer' }}
                      title="Remove Row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form Controls & Real-Time Balance Display */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-outline" onClick={addRow}>
            <Plus size={16} /> Add Line Row (Alt+N)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', background: '#1e293b', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Debit: </span>
                <strong className="font-mono" style={{ color: '#34d399' }}>{formatCurrency(totalDebit)}</strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Credit: </span>
                <strong className="font-mono" style={{ color: '#60a5fa' }}>{formatCurrency(totalCredit)}</strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Diff: </span>
                <strong className="font-mono" style={{ color: difference === 0 && totalDebit > 0 ? '#34d399' : 'var(--accent-crimson)' }}>
                  {formatCurrency(difference)}
                </strong>
              </div>
            </div>

            {/* Locked vs Balanced Post Button */}
            {isBalanced ? (
              <button
                className="btn btn-emerald"
                onClick={handleSubmit}
                disabled={submitting || activeRole === 'DATA_ENTRY'}
              >
                <Send size={16} />
                <span>{submitting ? 'Posting...' : 'Post Entry to Ledger'}</span>
              </button>
            ) : (
              <button
                className="btn btn-crimson"
                disabled={true}
                title="Double-Entry Warning: Total Debits must equal Total Credits before posting."
              >
                <Lock size={16} />
                <span>Unbalanced Entry ({formatCurrency(difference)})</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Journal Entry Records Data Grid */}
      <div className="glass-panel">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>General Ledger Audit Entries</h3>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              placeholder="Search voucher # or memo..."
              style={{ paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Narration</th>
                <th style={{ textAlign: 'right' }}>Total ({currencySymbol})</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No journal entries found.</td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{entry.entry_number}</td>
                    <td><span className="badge badge-purple">{entry.entry_type}</span></td>
                    <td>{entry.date}</td>
                    <td>
                      {entry.status === 'POSTED' ? (
                        <span className="badge badge-emerald">POSTED</span>
                      ) : entry.status === 'VOID' ? (
                        <span className="badge badge-crimson">VOID</span>
                      ) : (
                        <span className="badge badge-amber">DRAFT</span>
                      )}
                    </td>
                    <td>{entry.narration || '-'}</td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(entry.total_debit)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {entry.status === 'POSTED' && activeRole !== 'DATA_ENTRY' && activeRole !== 'AUDITOR' ? (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => handleReverse(entry.id, entry.entry_number)}
                          title="Generate Reversal Voucher"
                        >
                          <RotateCcw size={12} /> Reverse
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Immutable</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          fetchEntries();
        }}
        type="vouchers"
        title="Import Journal Vouchers"
      />
    </div>
  );
};

