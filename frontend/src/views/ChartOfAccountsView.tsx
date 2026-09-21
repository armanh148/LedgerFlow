import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Account, AccountCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Plus, Search, X, UploadCloud, FileSpreadsheet, FileCode } from 'lucide-react';
import { exportToCSV, exportToJSON } from '../utils/exportImportUtils';
import { ImportModal } from '../components/ImportModal';

export const ChartOfAccountsView: React.FC = () => {
  const { showToast, activeRole } = useAuth();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // New Account Form
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<AccountCategory>('ASSET');
  const [openingBalance, setOpeningBalance] = useState<string>('0.00');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('accounts/');
      setAccounts(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      showToast('Failed to load chart of accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(
      `chart_of_accounts_${timestamp}.csv`,
      ['Code', 'Name', 'Category', 'Opening Balance', 'Current Balance', 'Active'],
      filteredAccounts.map(a => [a.code, a.name, a.category, a.opening_balance, a.current_balance, a.is_active ? 'YES' : 'NO'])
    );
    showToast(`Exported ${filteredAccounts.length} accounts to CSV`, 'success');
  };

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToJSON(`chart_of_accounts_${timestamp}.json`, filteredAccounts);
    showToast(`Exported ${filteredAccounts.length} accounts to JSON`, 'success');
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole === 'AUDITOR') {
      showToast('Permission Denied: Auditor is read-only', 'error');
      return;
    }

    try {
      await api.post('accounts/', {
        code,
        name,
        category,
        opening_balance: openingBalance,
        is_active: true
      });
      showToast(`Created Account ${code} - ${name}`, 'success');
      setShowAddModal(false);
      setCode('');
      setName('');
      fetchAccounts();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create account', 'error');
    }
  };

  const categories = ['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

  const filteredAccounts = accounts.filter(acc => {
    const matchesCat = selectedCategory === 'ALL' || acc.category === selectedCategory;
    const matchesSearch = acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          acc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCategoryBadge = (cat: AccountCategory) => {
    switch (cat) {
      case 'ASSET': return 'badge-emerald';
      case 'LIABILITY': return 'badge-crimson';
      case 'EQUITY': return 'badge-purple';
      case 'REVENUE': return 'badge-blue';
      case 'EXPENSE': return 'badge-amber';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Chart of Accounts (COA)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Hierarchical tree of Assets, Liabilities, Equity, Revenue, and Expense accounts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Export Dropdown / Buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleExportCSV} 
              title="Export filtered accounts to Excel CSV"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} color="#34d399" /> Export CSV
            </button>
            <button 
              className="btn btn-outline" 
              onClick={handleExportJSON} 
              title="Export filtered accounts to JSON"
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
              <UploadCloud size={15} /> Import Accounts
            </button>
          )}

          {activeRole !== 'AUDITOR' && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
              <Plus size={16} /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: selectedCategory === cat ? 'var(--primary)' : '#1e293b',
                  color: '#fff',
                  fontWeight: selectedCategory === cat ? 600 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              placeholder="Search code or account name..."
              style={{ paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Accounts Data Grid */}
      <div className="glass-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Account Code</th>
                <th style={{ width: '35%' }}>Account Name</th>
                <th style={{ width: '15%' }}>Category</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Opening Balance ({currencySymbol})</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Current Balance ({currencySymbol})</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading Accounts...</td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No accounts found in this category.</td>
                </tr>
              ) : (
                filteredAccounts.map(acc => (
                  <tr key={acc.id}>
                    <td className="font-mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{acc.code}</td>
                    <td style={{ fontWeight: 500 }}>{acc.name}</td>
                    <td><span className={`badge ${getCategoryBadge(acc.category)}`}>{acc.category}</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatCurrency(acc.opening_balance)}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: parseFloat(acc.current_balance || '0') >= 0 ? '#34d399' : '#f87171' }}>
                      {formatCurrency(acc.current_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Chart Account</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Account Code (e.g., 1030, 5050)</label>
                <input className="form-input font-mono" placeholder="1030" value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>

              <div>
                <label className="form-label">Account Name</label>
                <input className="form-input" placeholder="e.g. Marketing & Advertising" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div>
                <label className="form-label">Account Category</label>
                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as AccountCategory)}>
                  <option value="ASSET">ASSET (1000s)</option>
                  <option value="LIABILITY">LIABILITY (2000s)</option>
                  <option value="EQUITY">EQUITY (3000s)</option>
                  <option value="REVENUE">REVENUE (4000s)</option>
                  <option value="EXPENSE">EXPENSE (5000s)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Opening Balance ({currencySymbol})</label>
                <input type="number" step="0.01" className="form-input font-mono" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          fetchAccounts();
        }}
        type="accounts"
        title="Import Chart of Accounts"
      />
    </div>
  );
};

