import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { BankAccount, BankStatementTransaction, JournalEntry } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import {
  Landmark, CheckCircle2, AlertCircle, X, Plus,
  RefreshCw, TrendingUp, TrendingDown, DollarSign, MoreVertical,
  UploadCloud, FileSpreadsheet, FileCode
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { exportToCSV, exportToJSON } from '../utils/exportImportUtils';
import { ImportModal } from '../components/ImportModal';

interface MonthlyBalanceData {
  bank_account_id: string;
  bank_name: string;
  account_name: string;
  current_balance: number;
  mom_change: number | null;
  monthly_data: { month: string; year: number; label: string; balance: number; date: string; is_projected: boolean }[];
}

export const BankingView: React.FC = () => {
  const { showToast, activeRole } = useAuth();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankStatementTransaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Monthly balance chart
  const [monthlyData, setMonthlyData] = useState<MonthlyBalanceData | null>(null);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  // CSV Upload Modal
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Add Bank Account Modal
  const [showAddBankModal, setShowAddBankModal] = useState<boolean>(false);
  const [newBankName, setNewBankName] = useState<string>('');
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountNumber, setNewAccountNumber] = useState<string>('');
  const [newOpeningBalance, setNewOpeningBalance] = useState<string>('0.00');
  const [savingBank, setSavingBank] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resBanks, resTxs, resEntries] = await Promise.all([
        api.get('bank-accounts/'),
        api.get('bank-transactions/'),
        api.get('journal-entries/')
      ]);

      const banks = Array.isArray(resBanks.data) ? resBanks.data : (resBanks.data.results || []);
      setBankAccounts(banks);

      const firstId = banks.length > 0 ? banks[0].id : '';
      const activeId = selectedBankId || firstId;
      if (activeId) setSelectedBankId(activeId);

      setTransactions(Array.isArray(resTxs.data) ? resTxs.data : (resTxs.data.results || []));
      setJournalEntries(Array.isArray(resEntries.data) ? resEntries.data : (resEntries.data.results || []));

      // Fetch monthly balance for first/active bank
      if (activeId) fetchMonthlyBalance(activeId);
    } catch (err) {
      showToast('Failed to load banking data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyBalance = async (bankId: string) => {
    try {
      setChartLoading(true);
      const res = await api.get<MonthlyBalanceData>(`bank-accounts/${bankId}/monthly-balance/`);
      setMonthlyData(res.data);
    } catch (err) {
      console.error('Failed to fetch monthly balance', err);
    } finally {
      setChartLoading(false);
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole === 'AUDITOR' || activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Only Accountants and Admins can add bank accounts.', 'error');
      return;
    }
    try {
      setSavingBank(true);
      await api.post('bank-accounts/', {
        bank_name: newBankName,
        account_name: newAccountName,
        account_number: newAccountNumber,
        opening_balance: parseFloat(newOpeningBalance || '0').toFixed(2),
      });
      showToast(`Bank account "${newAccountName}" added successfully!`, 'success');
      setShowAddBankModal(false);
      setNewBankName(''); setNewAccountName(''); setNewAccountNumber(''); setNewOpeningBalance('0.00');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to add bank account', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedBankId) {
      showToast('Please select a bank account and a CSV statement file.', 'warning');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('bank_account_id', selectedBankId);
      formData.append('file', uploadFile);
      await api.post('bank-transactions/upload-csv/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Successfully imported bank statement CSV!', 'success');
      setShowUploadModal(false);
      setUploadFile(null);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'CSV Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleMatchLedger = async (txId: string, entryId: string) => {
    if (activeRole === 'AUDITOR' || activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Only Accountants and Admins can reconcile bank statements.', 'error');
      return;
    }
    try {
      await api.post(`bank-transactions/${txId}/match-ledger/`, {
        journal_entry_id: entryId || null
      });
      showToast('Reconciliation updated successfully', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Match failed', 'error');
    }
  };

  // Filter transactions by selected bank
  const filteredTransactions = selectedBankId
    ? transactions.filter(t => t.bank_account === selectedBankId || !t.bank_account)
    : transactions;

  const reconciledTxs = filteredTransactions.filter(t => t.is_reconciled);
  const unreconciledTxs = filteredTransactions.filter(t => !t.is_reconciled);

  const totalInflow = filteredTransactions
    .filter(t => parseFloat(t.amount) > 0)
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOutflow = filteredTransactions
    .filter(t => parseFloat(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(
      `bank_transactions_${timestamp}.csv`,
      ['Date', 'Bank Account', 'Description', 'Reference', 'Amount', 'Reconciled'],
      filteredTransactions.map(t => [
        t.transaction_date,
        t.bank_account,
        t.description,
        t.reference,
        t.amount,
        t.is_reconciled ? 'YES' : 'NO'
      ])
    );
    showToast(`Exported ${filteredTransactions.length} bank transactions to CSV`, 'success');
  };

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToJSON(`bank_transactions_${timestamp}.json`, filteredTransactions);
    showToast(`Exported ${filteredTransactions.length} bank transactions to JSON`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bank & Cash Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Multi-account liquidity tracking, statement CSV import, and bank reconciliation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleExportCSV} 
              title="Export transactions to Excel CSV"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} color="#34d399" /> Export CSV
            </button>
            <button 
              className="btn btn-outline" 
              onClick={handleExportJSON} 
              title="Export transactions to JSON"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileCode size={15} color="#60a5fa" /> Export JSON
            </button>
          </div>

          <button className="btn btn-outline" onClick={fetchData} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowAddBankModal(true)}
            disabled={activeRole === 'AUDITOR' || activeRole === 'DATA_ENTRY'}
          >
            <Plus size={16} /> Add Bank Account
          </button>
          <button className="btn btn-emerald" onClick={() => setShowImportModal(true)}>
            <UploadCloud size={16} /> Import Statement CSV
          </button>
        </div>
      </div>

      {/* Bank Account Cards */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading accounts...</div>
      ) : bankAccounts.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Landmark size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>No bank accounts yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Click "Add Bank Account" to get started</div>
        </div>
      ) : (
        <div className="metric-grid">
          {bankAccounts.map(b => {
            const isSelected = selectedBankId === b.id;
            const bal = parseFloat(b.current_balance || b.opening_balance || '0');
            return (
              <div
                key={b.id}
                className="metric-card"
                onClick={() => { setSelectedBankId(b.id); fetchMonthlyBalance(b.id); }}
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isSelected ? '#ffffff' : 'var(--bg-card)',
                  boxShadow: isSelected ? '0 4px 16px rgba(9,9,11,0.12)' : 'var(--shadow-md)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {b.bank_name}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0', color: 'var(--text-main)' }}>
                      {b.account_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {b.account_number}
                    </div>
                  </div>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: isSelected ? '#09090b' : '#f4f4f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Landmark size={18} style={{ color: isSelected ? '#ffffff' : '#71717a' }} />
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Balance</div>
                  <div style={{
                    fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: bal >= 0 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'
                  }}>
                    {formatCurrency(bal)}
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--accent-emerald)'
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 12-Month Balance Chart */}
      {bankAccounts.length > 0 && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {monthlyData?.bank_name || '—'} · {monthlyData?.account_name || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                  {monthlyData
                    ? formatCurrency(monthlyData.current_balance)
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                  }
                </div>
                {monthlyData?.mom_change != null && (
                  <span className={`badge ${monthlyData.mom_change >= 0 ? 'badge-emerald' : 'badge-crimson'}`}>
                    {monthlyData.mom_change >= 0 ? '+' : ''}{monthlyData.mom_change}% vs last month
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Balance Trend · {monthlyData?.monthly_data.filter(m => !m.is_projected).length || 0} actual &nbsp;
                <span style={{ color: '#a1a1aa' }}>+&nbsp;{monthlyData?.monthly_data.filter(m => m.is_projected).length || 0} projected</span>
              </div>
            </div>
            <MoreVertical size={18} style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }} />
          </div>

          <div style={{ width: '100%', height: 260 }}>
            {chartLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Loading chart...
              </div>
            ) : monthlyData && monthlyData.monthly_data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData.monthly_data} barCategoryGap="30%">
                  <XAxis
                    dataKey="month"
                    stroke="#a1a1aa"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#a1a1aa"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `${currencySymbol}${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `${currencySymbol}${(v / 1000).toFixed(0)}K`;
                      return `${currencySymbol}${v}`;
                    }}
                    width={60}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(249,115,22,0.06)' }}
                    contentStyle={{
                      background: '#09090b',
                      color: '#ffffff',
                      borderRadius: '10px',
                      border: 'none',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                    }}
                    labelStyle={{ fontWeight: 700, marginBottom: '4px' }}
                    labelFormatter={(_, payload) => {
                      const entry = payload?.[0]?.payload;
                      return entry ? `${entry.label}${entry.is_projected ? ' (Projected)' : ''}` : '';
                    }}
                    formatter={(val: any) => [
                      formatCurrency(val),
                      'Balance'
                    ]}
                  />
                  <Bar dataKey="balance" radius={[5, 5, 0, 0]}>
                    {monthlyData.monthly_data.map((entry, index) => {
                      const isCurrentMonth = !entry.is_projected &&
                        index === monthlyData.monthly_data.filter(m => !m.is_projected).length - 1;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.is_projected
                              ? '#d4d4d8'
                              : isCurrentMonth
                                ? 'var(--primary)'
                                : '#09090b'
                          }
                          opacity={entry.is_projected ? 0.6 : isCurrentMonth ? 1 : 0.85}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No balance history available
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#09090b' }} />
              Actual
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--primary)' }} />
              Current Month
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#d4d4d8' }} />
              Projected
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Inflows</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(totalInflow)}
            </div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-crimson-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingDown size={18} style={{ color: 'var(--accent-crimson)' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Outflows</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-crimson)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(totalOutflow)}
            </div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reconciled / Unreconciled</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--accent-emerald)' }}>{reconciledTxs.length}</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>/</span>
              <span style={{ color: 'var(--accent-amber)' }}>{unreconciledTxs.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Reconciliation Matrix */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Bank Reconciliation Matrix</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Match internal posted vouchers to external bank statement lines
            </span>
          </div>
          {bankAccounts.length > 1 && (
            <select
              className="form-select"
              value={selectedBankId}
              onChange={e => setSelectedBankId(e.target.value)}
              style={{ width: 'auto', fontSize: '0.85rem', padding: '6px 12px' }}
            >
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Statement Description</th>
                <th>Reference #</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ width: '28%' }}>Match General Ledger Entry</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No transactions for this account. Upload a CSV statement to import.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{tx.transaction_date}</td>
                    <td style={{ fontWeight: 500 }}>{tx.description}</td>
                    <td className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{tx.reference || '—'}</td>
                    <td className="font-mono" style={{
                      textAlign: 'right', fontWeight: 700,
                      color: parseFloat(tx.amount) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'
                    }}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {tx.is_reconciled ? (
                        <span className="badge badge-emerald"><CheckCircle2 size={12} /> RECONCILED</span>
                      ) : (
                        <span className="badge badge-amber"><AlertCircle size={12} /> UNRECONCILED</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-select font-mono"
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                        value={tx.matched_journal_entry?.id || ''}
                        onChange={(e) => handleMatchLedger(tx.id, e.target.value)}
                        disabled={activeRole === 'AUDITOR' || activeRole === 'DATA_ENTRY'}
                      >
                        <option value="">— Match Internal Entry —</option>
                        {journalEntries.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.entry_number} | {e.date} ({formatCurrency(e.total_debit)})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Bank Account Modal */}
      {showAddBankModal && (
        <div className="modal-overlay" onClick={() => setShowAddBankModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Bank Account</h3>
              <button onClick={() => setShowAddBankModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddBank} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input className="form-input" placeholder="e.g. Chase Bank, Meezan Bank" value={newBankName} onChange={e => setNewBankName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input className="form-input" placeholder="e.g. Main Business Checking" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input className="form-input font-mono" placeholder="e.g. CHASE-001234" value={newAccountNumber} onChange={e => setNewAccountNumber(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance ({currencySymbol})</label>
                <input type="number" step="0.01" className="form-input font-mono" value={newOpeningBalance} onChange={e => setNewOpeningBalance(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddBankModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingBank}>
                  {savingBank ? 'Saving...' : 'Add Bank Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Upload Bank Statement CSV</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCsvUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Select Bank Account</label>
                <select className="form-select" value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)} required>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Statement CSV File</label>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Required columns: <code style={{ background: '#f4f4f5', padding: '1px 6px', borderRadius: '4px' }}>Date, Description, Reference, Amount</code>
                </div>
                <input
                  type="file" accept=".csv" className="form-input"
                  onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald" disabled={uploading}>
                  {uploading ? 'Importing...' : 'Upload & Parse CSV'}
                </button>
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
          fetchData();
        }}
        type="banking"
        title="Import Bank Statement Transactions"
        bankAccounts={bankAccounts}
      />
    </div>
  );
};

