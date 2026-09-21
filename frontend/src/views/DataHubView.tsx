import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Download, UploadCloud, FileSpreadsheet, FileCode, 
  FolderTree, BookOpen, FileText, Receipt, Landmark, 
  RefreshCw, ArrowUpDown, Layers, HardDrive
} from 'lucide-react';
import type { ImportType } from '../utils/exportImportUtils';
import { 
  exportToCSV, exportToJSON, downloadSampleTemplate, fetchExportFromBackend 
} from '../utils/exportImportUtils';
import { ImportModal } from '../components/ImportModal';
import type { BankAccount } from '../types';

export const DataHubView: React.FC = () => {
  const { showToast, activeRole } = useAuth();

  const [activeImportType, setActiveImportType] = useState<ImportType | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [stats, setStats] = useState<{
    accountsCount: number;
    entriesCount: number;
    invoicesCount: number;
    billsCount: number;
    customersCount: number;
    vendorsCount: number;
    banksCount: number;
  }>({
    accountsCount: 0,
    entriesCount: 0,
    invoicesCount: 0,
    billsCount: 0,
    customersCount: 0,
    vendorsCount: 0,
    banksCount: 0
  });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [exportingType, setExportingType] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      setLoadingStats(true);
      const [resAcc, resEntries, resInv, resBills, resCust, resVend, resBanks] = await Promise.all([
        api.get('accounts/'),
        api.get('journal-entries/'),
        api.get('invoices/'),
        api.get('bills/'),
        api.get('customers/'),
        api.get('vendors/'),
        api.get('bank-accounts/')
      ]);

      const getCount = (data: any) => Array.isArray(data) ? data.length : (data.results ? data.results.length : 0);
      const banks = Array.isArray(resBanks.data) ? resBanks.data : (resBanks.data.results || []);
      setBankAccounts(banks);

      setStats({
        accountsCount: getCount(resAcc.data),
        entriesCount: getCount(resEntries.data),
        invoicesCount: getCount(resInv.data),
        billsCount: getCount(resBills.data),
        customersCount: getCount(resCust.data),
        vendorsCount: getCount(resVend.data),
        banksCount: banks.length
      });
    } catch (err) {
      console.error('Failed to load system stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleExportDataset = async (type: ImportType, format: 'csv' | 'json') => {
    try {
      setExportingType(`${type}-${format}`);
      const timestamp = new Date().toISOString().split('T')[0];

      if (type === 'all') {
        const fullBackup = await fetchExportFromBackend('all');
        exportToJSON(`ledgerflow_backup_${timestamp}.json`, fullBackup);
        showToast('Full system backup exported successfully!', 'success');
        return;
      }

      if (format === 'json') {
        const res = await fetchExportFromBackend(type);
        exportToJSON(`ledgerflow_${type}_${timestamp}.json`, res.data?.[type] || res.data || res);
        showToast(`Exported ${type} to JSON!`, 'success');
        return;
      }

      // CSV Export
      if (type === 'accounts') {
        const res = await api.get('accounts/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `chart_of_accounts_${timestamp}.csv`,
          ['Account Code', 'Account Name', 'Category', 'Opening Balance', 'Current Balance', 'Active'],
          list.map((a: any) => [a.code, a.name, a.category, a.opening_balance, a.current_balance, a.is_active ? 'YES' : 'NO'])
        );
      } else if (type === 'vouchers') {
        const res = await api.get('journal-entries/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `journal_vouchers_${timestamp}.csv`,
          ['Voucher Number', 'Date', 'Type', 'Status', 'Narration', 'Total Debit', 'Total Credit', 'Balanced'],
          list.map((v: any) => [v.entry_number, v.date, v.entry_type, v.status, v.narration, v.total_debit, v.total_credit, v.is_balanced ? 'YES' : 'NO'])
        );
      } else if (type === 'invoices') {
        const res = await api.get('invoices/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `sales_invoices_${timestamp}.csv`,
          ['Invoice Number', 'Customer', 'Issue Date', 'Due Date', 'Subtotal', 'Tax Amount', 'Grand Total', 'Status', 'Paid Amount', 'Remaining Balance'],
          list.map((inv: any) => [
            inv.invoice_number, 
            inv.customer_details?.name || inv.customer, 
            inv.issue_date, 
            inv.due_date, 
            inv.subtotal, 
            inv.tax_amount, 
            inv.grand_total, 
            inv.status, 
            inv.paid_amount, 
            inv.remaining_balance
          ])
        );
      } else if (type === 'bills') {
        const res = await api.get('bills/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `purchase_bills_${timestamp}.csv`,
          ['Bill Number', 'Vendor', 'Issue Date', 'Due Date', 'Subtotal', 'Tax Amount', 'Grand Total', 'Status', 'Paid Amount', 'Remaining Balance'],
          list.map((b: any) => [
            b.bill_number, 
            b.vendor_details?.name || b.vendor, 
            b.issue_date, 
            b.due_date, 
            b.subtotal, 
            b.tax_amount, 
            b.grand_total, 
            b.status, 
            b.paid_amount, 
            b.remaining_balance
          ])
        );
      } else if (type === 'customers') {
        const res = await api.get('customers/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `customers_${timestamp}.csv`,
          ['Name', 'Email', 'Phone', 'Address', 'Tax ID'],
          list.map((c: any) => [c.name, c.email, c.phone, c.address, c.tax_id])
        );
      } else if (type === 'vendors') {
        const res = await api.get('vendors/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `vendors_${timestamp}.csv`,
          ['Name', 'Email', 'Phone', 'Address', 'Tax ID'],
          list.map((v: any) => [v.name, v.email, v.phone, v.address, v.tax_id])
        );
      } else if (type === 'banking') {
        const res = await api.get('bank-transactions/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        exportToCSV(
          `bank_transactions_${timestamp}.csv`,
          ['Date', 'Bank Account', 'Description', 'Reference', 'Amount', 'Reconciled'],
          list.map((t: any) => [t.transaction_date, t.bank_account, t.description, t.reference, t.amount, t.is_reconciled ? 'YES' : 'NO'])
        );
      }

      showToast(`Exported ${type} to CSV successfully!`, 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    } finally {
      setExportingType(null);
    }
  };

  const openImportModal = (type: ImportType) => {
    setActiveImportType(type);
    setShowImportModal(true);
  };

  const modules = [
    {
      id: 'accounts' as ImportType,
      title: 'Chart of Accounts (COA)',
      description: 'Asset, Liability, Equity, Revenue, and Expense codes & opening balances',
      icon: FolderTree,
      color: '#34D399',
      count: stats.accountsCount,
      countLabel: 'Accounts'
    },
    {
      id: 'vouchers' as ImportType,
      title: 'Journal Entries & Vouchers',
      description: 'Double-entry transaction vouchers, adjustments, and debit/credit ledger lines',
      icon: BookOpen,
      color: '#60A5FA',
      count: stats.entriesCount,
      countLabel: 'Vouchers'
    },
    {
      id: 'invoices' as ImportType,
      title: 'Sales Invoices & Receivables',
      description: 'Customer billing records, payment schedules, and sales tax line items',
      icon: FileText,
      color: '#F97316',
      count: stats.invoicesCount,
      countLabel: 'Invoices'
    },
    {
      id: 'bills' as ImportType,
      title: 'Purchase Bills & Payables',
      description: 'Vendor bills, expense invoices, payment dues, and vendor accounts',
      icon: Receipt,
      color: '#A78BFA',
      count: stats.billsCount,
      countLabel: 'Bills'
    },
    {
      id: 'customers' as ImportType,
      title: 'Customers Directory',
      description: 'Client contacts, addresses, billing emails, and tax identification numbers',
      icon: Layers,
      color: '#38BDF8',
      count: stats.customersCount,
      countLabel: 'Customers'
    },
    {
      id: 'vendors' as ImportType,
      title: 'Vendors Directory',
      description: 'Supplier contacts, addresses, payment terms, and vendor tax records',
      icon: Layers,
      color: '#FBBF24',
      count: stats.vendorsCount,
      countLabel: 'Vendors'
    },
    {
      id: 'banking' as ImportType,
      title: 'Bank Accounts & Statements',
      description: 'Bank accounts, historical statement transactions, deposits, and debits',
      icon: Landmark,
      color: '#2DD4BF',
      count: stats.banksCount,
      countLabel: 'Bank Accounts'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Data Import & Export Center</h2>
            <span className="badge badge-orange" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
              <ArrowUpDown size={12} /> Real-time Sync & Backup
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Seamlessly import, export, and backup financial data in Excel-ready CSV or structured JSON format.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-outline" 
            onClick={fetchSystemStats}
            disabled={loadingStats}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loadingStats ? 'animate-spin' : ''} /> Refresh Stats
          </button>
        </div>
      </div>

      {/* Full System Backup & Restore Hero Banner */}
      <div className="glass-panel" style={{ 
        background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(30,41,59,0.8) 100%)',
        border: '1px solid rgba(249,115,22,0.3)',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px', height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(249,115,22,0.4)',
              flexShrink: 0
            }}>
              <HardDrive size={26} color="#FFFFFF" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                Full System Database Backup & Disaster Recovery
              </h3>
              <p style={{ color: '#D1D5DB', fontSize: '0.85rem', margin: '4px 0 0', maxWidth: '600px' }}>
                Create a complete single-file snapshot of all accounts, journal vouchers, invoices, bills, customers, vendors, and bank records for safe archival or migration.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary"
              onClick={() => handleExportDataset('all', 'json')}
              disabled={exportingType === 'all-json'}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
            >
              <Download size={16} /> Export Full Backup (JSON)
            </button>

            {activeRole !== 'AUDITOR' && (
              <button 
                className="btn btn-outline"
                onClick={() => openImportModal('all')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'rgba(255,255,255,0.06)' }}
              >
                <UploadCloud size={16} /> Restore Backup File
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dataset Cards Grid */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: '#F3F4F6' }}>
          Module-by-Module Import & Export Tools
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {modules.map(mod => {
            const Icon = mod.icon;
            return (
              <div 
                key={mod.id} 
                className="glass-panel" 
                style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  gap: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', 
                        borderRadius: '10px', 
                        background: `${mod.color}20`,
                        border: `1px solid ${mod.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Icon size={20} color={mod.color} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{mod.title}</h4>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{mod.count} {mod.countLabel} in system</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      title="Download sample template"
                      onClick={() => downloadSampleTemplate(mod.id)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        color: '#9CA3AF',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Download size={12} /> Template
                    </button>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>
                    {mod.description}
                  </p>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: '14px',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleExportDataset(mod.id, 'csv')}
                      disabled={exportingType === `${mod.id}-csv`}
                    >
                      <FileSpreadsheet size={13} color="#34d399" /> CSV
                    </button>

                    <button 
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleExportDataset(mod.id, 'json')}
                      disabled={exportingType === `${mod.id}-json`}
                    >
                      <FileCode size={13} color="#60a5fa" /> JSON
                    </button>
                  </div>

                  {activeRole !== 'AUDITOR' && (
                    <button 
                      type="button"
                      className="btn btn-emerald"
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => openImportModal(mod.id)}
                    >
                      <UploadCloud size={14} /> Import
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Universal Import Modal */}
      {activeImportType && (
        <ImportModal 
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setActiveImportType(null);
          }}
          onSuccess={() => {
            fetchSystemStats();
          }}
          type={activeImportType}
          bankAccounts={bankAccounts}
        />
      )}
    </div>
  );
};
