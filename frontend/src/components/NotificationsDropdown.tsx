import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  isRead: boolean;
  tabId?: string;
  icon: any;
}

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onItemClick: (item: NotificationItem) => void;
  /** Ref to the bell button so we can position below it */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAll,
  onItemClick,
  triggerRef,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 76, left: 8, width: 380 });

  // Compute position from trigger button each time dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(380, window.innerWidth - 16);
      // Align right edge of dropdown to right edge of button, clamp to viewport
      const desiredLeft = rect.right - dropdownWidth;
      const clampedLeft = Math.max(8, Math.min(desiredLeft, window.innerWidth - dropdownWidth - 8));
      // On mobile the navbar has a second title row (~44px extra), on desktop just 68px
      const navbarHeight = window.innerWidth <= 768 ? 112 : 68;
      setPos({
        top: navbarHeight,
        left: clampedLeft,
        width: dropdownWidth,
      });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter(n => filter === 'all' || !n.isRead);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return ReactDOM.createPortal(
    <>
      {/* Invisible backdrop – clicking outside closes the dropdown */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={onClose}
      />

      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          width: `${pos.width}px`,
          maxWidth: 'calc(100vw - 24px)',
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.70)',
          borderRadius: '14px',
          zIndex: 9999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={17} color="#F97316" />
            {unreadCount > 0 && (
              <span className="badge badge-crimson" style={{ padding: '2px 6px', fontSize: '0.72rem' }}>
                {unreadCount} new
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                title="Mark all as read"
                style={{
                  background: 'none', border: 'none', color: '#9CA3AF',
                  cursor: 'pointer', fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <CheckCheck size={14} /> Read all
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                title="Clear all notifications"
                style={{
                  background: 'none', border: 'none', color: '#9CA3AF',
                  cursor: 'pointer', fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{
          display: 'flex', padding: '8px 16px', gap: '6px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: filter === f ? 'rgba(249,115,22,0.2)' : 'transparent',
                color: filter === f ? '#F97316' : '#9CA3AF',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '6px 0' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF' }}>
              <Bell size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E5E7EB' }}>
                No {filter === 'unread' ? 'unread ' : ''}notifications
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                You're all caught up with financial compliance!
              </div>
            </div>
          ) : (
            filteredNotifications.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  style={{
                    padding: '10px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    cursor: 'pointer',
                    background: item.isRead ? 'transparent' : 'rgba(249,115,22,0.06)',
                    borderLeft: item.isRead ? '3px solid transparent' : '3px solid #F97316',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = item.isRead ? 'transparent' : 'rgba(249,115,22,0.06)')}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, marginTop: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: item.type === 'warning' ? 'rgba(251,191,36,0.15)' :
                                item.type === 'danger'  ? 'rgba(239,68,68,0.15)'  :
                                item.type === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(96,165,250,0.15)',
                    color: item.type === 'warning' ? '#FBBF24' :
                           item.type === 'danger'  ? '#F87171' :
                           item.type === 'success' ? '#34D399' : '#60A5FA',
                  }}>
                    <Icon size={16} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: item.isRead ? 600 : 700, color: '#fff' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{item.time}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '3px', lineHeight: 1.35 }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center', fontSize: '0.75rem', color: '#6B7280',
        }}>
          Real-time Audit &amp; Compliance Stream
        </div>
      </div>
    </>,
    document.body
  );
};
