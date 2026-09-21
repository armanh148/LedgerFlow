import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, X, FileText, BookOpen, FolderTree, Receipt, Landmark, 
  ArrowRight, ShieldCheck, ArrowUpDown, LayoutDashboard
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navigation' | 'Accounts' | 'Invoices' | 'Bills' | 'Vouchers' | 'Contacts';
  icon: any;
  tabId: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = ''
}) => {
  const { setActiveTab } = useAuth();
  const [query, setQuery] = useState<string>(initialQuery);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const staticNavigationItems: SearchResultItem[] = [
    { id: 'nav-dash', title: 'Dashboard', subtitle: 'Overview, liquidity & FX converter', category: 'Navigation', icon: LayoutDashboard, tabId: 'dashboard' },
    { id: 'nav-vouchers', title: 'Journal Vouchers & Tasks', subtitle: 'Post double-entry debit/credit entries', category: 'Navigation', icon: BookOpen, tabId: 'voucher' },
    { id: 'nav-coa', title: 'Chart of Accounts (COA)', subtitle: 'Manage asset, liability & equity accounts', category: 'Navigation', icon: FolderTree, tabId: 'coa' },
    { id: 'nav-bank', title: 'Bank & Accounts', subtitle: 'Reconciliation, cash & bank transactions', category: 'Navigation', icon: Landmark, tabId: 'banking' },
    { id: 'nav-invoices', title: 'Invoicing & AR', subtitle: 'Customer billing & revenue accounts', category: 'Navigation', icon: FileText, tabId: 'invoices' },
    { id: 'nav-bills', title: 'Bills & Payables', subtitle: 'Vendor expenses & payment vouchers', category: 'Navigation', icon: Receipt, tabId: 'bills' },
    { id: 'nav-reports', title: 'Financial Reports', subtitle: 'Trial Balance, P&L, Balance Sheet & Aging', category: 'Navigation', icon: FileText, tabId: 'reports' },
    { id: 'nav-datahub', title: 'Import & Export Hub', subtitle: 'Full backup, restore & dataset import/export', category: 'Navigation', icon: ArrowUpDown, tabId: 'datahub' },
    { id: 'nav-audit', title: 'Audit & Security', subtitle: 'Immutable audit logs & period closing locks', category: 'Navigation', icon: ShieldCheck, tabId: 'audit' },
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      searchEntities(query);
    }
  }, [isOpen]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchEntities(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const searchEntities = async (searchTerm: string) => {
    const q = searchTerm.trim().toLowerCase();
    
    // Always filter navigation items
    const navMatches = staticNavigationItems.filter(item => 
      !q || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
    );

    if (!q) {
      setResults(navMatches);
      setSelectedIndex(0);
      return;
    }

    try {
      setLoading(true);
      const [resAcc, resInv, resBills, resEntries] = await Promise.all([
        api.get('accounts/').catch(() => ({ data: [] })),
        api.get('invoices/').catch(() => ({ data: [] })),
        api.get('bills/').catch(() => ({ data: [] })),
        api.get('journal-entries/').catch(() => ({ data: [] }))
      ]);

      const accounts = Array.isArray(resAcc.data) ? resAcc.data : (resAcc.data?.results || []);
      const invoices = Array.isArray(resInv.data) ? resInv.data : (resInv.data?.results || []);
      const bills = Array.isArray(resBills.data) ? resBills.data : (resBills.data?.results || []);
      const entries = Array.isArray(resEntries.data) ? resEntries.data : (resEntries.data?.results || []);

      const dynamicResults: SearchResultItem[] = [];

      // Match Accounts
      accounts.forEach((acc: any) => {
        if (acc.code?.toLowerCase().includes(q) || acc.name?.toLowerCase().includes(q)) {
          dynamicResults.push({
            id: `acc-${acc.id}`,
            title: `${acc.code} - ${acc.name}`,
            subtitle: `Chart Account · Category: ${acc.category}`,
            category: 'Accounts',
            icon: FolderTree,
            tabId: 'coa'
          });
        }
      });

      // Match Invoices
      invoices.forEach((inv: any) => {
        const custName = inv.customer_details?.name || '';
        if (inv.invoice_number?.toLowerCase().includes(q) || custName.toLowerCase().includes(q)) {
          dynamicResults.push({
            id: `inv-${inv.id}`,
            title: `Invoice #${inv.invoice_number}`,
            subtitle: `Customer: ${custName || 'General Customer'} · Status: ${inv.status}`,
            category: 'Invoices',
            icon: FileText,
            tabId: 'invoices'
          });
        }
      });

      // Match Bills
      bills.forEach((bill: any) => {
        const vendName = bill.vendor_details?.name || '';
        if (bill.bill_number?.toLowerCase().includes(q) || vendName.toLowerCase().includes(q)) {
          dynamicResults.push({
            id: `bill-${bill.id}`,
            title: `Bill #${bill.bill_number}`,
            subtitle: `Vendor: ${vendName || 'General Vendor'} · Status: ${bill.status}`,
            category: 'Bills',
            icon: Receipt,
            tabId: 'bills'
          });
        }
      });

      // Match Vouchers
      entries.forEach((e: any) => {
        if (e.entry_number?.toLowerCase().includes(q) || e.narration?.toLowerCase().includes(q)) {
          dynamicResults.push({
            id: `jv-${e.id}`,
            title: `Voucher #${e.entry_number}`,
            subtitle: `Memo: ${e.narration || e.entry_type} · Status: ${e.status}`,
            category: 'Vouchers',
            icon: BookOpen,
            tabId: 'voucher'
          });
        }
      });

      setResults([...navMatches, ...dynamicResults]);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search error', err);
      setResults(navMatches);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    setActiveTab(item.tabId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (results.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % (results.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200, alignItems: 'flex-start', paddingTop: '80px' }}>
      <div 
        className="glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '640px', 
          maxWidth: '94%',
          borderRadius: '16px',
          background: '#0f172a',
          border: '1px solid rgba(249,115,22,0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Search Input Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          gap: '12px'
        }}>
          <Search size={20} color="#F97316" />
          <input
            ref={inputRef}
            placeholder="Search accounts, invoices, vouchers, bills, or navigation..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F9FAFB',
              fontSize: '1rem',
              fontFamily: 'var(--font-sans)'
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          )}
          <kbd style={{
            fontSize: '0.72rem',
            background: 'rgba(255,255,255,0.08)',
            color: '#9CA3AF',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>ESC</kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '8px' }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>
              Searching LedgerFlow records...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F3F4F6' }}>No records found</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try searching for an account code, invoice #, voucher, or feature.</div>
            </div>
          )}

          {results.map((item, index) => {
            const Icon = item.icon;
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(249,115,22,0.15)' : 'transparent',
                  border: isSelected ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  marginBottom: '2px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '34px', height: '34px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isSelected ? '#F97316' : '#9CA3AF'
                  }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? '#FFFFFF' : '#E5E7EB' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isSelected ? '#FDBA74' : '#9CA3AF' }}>
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#9CA3AF'
                  }}>
                    {item.category}
                  </span>
                  {isSelected && <ArrowRight size={14} color="#F97316" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div style={{
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: '#6B7280'
        }}>
          <div>Use <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>↑</kbd> <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>↓</kbd> to navigate, <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>Enter</kbd> to select</div>
          <div>LedgerFlow Quick Jump</div>
        </div>
      </div>
    </div>
  );
};
