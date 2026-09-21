import React, { useState, useEffect } from 'react';
import { 
  X, Search, FileSpreadsheet, Eye, 
  FolderTree, BookOpen, FileText, Receipt, Landmark, Layers,
  UploadCloud, CheckCircle2, AlertCircle, Printer
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { exportToExcelHTML, type ReportTableSection } from '../utils/exportImportUtils';

interface DataViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'accounts' | 'vouchers' | 'invoices' | 'bills' | 'customers' | 'vendors' | 'banking';
}

export const DataViewerModal: React.FC<DataViewerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'accounts'
}) => {
  const { showToast } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();

  const [activeTab, setActiveTab] = useState<'accounts' | 'vouchers' | 'invoices' | 'bills' | 'customers' | 'vendors' | 'banking'>(initialTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [dataPayload, setDataPayload] = useState<{
    accounts: any[];
    vouchers: any[];
    invoices: any[];
    bills: any[];
    customers: any[];
    vendors: any[];
    banking: any[];
  }>({
    accounts: [],
    vouchers: [],
    invoices: [],
    bills: [],
    customers: [],
    vendors: [],
    banking: []
  });

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSystemData();
    }
  }, [isOpen]);

  const loadSystemData = async () => {
    try {
      setLoading(true);
      const [resAcc, resEntries, resInv, resBills, resCust, resVend, resBanks] = await Promise.all([
        api.get('accounts/').catch(() => ({ data: [] })),
        api.get('journal-entries/').catch(() => ({ data: [] })),
        api.get('invoices/').catch(() => ({ data: [] })),
        api.get('bills/').catch(() => ({ data: [] })),
        api.get('customers/').catch(() => ({ data: [] })),
        api.get('vendors/').catch(() => ({ data: [] })),
        api.get('bank-transactions/').catch(() => ({ data: [] }))
      ]);

      const getArray = (data: any) => Array.isArray(data) ? data : (data.results || []);

      setDataPayload({
        accounts: getArray(resAcc.data),
        vouchers: getArray(resEntries.data),
        invoices: getArray(resInv.data),
        bills: getArray(resBills.data),
        customers: getArray(resCust.data),
        vendors: getArray(resVend.data),
        banking: getArray(resBanks.data)
      });
    } catch (err: any) {
      showToast('Failed to load dataset for inspection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const data = parsed.data || parsed;

        setDataPayload({
          accounts: data.accounts || [],
          vouchers: data.vouchers || [],
          invoices: data.invoices || [],
          bills: data.bills || [],
          customers: data.customers || [],
          vendors: data.vendors || [],
          banking: data.banking || []
        });
        setUploadedFileName(file.name);
        showToast(`Backup file "${file.name}" loaded into visual reader!`, 'success');
      } catch (err) {
        showToast('Invalid JSON file format', 'error');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const currentList = dataPayload[activeTab] || [];
  const filteredList = currentList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(q);
  });

  const handleExportCurrentTableExcel = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const section: ReportTableSection = {
      title: activeTab.toUpperCase() + ' - DETAILED FINANCIAL LEDGER',
      headers: [],
      rows: []
    };

    if (activeTab === 'accounts') {
      section.headers = ['Account Code', 'Account Name', 'Category', 'Opening Balance', 'Current Balance', 'Active Status'];
      section.rows = currentList.map(a => [a.code, a.name, a.category, formatCurrency(a.opening_balance), formatCurrency(a.current_balance), a.is_active ? 'Active' : 'Inactive']);
    } else if (activeTab === 'vouchers') {
      section.headers = ['Voucher No', 'Date', 'Type', 'Status', 'Narration', 'Total Debit', 'Total Credit', 'Balanced'];
      section.rows = currentList.map(v => [v.entry_number, v.date, v.entry_type, v.status, v.narration, formatCurrency(v.total_debit), formatCurrency(v.total_credit), v.is_balanced ? 'Balanced' : 'Unbalanced']);
    } else if (activeTab === 'invoices') {
      section.headers = ['Invoice #', 'Customer', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Grand Total', 'Status', 'Paid Amount', 'Due Balance'];
      section.rows = currentList.map(inv => [inv.invoice_number, inv.customer_details?.name || inv.customer, inv.issue_date, inv.due_date, formatCurrency(inv.subtotal), formatCurrency(inv.tax_amount), formatCurrency(inv.grand_total), inv.status, formatCurrency(inv.paid_amount), formatCurrency(inv.remaining_balance)]);
    } else if (activeTab === 'bills') {
      section.headers = ['Bill #', 'Vendor', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Grand Total', 'Status', 'Paid Amount', 'Due Balance'];
      section.rows = currentList.map(b => [b.bill_number, b.vendor_details?.name || b.vendor, b.issue_date, b.due_date, formatCurrency(b.subtotal), formatCurrency(b.tax_amount), formatCurrency(b.grand_total), b.status, formatCurrency(b.paid_amount), formatCurrency(b.remaining_balance)]);
    } else if (activeTab === 'customers') {
      section.headers = ['Customer Name', 'Email', 'Phone', 'Address', 'Tax ID'];
      section.rows = currentList.map(c => [c.name, c.email, c.phone, c.address, c.tax_id]);
    } else if (activeTab === 'vendors') {
      section.headers = ['Vendor Name', 'Email', 'Phone', 'Address', 'Tax ID'];
      section.rows = currentList.map(v => [v.name, v.email, v.phone, v.address, v.tax_id]);
    } else if (activeTab === 'banking') {
      section.headers = ['Date', 'Bank Account', 'Description', 'Reference', 'Amount', 'Reconciled'];
      section.rows = currentList.map(t => [t.transaction_date, t.bank_account, t.description, t.reference, formatCurrency(t.amount), t.is_reconciled ? 'Yes' : 'No']);
    }

    exportToExcelHTML(`ledgerflow_${activeTab}_report_${timestamp}.xls`, `LedgerFlow - ${activeTab.toUpperCase()} Report`, [section]);
    showToast(`Exported ${activeTab} to Excel Spreadsheet!`, 'success');
  };

  const navTabs = [
    { id: 'accounts' as const, label: 'Chart of Accounts', icon: FolderTree, count: dataPayload.accounts.length },
    { id: 'vouchers' as const, label: 'Journal Entries', icon: BookOpen, count: dataPayload.vouchers.length },
    { id: 'invoices' as const, label: 'Invoices (AR)', icon: FileText, count: dataPayload.invoices.length },
    { id: 'bills' as const, label: 'Bills (AP)', icon: Receipt, count: dataPayload.bills.length },
    { id: 'customers' as const, label: 'Customers', icon: Layers, count: dataPayload.customers.length },
    { id: 'vendors' as const, label: 'Vendors', icon: Layers, count: dataPayload.vendors.length },
    { id: 'banking' as const, label: 'Bank Statement', icon: Landmark, count: dataPayload.banking.length },
  ];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '1080px', 
          maxWidth: '96%', 
          height: '88vh',
          maxHeight: '850px',
          borderRadius: '16px',
          background: '#0f172a',
          border: '1px solid rgba(249,115,22,0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
            }}>
              <Eye size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                  Visual Financial Data & Backup Inspector
                </h3>
                {uploadedFileName && (
                  <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                    <CheckCircle2 size={11} /> File: {uploadedFileName}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>
                Easily read, check, verify, and export complete financial ledgers in human-readable formatted tables.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Upload File to Read */}
            <label 
              className="btn btn-outline" 
              style={{ fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Open and read any downloaded backup or JSON file in this visual table"
            >
              <UploadCloud size={14} color="#38BDF8" /> Open Backup File
              <input type="file" accept=".json,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            {/* Export Current View to Excel */}
            <button
              type="button"
              className="btn btn-emerald"
              onClick={handleExportCurrentTableExcel}
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={14} /> Download Excel (.xls)
            </button>

            {/* Print / Clean View */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => window.print()}
              style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Print formatted ledger"
            >
              <Printer size={14} />
            </button>

            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '6px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '10px 18px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto'
        }}>
          {navTabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setSearchQuery('');
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: isActive ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                  background: isActive ? 'rgba(249,115,22,0.15)' : 'transparent',
                  color: isActive ? '#F97316' : '#9CA3AF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                <span style={{
                  fontSize: '0.7rem',
                  background: isActive ? '#F97316' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#fff' : '#D1D5DB',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter / Search Bar */}
        <div style={{
          padding: '10px 18px',
          background: 'rgba(0,0,0,0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '450px' }}>
            <Search size={16} color="#9CA3AF" />
            <input
              placeholder={`Search in ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
            Showing <strong>{filteredList.length}</strong> of {currentList.length} records
          </div>
        </div>

        {/* Table Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>
              Loading data for inspection...
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9CA3AF' }}>
              <AlertCircle size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#E5E7EB' }}>No records found</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>No entries match your search filter or dataset is empty.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#9CA3AF', background: 'rgba(255,255,255,0.02)' }}>
                    {activeTab === 'accounts' && (
                      <>
                        <th style={{ padding: '10px 12px' }}>Code</th>
                        <th style={{ padding: '10px 12px' }}>Account Name</th>
                        <th style={{ padding: '10px 12px' }}>Category</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Opening Balance</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Current Balance</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                      </>
                    )}
                    {activeTab === 'vouchers' && (
                      <>
                        <th style={{ padding: '10px 12px' }}>Voucher #</th>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                        <th style={{ padding: '10px 12px' }}>Type</th>
                        <th style={{ padding: '10px 12px' }}>Narration</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Debit ({currencySymbol})</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit ({currencySymbol})</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Balanced</th>
                      </>
                    )}
                    {activeTab === 'invoices' && (
                      <>
                        <th style={{ padding: '10px 12px' }}>Invoice #</th>
                        <th style={{ padding: '10px 12px' }}>Customer</th>
                        <th style={{ padding: '10px 12px' }}>Issue Date</th>
                        <th style={{ padding: '10px 12px' }}>Due Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Grand Total</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Remaining</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                      </>
                    )}
                    {activeTab === 'bills' && (
                      <>
                        <th style={{ padding: '10px 12px' }}>Bill #</th>
                        <th style={{ padding: '10px 12px' }}>Vendor</th>
                        <th style={{ padding: '10px 12px' }}>Issue Date</th>
                        <th style={{ padding: '10px 12px' }}>Due Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Grand Total</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Remaining</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                      </>
                    )}
                    {(activeTab === 'customers' || activeTab === 'vendors') && (
                      <>
                        <th style={{ padding: '10px 12px' }}>Name</th>
                        <th style={{ padding: '10px 12px' }}>Email</th>
                        <th style={{ padding: '10px 12px' }}>Phone</th>
                        <th style={{ padding: '10px 12px' }}>Address</th>
                        <th style={{ padding: '10px 12px' }}>Tax ID</th>
                      </>
                    )}
                    {activeTab === 'banking' && (
                      <>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                        <th style={{ padding: '10px 12px' }}>Bank Account</th>
                        <th style={{ padding: '10px 12px' }}>Description</th>
                        <th style={{ padding: '10px 12px' }}>Reference</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Reconciled</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((row, idx) => (
                    <tr 
                      key={row.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {activeTab === 'accounts' && (
                        <>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F97316' }}>{row.code}</td>
                          <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{row.category}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#9CA3AF' }}>{formatCurrency(row.opening_balance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{formatCurrency(row.current_balance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ color: row.is_active !== false ? '#10B981' : '#EF4444', fontSize: '0.75rem', fontWeight: 600 }}>
                              {row.is_active !== false ? '● Active' : '○ Inactive'}
                            </span>
                          </td>
                        </>
                      )}

                      {activeTab === 'vouchers' && (
                        <>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#60A5FA' }}>{row.entry_number}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.date}</td>
                          <td style={{ padding: '10px 12px' }}><span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>{row.entry_type}</span></td>
                          <td style={{ padding: '10px 12px', color: '#E5E7EB', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.narration || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>{formatCurrency(row.total_debit)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>{formatCurrency(row.total_credit)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ color: row.is_balanced ? '#10B981' : '#EF4444', fontSize: '0.75rem', fontWeight: 600 }}>
                              {row.is_balanced ? '✓ Balanced' : '✕ Unbalanced'}
                            </span>
                          </td>
                        </>
                      )}

                      {activeTab === 'invoices' && (
                        <>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#F97316' }}>{row.invoice_number}</td>
                          <td style={{ padding: '10px 12px', color: '#fff' }}>{row.customer_details?.name || row.customer || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.issue_date}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.due_date}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>{formatCurrency(row.grand_total)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#F87171' }}>{formatCurrency(row.remaining_balance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span className={row.status === 'PAID' ? 'badge badge-emerald' : row.status === 'OVERDUE' ? 'badge badge-crimson' : 'badge badge-orange'} style={{ fontSize: '0.72rem' }}>
                              {row.status}
                            </span>
                          </td>
                        </>
                      )}

                      {activeTab === 'bills' && (
                        <>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#A78BFA' }}>{row.bill_number}</td>
                          <td style={{ padding: '10px 12px', color: '#fff' }}>{row.vendor_details?.name || row.vendor || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.issue_date}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.due_date}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>{formatCurrency(row.grand_total)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#F87171' }}>{formatCurrency(row.remaining_balance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span className={row.status === 'PAID' ? 'badge badge-emerald' : 'badge badge-orange'} style={{ fontSize: '0.72rem' }}>
                              {row.status}
                            </span>
                          </td>
                        </>
                      )}

                      {(activeTab === 'customers' || activeTab === 'vendors') && (
                        <>
                          <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.email || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.phone || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.address || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#FDBA74' }}>{row.tax_id || '-'}</td>
                        </>
                      )}

                      {activeTab === 'banking' && (
                        <>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.transaction_date}</td>
                          <td style={{ padding: '10px 12px', color: '#fff' }}>{row.bank_account}</td>
                          <td style={{ padding: '10px 12px', color: '#E5E7EB' }}>{row.description}</td>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{row.reference || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: Number(row.amount) >= 0 ? '#10B981' : '#F87171' }}>
                            {formatCurrency(row.amount)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ color: row.is_reconciled ? '#10B981' : '#FBBF24', fontSize: '0.75rem', fontWeight: 600 }}>
                              {row.is_reconciled ? '✓ Reconciled' : '⏳ Pending'}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          color: '#9CA3AF'
        }}>
          <div>
            💡 <em>Tip: You can open this report in Microsoft Excel or Google Sheets using the "Download Excel" button above.</em>
          </div>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
