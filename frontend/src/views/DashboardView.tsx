import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DashboardMetrics } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import {
  Eye,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Upload,
  ArrowUpDown,
  Filter,
  SlidersHorizontal,
  MoreVertical
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Stable constants outside component to prevent re-creation on every render
const FX_RATES: Record<string, number> = {
  INR: 83.42,
  USD: 1,
  EUR: 0.91489,
  GBP: 0.78542,
  PKR: 278.50,
  AED: 3.6725,
  SAR: 3.7500,
  CAD: 1.3642,
};

const CURRENCY_DETAILS: Record<string, { flag: string; symbol: string; label: string }> = {
  INR: { flag: '🇮🇳', symbol: '₹', label: 'INR (₹ Indian Rupee)' },
  USD: { flag: '🇺🇸', symbol: '$', label: 'USD ($ US Dollar)' },
  EUR: { flag: '🇪🇺', symbol: '€', label: 'EUR (€ Euro)' },
  GBP: { flag: '🇬🇧', symbol: '£', label: 'GBP (£ British Pound)' },
  PKR: { flag: '🇵🇰', symbol: '₨', label: 'PKR (₨ Pakistani Rupee)' },
  AED: { flag: '🇦🇪', symbol: 'AED ', label: 'AED (UAE Dirham)' },
  SAR: { flag: '🇸🇦', symbol: 'SAR ', label: 'SAR (Saudi Riyal)' },
  CAD: { flag: '🇨🇦', symbol: 'CA$', label: 'CAD (Canadian Dollar)' },
};

const CURRENCY_LIST = Object.keys(FX_RATES);

export const DashboardView: React.FC = () => {
  const { setActiveTab } = useAuth();
  const { currencyConfig, currencySymbol, formatCurrency, formatParts } = useCurrency();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Currency Converter State (Defaults: From USD to INR Indian Rupee)
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('INR');
  const [fromAmount, setFromAmount] = useState<string>('2000');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  const toAmount: string = (() => {
    const amt = parseFloat(fromAmount || '0');
    if (isNaN(amt) || amt <= 0) return '0.00';
    const inUSD = amt / FX_RATES[fromCurrency];
    return (inUSD * FX_RATES[toCurrency]).toFixed(2);
  })();

  const fxRate = (FX_RATES[toCurrency] / FX_RATES[fromCurrency]).toFixed(5);
  const fee = (parseFloat(fromAmount || '0') * 0.008).toFixed(2);
  const totalCost = (parseFloat(fromAmount || '0') + parseFloat(fee)).toFixed(2);

  const handleSwap = () => {
    setIsSwapping(true);
    const prev = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(prev);
    setTimeout(() => setIsSwapping(false), 200);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resMetrics = await api.get<DashboardMetrics>('reports/dashboard-metrics/');
      setMetrics(resMetrics.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (val: string | number) => {
    const parts = formatParts(val);
    return (
      <span>
        {parts.symbol}{parts.integer}
        <span className="decimals">.{parts.decimal}</span>
      </span>
    );
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>Loading Dashboard...</div>;
  }

  // Monthly data adapted for FinPilot style
  const chartData = [
    { month: 'Jan', val: 240, active: false },
    { month: 'Feb', val: 320, active: false },
    { month: 'Mar', val: 410, active: false },
    { month: 'Apr', val: 290, active: false },
    { month: 'May', val: 480, active: false },
    { month: 'Jun', val: 380, active: true },
    { month: 'Jul', val: 460, active: false },
    { month: 'Aug', val: 390, active: false },
    { month: 'Sep', val: 420, active: false },
    { month: 'Oct', val: 310, active: false },
  ];

  const recentTxList = [
    { name: 'Liam Harper', email: 'liam@harper.com', amount: formatCurrency(232.50), method: 'MasterCard', status: 'Completed', country: 'US' },
    { name: 'Acme Enterprise', email: 'billing@acme.com', amount: formatCurrency(13750.00), method: 'Bank Wire', status: 'Completed', country: 'US' },
    { name: 'WeWork Real Estate', email: 'space@wework.com', amount: formatCurrency(4500.00), method: 'Auto Debit', status: 'Completed', country: 'US' },
    { name: 'AWS Cloud Services', email: 'ar@aws.com', amount: formatCurrency(2200.00), method: 'Visa Credit', status: 'Completed', country: 'US' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Quick Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Quick Actions</h2>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setActiveTab('voucher')}>
            <ArrowDownCircle size={16} /> Deposit / New Voucher
          </button>
          <button className="btn btn-outline" onClick={() => setActiveTab('banking')}>
            <ArrowUpCircle size={16} /> Withdraw
          </button>
          <button className="btn btn-outline" onClick={() => setActiveTab('banking')}>
            <RefreshCw size={16} /> Transfer
          </button>
          <button className="btn btn-outline" onClick={() => setActiveTab('bills')}>
            <Upload size={16} /> Upload Bill
          </button>
        </div>
      </div>

      {/* 3 Top Summary Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-title">
            <span>Bill Pay</span>
            <Eye size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="metric-value">{formatAmount(metrics?.total_ap_outstanding || '32321.20')}</div>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
              {currencyConfig.flag} {currencyConfig.code}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
            <span className="badge badge-emerald">+4.5%</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+{formatCurrency(2214.32)} compared to last month</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Invoicing</span>
            <Eye size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="metric-value">{formatAmount(metrics?.total_ar_outstanding || '12475.98')}</div>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
              {currencyConfig.flag} {currencyConfig.code}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
            <span className="badge badge-emerald">+6.5%</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+{formatCurrency(2214.32)} compared to last month</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Credit Card / Cash</span>
            <Eye size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="metric-value">{formatAmount(metrics?.total_cash_in_hand || '29876.43')}</div>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
              {currencyConfig.flag} {currencyConfig.code}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
            <span className="badge badge-emerald">+3.5%</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+{formatCurrency(2214.32)} compared to last month</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Ledger Balance Chart + Currency Convert Widget */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Ledger Balance Chart */}
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>FinPilot Balance</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{currencySymbol}13,954<span className="decimals">.00</span></div>
                <span className="badge badge-emerald">+8.0% vs last month</span>
              </div>
            </div>
            <MoreVertical size={18} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#09090b', color: '#ffffff', borderRadius: '8px', border: 'none' }}
                  formatter={(val: any) => [`${currencySymbol}${val}`, 'Balance']}
                />
                <Bar
                  dataKey="val"
                  radius={[4, 4, 0, 0]}
                  fill="#09090b"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Convert Currency Widget */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Currency Converter</h3>
              <MoreVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
            </div>

            {/* From Box */}
            <div style={{ background: '#f4f4f5', padding: '12px 14px', borderRadius: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>From</span>
                <select
                  value={fromCurrency}
                  onChange={e => setFromCurrency(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                >
                {CURRENCY_LIST.map(c => (
                    <option key={c} value={c}>{CURRENCY_DETAILS[c]?.flag} {CURRENCY_DETAILS[c]?.label || c}</option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                value={fromAmount}
                onChange={e => setFromAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  textAlign: 'right',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)'
                }}
                placeholder="0.00"
              />
            </div>

            {/* Swap Button */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '-14px 0', zIndex: 2, position: 'relative' }}>
              <button
                id="currency-swap-btn"
                onClick={handleSwap}
                title="Swap currencies"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#09090b',
                  color: '#ffffff',
                  border: '2px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                  transform: isSwapping ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>

            {/* To Box */}
            <div style={{ background: '#f4f4f5', padding: '12px 14px', borderRadius: '12px', marginTop: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>To</span>
                <select
                  value={toCurrency}
                  onChange={e => setToCurrency(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                >
                {CURRENCY_LIST.map(c => (
                    <option key={c} value={c}>{CURRENCY_DETAILS[c]?.flag} {CURRENCY_DETAILS[c]?.label || c}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                {CURRENCY_DETAILS[toCurrency]?.symbol || ''}{parseFloat(toAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Fee Breakdown */}
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Amount</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{CURRENCY_DETAILS[fromCurrency]?.symbol || fromCurrency} {parseFloat(fromAmount || '0').toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{fromCurrency} → {toCurrency} FX Fee (0.8%)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{CURRENCY_DETAILS[fromCurrency]?.symbol || fromCurrency} {fee}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-main)', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                <span>Total cost</span>
                <span>{CURRENCY_DETAILS[fromCurrency]?.symbol || fromCurrency} {totalCost}</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '12px' }}
              onClick={() => alert(`Convert ${fromCurrency} ${fromAmount} → ${toCurrency} ${toAmount}`)}>
              Convert Now
            </button>
          </div>

          <div style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            Rate: 1 {fromCurrency} = {fxRate} {toCurrency}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activities Data Grid */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Recent Activities</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <Filter size={14} /> Filter
            </button>
            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <SlidersHorizontal size={14} /> Sort
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Customer</th>
                <th style={{ width: '20%' }}>Amount</th>
                <th style={{ width: '20%' }}>Method</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '15%' }}>Country</th>
              </tr>
            </thead>
            <tbody>
              {recentTxList.map((tx, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#18181b',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                      }}>
                        {tx.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tx.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontWeight: 700 }}>{tx.amount}</td>
                  <td>{tx.method}</td>
                  <td><span className="badge badge-emerald">{tx.status}</span></td>
                  <td style={{ fontWeight: 600 }}>{tx.country}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
