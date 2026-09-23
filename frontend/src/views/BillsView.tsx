import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../api/client';
import type { Bill, Vendor, BillStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Plus, Search, Send, DollarSign, X, UploadCloud, FileSpreadsheet, FileCode, Filter, ChevronDown, Check } from 'lucide-react';
import { exportToCSV, exportToJSON } from '../utils/exportImportUtils';
import { ImportModal } from '../components/ImportModal';

export const BillsView: React.FC = () => {
  const { showToast, activeRole } = useAuth();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // New Bill Form
  const [vendorId, setVendorId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('Office Expense Bill');
  const [items, setItems] = useState<{ description: string; quantity: string; unit_price: string; tax_rate: string }[]>([
    { description: 'Monthly Office Lease & Utilities', quantity: '1.00', unit_price: '4500.00', tax_rate: '0.00' }
  ]);

  // Payment Form
  const [paidAmount, setPaidAmount] = useState<string>('0.00');
  const [paymentMode, setPaymentMode] = useState<string>('BANK_TRANSFER');
  const [referenceNum, setReferenceNum] = useState<string>('');

  useEffect(() => {
    fetchBills();
    fetchVendors();
  }, []);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await api.get('bills/');
      setBills(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      showToast('Failed to load vendor bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get('vendors/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setVendors(data);
      if (data.length > 0) setVendorId(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;
    items.forEach(item => {
      const q = parseFloat(item.quantity || '0');
      const p = parseFloat(item.unit_price || '0');
      const t = parseFloat(item.tax_rate || '0');
      const itemSub = q * p;
      subtotal += itemSub;
      taxAmount += itemSub * (t / 100);
    });
    const grandTotal = subtotal + taxAmount;
    return { subtotal, taxAmount, grandTotal };
  };

  const { subtotal, taxAmount, grandTotal } = calculateTotals();

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      showToast('Please select a vendor.', 'warning');
      return;
    }

    try {
      const billNumber = `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await api.post('bills/', {
        bill_number: billNumber,
        vendor: vendorId,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        grand_total: grandTotal.toFixed(2),
        notes: notes,
        status: 'DRAFT',
        items: items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
          total_price: ((parseFloat(i.quantity) * parseFloat(i.unit_price)) * (1 + parseFloat(i.tax_rate)/100)).toFixed(2)
        }))
      });

      showToast(`Created Bill ${billNumber}`, 'success');
      setShowCreateModal(false);
      fetchBills();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create bill', 'error');
    }
  };

  const handlePostToLedger = async (billId: string, billNum: string) => {
    if (activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Data Entry cannot post bills.', 'error');
      return;
    }

    try {
      await api.post(`bills/${billId}/post-to-ledger/`);
      showToast(`Posted Bill ${billNum} to General Ledger!`, 'success');
      fetchBills();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Posting failed', 'error');
    }
  };

  const handleOpenPaymentModal = (bill: Bill) => {
    setSelectedBill(bill);
    setPaidAmount(bill.remaining_balance);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    if (activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Data Entry cannot record vendor payments.', 'error');
      return;
    }

    try {
      const paymentNumber = `PMT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await api.post('vendor-payments/', {
        payment_number: paymentNumber,
        bill: selectedBill.id,
        paid_amount: paidAmount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: paymentMode,
        reference_number: referenceNum || 'VENDOR-PAY'
      });

      showToast(`Recorded Vendor Payment ${paymentNumber} for Bill ${selectedBill.bill_number}`, 'success');
      setShowPaymentModal(false);
      fetchBills();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Payment failed', 'error');
    }
  };

  const getStatusBadge = (st: BillStatus) => {
    switch (st) {
      case 'DRAFT': return 'badge-amber';
      case 'RECEIVED': return 'badge-blue';
      case 'PARTIALLY_PAID': return 'badge-purple';
      case 'PAID': return 'badge-emerald';
      case 'OVERDUE': return 'badge-crimson';
      default: return 'badge-amber';
    }
  };

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(
      `purchase_bills_${timestamp}.csv`,
      ['Bill Number', 'Vendor Name', 'Issue Date', 'Due Date', 'Subtotal', 'Tax Amount', 'Grand Total', 'Status', 'Paid Amount', 'Remaining Balance'],
      filteredBills.map(b => [
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
    showToast(`Exported ${filteredBills.length} bills to CSV`, 'success');
  };

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToJSON(`purchase_bills_${timestamp}.json`, filteredBills);
    showToast(`Exported ${filteredBills.length} bills to JSON`, 'success');
  };

  const statusOptions = [
    { id: 'ALL', label: 'All Bills', badge: 'badge-blue' },
    { id: 'DRAFT', label: 'Draft', badge: 'badge-amber' },
    { id: 'RECEIVED', label: 'Received', badge: 'badge-blue' },
    { id: 'PARTIALLY_PAID', label: 'Partially Paid', badge: 'badge-purple' },
    { id: 'PAID', label: 'Paid', badge: 'badge-emerald' },
    { id: 'OVERDUE', label: 'Overdue', badge: 'badge-crimson' },
  ];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: bills.length,
      DRAFT: 0,
      RECEIVED: 0,
      PARTIALLY_PAID: 0,
      PAID: 0,
      OVERDUE: 0,
    };
    bills.forEach(b => {
      if (counts[b.status] !== undefined) {
        counts[b.status]++;
      }
    });
    return counts;
  }, [bills]);

  const filteredBills = bills.filter(b => {
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchesSearch = b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (b.vendor_details?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bills & Accounts Payable (AP)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Track vendor expenditures, expense categorization, and partial payment settlement
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleExportCSV} 
              title="Export filtered bills to Excel CSV"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} color="#34d399" /> Export CSV
            </button>
            <button 
              className="btn btn-outline" 
              onClick={handleExportJSON} 
              title="Export filtered bills to JSON"
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
              <UploadCloud size={15} /> Import Bills
            </button>
          )}

          {activeRole !== 'AUDITOR' && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
              <Plus size={16} /> Create Bill
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* ALL Quick Button */}
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: statusFilter === 'ALL' ? 'var(--primary)' : '#1e293b',
                color: '#fff',
                fontWeight: statusFilter === 'ALL' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ALL
            </button>

            {/* Status Filter Dropdown with All Links */}
            <div style={{ position: 'relative' }} ref={filterRef}>
              <button
                type="button"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: statusFilter !== 'ALL' ? 'var(--primary)' : '#1e293b',
                  color: '#fff',
                  fontWeight: statusFilter !== 'ALL' ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Filter size={15} />
                <span>
                  {statusFilter === 'ALL'
                    ? 'Filter Status'
                    : `Status: ${statusFilter.replace('_', ' ')}`}
                </span>
                <ChevronDown
                  size={14}
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
                      minWidth: '220px',
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
                      All Status Filters
                    </div>

                    {statusOptions.map(opt => {
                      const isSelected = statusFilter === opt.id;
                      const count = statusCounts[opt.id] ?? 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt.id);
                            setShowFilterMenu(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
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
                              {opt.id === 'ALL' ? 'All' : opt.id.replace('_', ' ')}
                            </span>
                            <span>{opt.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({count})</span>
                            {isSelected && <Check size={14} color="var(--primary)" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              placeholder="Search bill # or vendor..."
              style={{ paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="glass-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total ({currencySymbol})</th>
                <th style={{ textAlign: 'right' }}>Remaining ({currencySymbol})</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading Bills...</td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No vendor bills found.</td>
                </tr>
              ) : (
                filteredBills.map(bill => (
                  <tr key={bill.id}>
                    <td className="font-mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{bill.bill_number}</td>
                    <td style={{ fontWeight: 500 }}>{bill.vendor_details?.name || 'Vendor'}</td>
                    <td>{bill.issue_date}</td>
                    <td>{bill.due_date}</td>
                    <td><span className={`badge ${getStatusBadge(bill.status)}`}>{bill.status}</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(bill.grand_total)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600, color: parseFloat(bill.remaining_balance) > 0 ? 'var(--accent-purple)' : '#34d399' }}>
                      {formatCurrency(bill.remaining_balance)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        {bill.status === 'DRAFT' && activeRole !== 'DATA_ENTRY' && activeRole !== 'AUDITOR' && (
                          <button
                            className="btn btn-emerald"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => handlePostToLedger(bill.id, bill.bill_number)}
                          >
                            <Send size={12} /> Post GL
                          </button>
                        )}

                        {bill.status !== 'PAID' && bill.status !== 'DRAFT' && activeRole !== 'DATA_ENTRY' && activeRole !== 'AUDITOR' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => handleOpenPaymentModal(bill)}
                          >
                            <DollarSign size={12} /> Pay Vendor
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Bill Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Vendor Bill</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Vendor</label>
                  <select className="form-select" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Issue Date</label>
                  <input type="date" className="form-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '8px' }}>Expense Items</label>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr 1fr 30px', gap: '8px', marginBottom: '8px' }}>
                    <input className="form-input" placeholder="Expense description" value={item.description} onChange={(e) => {
                      const next = [...items]; next[idx].description = e.target.value; setItems(next);
                    }} required />
                    <input type="number" step="0.01" className="form-input font-mono" placeholder="Qty" value={item.quantity} onChange={(e) => {
                      const next = [...items]; next[idx].quantity = e.target.value; setItems(next);
                    }} required />
                    <input type="number" step="0.01" className="form-input font-mono" placeholder={`Price (${currencySymbol})`} value={item.unit_price} onChange={(e) => {
                      const next = [...items]; next[idx].unit_price = e.target.value; setItems(next);
                    }} required />
                    <input type="number" step="0.01" className="form-input font-mono" placeholder="Tax %" value={item.tax_rate} onChange={(e) => {
                      const next = [...items]; next[idx].tax_rate = e.target.value; setItems(next);
                    }} required />
                    <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--accent-crimson)', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <div>Subtotal: <strong className="font-mono">{formatCurrency(subtotal)}</strong></div>
                <div>Tax: <strong className="font-mono">{formatCurrency(taxAmount)}</strong></div>
                <div>Grand Total: <strong className="font-mono" style={{ color: '#34d399' }}>{formatCurrency(grandTotal)}</strong></div>
              </div>

              <div>
                <label className="form-label">Notes</label>
                <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">Save Bill Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Pay Vendor Bill: {selectedBill.bill_number}</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Vendor</label>
                <input className="form-input" value={selectedBill.vendor_details?.name} disabled />
              </div>

              <div>
                <label className="form-label">Payment Amount ({currencySymbol})</label>
                <input type="number" step="0.01" className="form-input font-mono" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} required />
              </div>

              <div>
                <label className="form-label">Payment Mode</label>
                <select className="form-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="form-label">Reference / Wire Confirmation #</label>
                <input className="form-input" value={referenceNum} onChange={(e) => setReferenceNum(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">Post Payment Voucher</button>
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
          fetchBills();
          fetchVendors();
        }}
        type="bills"
        title="Import Purchase Bills"
      />
    </div>
  );
};

