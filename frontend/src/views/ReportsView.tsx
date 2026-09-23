import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import type { TrialBalanceReport, ProfitAndLossReport, BalanceSheetReport } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { CheckCircle2, AlertTriangle, Printer, Calendar, FileSpreadsheet, FileCode, Filter, ChevronDown, Check } from 'lucide-react';
import { exportToCSV, exportToJSON } from '../utils/exportImportUtils';

export const ReportsView: React.FC = () => {
  const { showToast } = useAuth();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [activeReportTab, setActiveReportTab] = useState<'trial' | 'pnl' | 'bs' | 'ar_aging' | 'ap_aging'>('trial');

  // Report States
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [pnl, setPnl] = useState<ProfitAndLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [arAging, setArAging] = useState<any | null>(null);
  const [apAging, setApAging] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const reportOptions = [
    { id: 'trial', label: 'Trial Balance', badge: 'badge-blue', desc: 'Debits & credits live balance verification' },
    { id: 'pnl', label: 'Profit & Loss (Income Statement)', badge: 'badge-emerald', desc: 'Revenues, operating expenses & net profit' },
    { id: 'bs', label: 'Balance Sheet', badge: 'badge-purple', desc: 'Assets = liabilities + equity statement' },
    { id: 'ar_aging', label: 'AR Aging Report', badge: 'badge-amber', desc: 'Receivables categorized by aging buckets' },
    { id: 'ap_aging', label: 'AP Aging Report', badge: 'badge-crimson', desc: 'Payables categorized by aging buckets' },
  ];

  const currentReport = reportOptions.find(r => r.id === activeReportTab) || reportOptions[0];

  useEffect(() => {
    fetchReport();
  }, [activeReportTab, asOfDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      if (activeReportTab === 'trial') {
        const res = await api.get<TrialBalanceReport>(`reports/trial-balance/?as_of_date=${asOfDate}`);
        setTrialBalance(res.data);
      } else if (activeReportTab === 'pnl') {
        const res = await api.get<ProfitAndLossReport>(`reports/profit-loss/?end_date=${asOfDate}`);
        setPnl(res.data);
      } else if (activeReportTab === 'bs') {
        const res = await api.get<BalanceSheetReport>(`reports/balance-sheet/?as_of_date=${asOfDate}`);
        setBalanceSheet(res.data);
      } else if (activeReportTab === 'ar_aging') {
        const res = await api.get(`reports/ar-aging/?as_of_date=${asOfDate}`);
        setArAging(res.data);
      } else if (activeReportTab === 'ap_aging') {
        const res = await api.get(`reports/ap-aging/?as_of_date=${asOfDate}`);
        setApAging(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load financial report', err);
      showToast('Failed to calculate financial statement. Please check backend server status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCurrentReportCSV = () => {
    const timestamp = asOfDate;
    if (activeReportTab === 'trial' && trialBalance) {
      const rows = (trialBalance.accounts || []).map(a => [a.code, a.name, a.category, a.debit, a.credit]);
      rows.push(['TOTAL', 'TRIAL BALANCE SUM', '', trialBalance.total_debits, trialBalance.total_credits]);
      exportToCSV(`trial_balance_${timestamp}.csv`, ['Account Code', 'Account Name', 'Category', 'Debit', 'Credit'], rows);
      showToast('Trial Balance exported to CSV!', 'success');
    } else if (activeReportTab === 'pnl' && pnl) {
      const rows: (string | number)[][] = [];
      rows.push(['--- REVENUES ---', '', '']);
      (pnl.revenues || []).forEach(r => rows.push([r.code, r.name, r.amount]));
      rows.push(['TOTAL REVENUE', '', pnl.total_revenue]);
      rows.push(['', '', '']);
      rows.push(['--- EXPENSES ---', '', '']);
      (pnl.expenses || []).forEach(e => rows.push([e.code, e.name, e.amount]));
      rows.push(['TOTAL EXPENSES', '', pnl.total_expense]);
      rows.push(['', '', '']);
      rows.push(['NET PROFIT / LOSS', '', pnl.net_profit]);
      exportToCSV(`profit_and_loss_${timestamp}.csv`, ['Code / Section', 'Account Name', 'Amount'], rows);
      showToast('Profit & Loss statement exported to CSV!', 'success');
    } else if (activeReportTab === 'bs' && balanceSheet) {
      const rows: (string | number)[][] = [];
      rows.push(['--- ASSETS ---', '', '']);
      (balanceSheet.assets || []).forEach(a => rows.push([a.code, a.name, a.amount]));
      rows.push(['TOTAL ASSETS', '', balanceSheet.total_assets]);
      rows.push(['', '', '']);
      rows.push(['--- LIABILITIES ---', '', '']);
      (balanceSheet.liabilities || []).forEach(l => rows.push([l.code, l.name, l.amount]));
      rows.push(['--- EQUITY ---', '', '']);
      (balanceSheet.equity || []).forEach(eq => rows.push([eq.code, eq.name, eq.amount]));
      rows.push(['TOTAL LIABILITIES & EQUITY', '', balanceSheet.total_liabilities_and_equity]);
      exportToCSV(`balance_sheet_${timestamp}.csv`, ['Code / Section', 'Account Name', 'Amount'], rows);
      showToast('Balance Sheet statement exported to CSV!', 'success');
    } else if (activeReportTab === 'ar_aging' && arAging) {
      const rows = (arAging.customers || []).map((c: any) => [
        c.customer_name, c.current_0_30, c.days_31_60, c.days_61_90, c.days_90_plus, c.total_due
      ]);
      exportToCSV(`ar_aging_report_${timestamp}.csv`, ['Customer Name', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Outstanding'], rows);
      showToast('AR Aging report exported to CSV!', 'success');
    } else if (activeReportTab === 'ap_aging' && apAging) {
      const rows = (apAging.vendors || []).map((v: any) => [
        v.vendor_name, v.current_0_30, v.days_31_60, v.days_61_90, v.days_90_plus, v.total_due
      ]);
      exportToCSV(`ap_aging_report_${timestamp}.csv`, ['Vendor Name', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Payables'], rows);
      showToast('AP Aging report exported to CSV!', 'success');
    }
  };

  const handleExportCurrentReportJSON = () => {
    const timestamp = asOfDate;
    let dataToExport: any = null;
    let filename = `report_${activeReportTab}_${timestamp}.json`;

    if (activeReportTab === 'trial') dataToExport = trialBalance;
    else if (activeReportTab === 'pnl') dataToExport = pnl;
    else if (activeReportTab === 'bs') dataToExport = balanceSheet;
    else if (activeReportTab === 'ar_aging') dataToExport = arAging;
    else if (activeReportTab === 'ap_aging') dataToExport = apAging;

    if (dataToExport) {
      exportToJSON(filename, dataToExport);
      showToast('Report data exported to JSON!', 'success');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Financial Intelligence & Compliance Reports</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Real-time Trial Balance, Profit & Loss, Balance Sheet, and Receivables/Payables Aging Statements
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-outline" 
            onClick={handleExportCurrentReportCSV}
            style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileSpreadsheet size={15} color="#34d399" /> Export CSV
          </button>
          <button 
            className="btn btn-outline" 
            onClick={handleExportCurrentReportJSON}
            style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileCode size={15} color="#60a5fa" /> Export JSON
          </button>
          <button className="btn btn-outline" onClick={() => window.print()} style={{ fontSize: '0.82rem', padding: '7px 12px' }}>
            <Printer size={15} /> Print Report
          </button>
        </div>
      </div>

      {/* Report Selector Tabs & As-Of Date Picker */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Reports Filter Dropdown with all buttons inside */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--primary)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Filter size={16} />
              <span>Report: <strong>{currentReport.label}</strong></span>
              <ChevronDown
                size={15}
                style={{
                  transform: showFilterMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>

            {showFilterMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  onClick={() => setShowFilterMenu(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 95,
                    minWidth: '320px',
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Select Report
                  </div>

                  {reportOptions.map(opt => {
                    const isSelected = activeReportTab === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setActiveReportTab(opt.id as any);
                          setShowFilterMenu(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                          color: isSelected ? 'var(--primary)' : '#e2e8f0',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: '#FFFFFF',
                                color: '#F97316',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {opt.id.toUpperCase()}
                            </span>
                            <span>{opt.label}</span>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingLeft: '2px' }}>
                            {opt.desc}
                          </span>
                        </div>
                        {isSelected && <Check size={16} color="var(--primary)" style={{ flexShrink: 0, marginLeft: '8px' }} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>As Of Date:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '150px', padding: '6px 10px' }}
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Report 1: Trial Balance */}
      {activeReportTab === 'trial' && (
        <div className="glass-panel">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Trial Balance Statement</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0' }}>As of {asOfDate}</p>
            </div>

            {!loading && trialBalance && (
              trialBalance.is_balanced ? (
                <div className="badge badge-emerald" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} /> Mathematically Balanced (Debits = Credits)
                </div>
              ) : (
                <div className="badge badge-crimson" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} /> Discrepancy Found! Diff: {formatCurrency(trialBalance.difference)}
                </div>
              )
            )}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Debit Balance ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>Credit Balance ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>Calculating Trial Balance...</td></tr>
                ) : (trialBalance?.accounts || []).map(acc => (
                  <tr key={acc.account_id}>
                    <td className="font-mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{acc.code}</td>
                    <td style={{ fontWeight: 500 }}>{acc.name}</td>
                    <td><span className="badge badge-blue">{acc.category}</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', color: parseFloat(acc.debit) > 0 ? '#34d399' : 'var(--text-dim)' }}>
                      {parseFloat(acc.debit) > 0 ? formatCurrency(acc.debit) : '-'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: parseFloat(acc.credit) > 0 ? '#60a5fa' : 'var(--text-dim)' }}>
                      {parseFloat(acc.credit) > 0 ? formatCurrency(acc.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1e293b', fontWeight: 700, fontSize: '0.95rem' }}>
                  <td colSpan={3} style={{ padding: '14px 18px' }}>TOTAL TRIAL BALANCE</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: '#34d399' }}>{formatCurrency(trialBalance?.total_debits || '0')}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: '#60a5fa' }}>{formatCurrency(trialBalance?.total_credits || '0')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Report 2: Profit and Loss */}
      {activeReportTab === 'pnl' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Profit & Loss Statement (Income Statement)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0' }}>Period Ending {pnl?.end_date}</p>
            </div>

            <div className={`badge ${pnl?.is_profitable ? 'badge-emerald' : 'badge-crimson'}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              Net Profit: {formatCurrency(pnl?.net_profit || '0')}
            </div>
          </div>

          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Revenues */}
            <div style={{ background: '#1e293b', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: '#34d399', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Revenues (Operating Income)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(pnl?.revenues || []).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{r.code} - {r.name}</span>
                    <strong className="font-mono" style={{ color: '#34d399' }}>{formatCurrency(r.amount)}</strong>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '10px', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                <span>Total Revenue:</span>
                <span className="font-mono" style={{ color: '#34d399' }}>{formatCurrency(pnl?.total_revenue || '0')}</span>
              </div>
            </div>

            {/* Expenses */}
            <div style={{ background: '#1e293b', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: '#f87171', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Expenses (Operating Costs)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(pnl?.expenses || []).map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{e.code} - {e.name}</span>
                    <strong className="font-mono" style={{ color: '#f87171' }}>{formatCurrency(e.amount)}</strong>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '10px', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                <span>Total Expenses:</span>
                <span className="font-mono" style={{ color: '#f87171' }}>{formatCurrency(pnl?.total_expense || '0')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report 3: Balance Sheet */}
      {activeReportTab === 'bs' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Balance Sheet Statement</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0' }}>As of {balanceSheet?.as_of_date}</p>
            </div>

            {!loading && balanceSheet && (
              balanceSheet.is_balanced ? (
                <div className="badge badge-emerald" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} /> Balanced Equation (Assets = Liabilities + Equity)
                </div>
              ) : (
                <div className="badge badge-crimson" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} /> Balance Sheet Off! Diff: {formatCurrency(balanceSheet.difference)}
                </div>
              )
            )}
          </div>

          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Assets */}
            <div style={{ background: '#1e293b', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: '#60a5fa', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Assets (Economic Resources)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(balanceSheet?.assets || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{a.code} - {a.name}</span>
                    <strong className="font-mono" style={{ color: '#60a5fa' }}>{formatCurrency(a.amount)}</strong>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '10px', borderTop: '2px solid var(--border-color)', fontWeight: 700, fontSize: '1.05rem' }}>
                <span>Total Assets:</span>
                <span className="font-mono" style={{ color: '#60a5fa' }}>{formatCurrency(balanceSheet?.total_assets || '0')}</span>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div style={{ background: '#1e293b', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: '#a78bfa', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Liabilities & Equity (Claims & Capital)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Liabilities</div>
                {(balanceSheet?.liabilities || []).map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingLeft: '8px' }}>
                    <span>{l.code} - {l.name}</span>
                    <strong className="font-mono">{formatCurrency(l.amount)}</strong>
                  </div>
                ))}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '8px' }}>Equity</div>
                {(balanceSheet?.equity || []).map((eq, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingLeft: '8px' }}>
                    <span>{eq.code} - {eq.name}</span>
                    <strong className="font-mono" style={{ color: '#a78bfa' }}>{formatCurrency(eq.amount)}</strong>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '10px', borderTop: '2px solid var(--border-color)', fontWeight: 700, fontSize: '1.05rem' }}>
                <span>Total Liabilities & Equity:</span>
                <span className="font-mono" style={{ color: '#a78bfa' }}>{formatCurrency(balanceSheet?.total_liabilities_and_equity || '0')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report 4: AR Aging */}
      {activeReportTab === 'ar_aging' && (
        <div className="glass-panel">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Accounts Receivable (AR) Aging Buckets</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th style={{ textAlign: 'right' }}>0 - 30 Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>31 - 60 Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>61 - 90 Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>90+ Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>Total Outstanding ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {(arAging?.customers || []).map((c: any) => (
                  <tr key={c.customer_id}>
                    <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(c.current_0_30)}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(c.days_31_60)}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(c.days_61_90)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--accent-crimson)' }}>{formatCurrency(c.days_90_plus)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-amber)' }}>{formatCurrency(c.total_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 5: AP Aging */}
      {activeReportTab === 'ap_aging' && (
        <div className="glass-panel">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Accounts Payable (AP) Aging Buckets</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th style={{ textAlign: 'right' }}>0 - 30 Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>31 - 60 Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>61 - 90 Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>90+ Days ({currencySymbol})</th>
                  <th style={{ textAlign: 'right' }}>Total Payables ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {(apAging?.vendors || []).map((v: any) => (
                  <tr key={v.vendor_id}>
                    <td style={{ fontWeight: 600 }}>{v.vendor_name}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(v.current_0_30)}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(v.days_31_60)}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(v.days_61_90)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--accent-crimson)' }}>{formatCurrency(v.days_90_plus)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-purple)' }}>{formatCurrency(v.total_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
