import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PeriodLock, AuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Unlock, Plus } from 'lucide-react';

export const AuditAndSecurityView: React.FC = () => {
  const { showToast, activeRole } = useAuth();
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Period Lock Modal Form
  const [showModal, setShowModal] = useState<boolean>(false);
  const [periodName, setPeriodName] = useState<string>('FY 2025 Closing');
  const [startDate, setStartDate] = useState<string>('2025-01-01');
  const [endDate, setEndDate] = useState<string>('2025-12-31');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resLocks, resLogs] = await Promise.all([
        api.get('period-locks/'),
        api.get('audit-logs/')
      ]);
      setPeriodLocks(Array.isArray(resLocks.data) ? resLocks.data : (resLocks.data.results || []));
      setAuditLogs(Array.isArray(resLogs.data) ? resLogs.data : (resLogs.data.results || []));
    } catch (err) {
      showToast('Failed to load audit and security records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (lock: PeriodLock) => {
    if (activeRole !== 'ADMIN') {
      showToast('Permission Denied: Only Admin/Owner can lock or unlock fiscal periods.', 'error');
      return;
    }

    try {
      await api.patch(`period-locks/${lock.id}/`, { is_locked: !lock.is_locked });
      showToast(`Period ${lock.period_name} is now ${!lock.is_locked ? 'LOCKED' : 'UNLOCKED'}`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleCreateLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole !== 'ADMIN') {
      showToast('Permission Denied: Only Admin can create period locks.', 'error');
      return;
    }

    try {
      await api.post('period-locks/', {
        period_name: periodName,
        start_date: startDate,
        end_date: endDate,
        is_locked: true
      });
      showToast(`Created Period Lock: ${periodName}`, 'success');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create lock', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Security, RBAC & Audit Trail</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Fiscal period locking, immutable transaction records, and user access history
          </p>
        </div>

        {activeRole === 'ADMIN' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Lock Financial Period
          </button>
        )}
      </div>

      {/* Fiscal Period Locking Grid */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Lock size={18} style={{ color: 'var(--accent-purple)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Fiscal Period Closing & Locking</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading Period Locks...</td></tr>
              ) : periodLocks.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No locked fiscal periods defined.</td></tr>
              ) : (
                periodLocks.map(lock => (
                  <tr key={lock.id}>
                    <td style={{ fontWeight: 600 }}>{lock.period_name}</td>
                    <td>{lock.start_date}</td>
                    <td>{lock.end_date}</td>
                    <td>
                      {lock.is_locked ? (
                        <span className="badge badge-crimson"><Lock size={12} /> LOCKED</span>
                      ) : (
                        <span className="badge badge-emerald"><Unlock size={12} /> OPEN</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`btn ${lock.is_locked ? 'btn-outline' : 'btn-crimson'}`}
                        style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                        onClick={() => handleToggleLock(lock)}
                        disabled={activeRole !== 'ADMIN'}
                      >
                        {lock.is_locked ? 'Unlock Period' : 'Lock Period'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Trail Grid */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-emerald)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Automated System Audit Log</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Username</th>
                <th>Role</th>
                <th>Action Performed</th>
                <th>Model</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs recorded.</td></tr>
              ) : (
                auditLogs.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.username || 'System User'}</td>
                    <td><span className="badge badge-purple">{log.user_role}</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{log.action}</td>
                    <td>{log.model_name || '-'}</td>
                    <td className="font-mono" style={{ color: 'var(--text-dim)' }}>{log.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lock Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Lock Past Financial Period</h3>
            </div>

            <form onSubmit={handleCreateLock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Period Name</label>
                <input className="form-input" value={periodName} onChange={(e) => setPeriodName(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-emerald">Enforce Period Lock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
