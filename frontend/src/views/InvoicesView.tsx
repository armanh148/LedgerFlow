import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import type { Invoice, Customer, InvoiceStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Plus, Search, FileText, Send, DollarSign, Download, X, QrCode, UploadCloud, FileSpreadsheet, FileCode } from 'lucide-react';
import { exportToCSV, exportToJSON } from '../utils/exportImportUtils';
import { ImportModal } from '../components/ImportModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const InvoicesView: React.FC = () => {
  const { showToast, activeRole } = useAuth();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // New Invoice Form
  const [customerId, setCustomerId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('Net 30 Payment Terms. Thank you for your business!');
  const [items, setItems] = useState<{ description: string; quantity: string; unit_price: string; tax_rate: string }[]>([
    { description: 'Software Engineering Services', quantity: '1.00', unit_price: '5000.00', tax_rate: '10.00' }
  ]);

  // Payment Form
  const [paidAmount, setPaidAmount] = useState<string>('0.00');
  const [paymentMode, setPaymentMode] = useState<string>('BANK_TRANSFER');
  const [referenceNum, setReferenceNum] = useState<string>('');

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get('invoices/');
      setInvoices(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      showToast('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('customers/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setCustomers(data);
      if (data.length > 0) setCustomerId(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const addItemRow = () => {
    setItems([...items, { description: '', quantity: '1.00', unit_price: '0.00', tax_rate: '0.00' }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Subtotal calculations
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

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      showToast('Please select a customer.', 'warning');
      return;
    }

    try {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await api.post('invoices/', {
        invoice_number: invoiceNumber,
        customer: customerId,
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

      showToast(`Created Invoice ${invoiceNumber}`, 'success');
      setShowCreateModal(false);
      fetchInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create invoice', 'error');
    }
  };

  const handlePostToLedger = async (invId: string, invNum: string) => {
    if (activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Data Entry cannot post to ledger.', 'error');
      return;
    }

    try {
      await api.post(`invoices/${invId}/post-to-ledger/`);
      showToast(`Posted Invoice ${invNum} to General Ledger!`, 'success');
      fetchInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Posting failed', 'error');
    }
  };

  const handleOpenPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaidAmount(inv.remaining_balance);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (activeRole === 'DATA_ENTRY') {
      showToast('Permission Denied: Data Entry cannot record payments.', 'error');
      return;
    }

    try {
      const paymentNumber = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await api.post('payments/', {
        payment_number: paymentNumber,
        invoice: selectedInvoice.id,
        paid_amount: paidAmount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: paymentMode,
        reference_number: referenceNum || 'DIRECT-PAY'
      });

      showToast(`Recorded Payment ${paymentNumber} for Invoice ${selectedInvoice.invoice_number}`, 'success');
      setShowPaymentModal(false);
      fetchInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Payment failed', 'error');
    }
  };

  const handleOpenPdf = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowPdfModal(true);
  };

  const exportPdf = async () => {
    if (!pdfRef.current || !selectedInvoice) return;
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${selectedInvoice.invoice_number}.pdf`);
      showToast(`Downloaded PDF for ${selectedInvoice.invoice_number}`, 'success');
    } catch (err) {
      showToast('Failed to export PDF', 'error');
    }
  };

  const getStatusBadge = (st: InvoiceStatus) => {
    switch (st) {
      case 'DRAFT': return 'badge-amber';
      case 'SENT': return 'badge-blue';
      case 'PARTIALLY_PAID': return 'badge-purple';
      case 'PAID': return 'badge-emerald';
      case 'OVERDUE': return 'badge-crimson';
      default: return 'badge-amber';
    }
  };

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(
      `sales_invoices_${timestamp}.csv`,
      ['Invoice Number', 'Customer Name', 'Issue Date', 'Due Date', 'Subtotal', 'Tax Amount', 'Grand Total', 'Status', 'Paid Amount', 'Remaining Balance'],
      filteredInvoices.map(inv => [
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
    showToast(`Exported ${filteredInvoices.length} invoices to CSV`, 'success');
  };

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportToJSON(`sales_invoices_${timestamp}.json`, filteredInvoices);
    showToast(`Exported ${filteredInvoices.length} invoices to JSON`, 'success');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (inv.customer_details?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Invoices & Accounts Receivable (AR)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Manage customer billing, automatic double-entry voucher generation, and PDF export
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleExportCSV} 
              title="Export filtered invoices to Excel CSV"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} color="#34d399" /> Export CSV
            </button>
            <button 
              className="btn btn-outline" 
              onClick={handleExportJSON} 
              title="Export filtered invoices to JSON"
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
              <UploadCloud size={15} /> Import Invoices
            </button>
          )}

          {activeRole !== 'AUDITOR' && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
              <Plus size={16} /> Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Status Filter Tabs & Search */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: statusFilter === st ? 'var(--primary)' : '#1e293b',
                  color: '#fff',
                  fontWeight: statusFilter === st ? 600 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              placeholder="Search invoice # or customer..."
              style={{ paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoices Data Grid */}
      <div className="glass-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
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
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading Invoices...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No invoices found.</td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                    <td style={{ fontWeight: 500 }}>{inv.customer_details?.name || 'Customer'}</td>
                    <td>{inv.issue_date}</td>
                    <td>{inv.due_date}</td>
                    <td><span className={`badge ${getStatusBadge(inv.status)}`}>{inv.status}</span></td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(inv.grand_total)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600, color: parseFloat(inv.remaining_balance) > 0 ? 'var(--accent-amber)' : '#34d399' }}>
                      {formatCurrency(inv.remaining_balance)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => handleOpenPdf(inv)}
                          title="View / Download PDF Invoice"
                        >
                          <FileText size={12} /> View PDF
                        </button>

                        {inv.status === 'DRAFT' && activeRole !== 'DATA_ENTRY' && activeRole !== 'AUDITOR' && (
                          <button
                            className="btn btn-emerald"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => handlePostToLedger(inv.id, inv.invoice_number)}
                            title="Post to General Ledger"
                          >
                            <Send size={12} /> Post GL
                          </button>
                        )}

                        {inv.status !== 'PAID' && inv.status !== 'DRAFT' && activeRole !== 'DATA_ENTRY' && activeRole !== 'AUDITOR' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => handleOpenPaymentModal(inv)}
                            title="Record Customer Payment"
                          >
                            <DollarSign size={12} /> Pay
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

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Customer Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Customer</label>
                  <select className="form-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
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

              {/* Items Table */}
              <div>
                <label className="form-label" style={{ marginBottom: '8px' }}>Line Items</label>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr 1fr 30px', gap: '8px', marginBottom: '8px' }}>
                    <input className="form-input" placeholder="Item description" value={item.description} onChange={(e) => {
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
                    <button type="button" onClick={() => removeItemRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-crimson)', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline" onClick={addItemRow} style={{ padding: '6px 12px', fontSize: '0.8rem', marginTop: '4px' }}>
                  + Add Line Item
                </button>
              </div>

              {/* Summary */}
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <div>Subtotal: <strong className="font-mono">{formatCurrency(subtotal)}</strong></div>
                <div>Tax Amount: <strong className="font-mono">{formatCurrency(taxAmount)}</strong></div>
                <div>Grand Total: <strong className="font-mono" style={{ color: '#34d399' }}>{formatCurrency(grandTotal)}</strong></div>
              </div>

              <div>
                <label className="form-label">Notes & Terms</label>
                <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">Save Invoice Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment: {selectedInvoice.invoice_number}</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Customer</label>
                <input className="form-input" value={selectedInvoice.customer_details?.name} disabled />
              </div>

              <div>
                <label className="form-label">Amount Paid ($)</label>
                <input type="number" step="0.01" className="form-input font-mono" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} required />
              </div>

              <div>
                <label className="form-label">Payment Mode</label>
                <select className="form-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="ONLINE">Online Credit Card</option>
                </select>
              </div>

              <div>
                <label className="form-label">Reference / Check #</label>
                <input className="form-input" placeholder="e.g. CHK-990182" value={referenceNum} onChange={(e) => setReferenceNum(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">Post Payment Voucher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      {showPdfModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', background: '#fff', color: '#0f172a' }}>
            <div className="modal-header" style={{ borderColor: '#e2e8f0' }}>
              <h3 className="modal-title" style={{ color: '#0f172a' }}>Invoice Document Preview</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={exportPdf}>
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => setShowPdfModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Invoice View */}
            <div ref={pdfRef} style={{ padding: '32px', background: '#ffffff', color: '#0f172a', fontFamily: 'sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>LedgerFlow Enterprise</h1>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Financial Accounting Systems Inc.</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>100 Financial Center Blvd, San Francisco, CA</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#2563eb' }}>INVOICE</h2>
                  <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace' }}>{selectedInvoice.invoice_number}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Issue Date: {selectedInvoice.issue_date}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Due Date: {selectedInvoice.due_date}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Billed To:</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedInvoice.customer_details?.name || 'Customer'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>{selectedInvoice.customer_details?.email}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>{selectedInvoice.customer_details?.address}</div>
                </div>

                <div style={{ textAlign: 'right', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status:</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>{selectedInvoice.status}</div>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '0.85rem' }}>
                    <th style={{ padding: '10px 12px' }}>Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tax</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                      <td style={{ padding: '10px 12px' }}>{item.description}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.tax_rate}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Calculation & Digital Stamp QR Code */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ width: '54px', height: '54px', background: '#0f172a', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                    <QrCode size={40} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>AUTHENTIC LEDGER STAMP</div>
                    <div style={{ fontSize: '0.7rem', color: '#15803d', fontFamily: 'monospace' }}>
                      VOUCHER: {selectedInvoice.journal_entry ? 'POSTED-VERIFIED' : 'DRAFT-RECORD'}
                    </div>
                  </div>
                </div>

                <div style={{ width: '240px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tax:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(selectedInvoice.tax_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', fontSize: '1.1rem', fontWeight: 800 }}>
                    <span>Grand Total:</span>
                    <span style={{ color: '#2563eb' }}>{formatCurrency(selectedInvoice.grand_total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          fetchInvoices();
          fetchCustomers();
        }}
        type="invoices"
        title="Import Sales Invoices"
      />
    </div>
  );
};

