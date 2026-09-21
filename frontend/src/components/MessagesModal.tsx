import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  sender: 'user' | 'assistant' | 'team';
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MessagesModal: React.FC<MessagesModalProps> = ({ isOpen, onClose }) => {
  const { activeRole } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      senderName: 'LedgerFlow Copilot',
      senderRole: 'AI FINANCIAL ASSISTANT',
      text: 'Hello! I am your real-time financial and compliance assistant. You can ask me about account balances, VAT tax calculations, invoice statuses, or double-entry principles.',
      timestamp: '10:00 AM'
    },
    {
      id: 'msg-2',
      sender: 'team',
      senderName: 'Sarah Jenkins',
      senderRole: 'CHIEF AUDITOR',
      text: 'Reminder: Please ensure all draft purchase bills for this month have valid tax invoices attached before the period lock.',
      timestamp: '10:15 AM'
    },
    {
      id: 'msg-3',
      sender: 'team',
      senderName: 'David Miller',
      senderRole: 'SENIOR ACCOUNTANT',
      text: 'Bank statement for Chase Checking has been imported. 4 transactions are awaiting ledger matching.',
      timestamp: '10:28 AM'
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage.trim();
    if (!text) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      senderName: activeRole === 'ADMIN' ? 'Admin Owner' : activeRole === 'ACCOUNTANT' ? 'Accountant' : activeRole === 'DATA_ENTRY' ? 'Data Entry Operator' : 'Auditor',
      senderRole: activeRole,
      text: text,
      timestamp: timeNow
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    // Generate intelligent AI Financial Assistant reply
    setTimeout(() => {
      let replyText = "Received your note. I've logged this in the compliance activity stream.";
      const lower = text.toLowerCase();

      if (lower.includes('invoice') || lower.includes('bill')) {
        replyText = `Understood! You can review and manage customer billing in the Invoicing tab or record vendor expenses in the Bills tab with automatic PDF & CSV export.`;
      } else if (lower.includes('balance') || lower.includes('trial') || lower.includes('report')) {
        replyText = `Trial Balance and P&L statements are automatically updated with every posted double-entry voucher. Check the Financial Reports tab for real-time compliance.`;
      } else if (lower.includes('currency') || lower.includes('inr') || lower.includes('rupee')) {
        replyText = `Indian Rupee (₹ INR) is fully supported across all vouchers, invoices, bills, reports, and the Dashboard currency converter!`;
      } else if (lower.includes('import') || lower.includes('export') || lower.includes('backup')) {
        replyText = `You can export CSV/JSON reports on every page, or visit the 'Import & Export Hub' in the sidebar for full system backups and 1-click restore.`;
      } else if (lower.includes('bank') || lower.includes('reconcil')) {
        replyText = `Bank statement transactions can be reconciled in 1-click on the Bank & Accounts tab against posted journal entries.`;
      } else {
        replyText = `Thank you! Your message has been shared with the financial operations team. All double-entry invariants are maintained in the General Ledger.`;
      }

      const botReply: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        senderName: 'LedgerFlow Copilot',
        senderRole: 'AI FINANCIAL ASSISTANT',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botReply]);
    }, 600);
  };

  const quickPrompts = [
    '💡 Are trial balance accounts balanced?',
    '📄 How do I export invoices to CSV/JSON?',
    '🇮🇳 What is the active INR exchange rate?',
    '🏦 Reconcile pending bank statement'
  ];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: '540px',
          maxWidth: '94%',
          height: '620px',
          maxHeight: '90vh',
          borderRadius: '16px',
          background: '#0f172a',
          border: '1px solid rgba(249,115,22,0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(249,115,22,0.4)'
            }}>
              <MessageSquare size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                Team Collaboration & AI Assistant
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} /> Online · Financial Audit Stream
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '8px 14px',
          overflowX: 'auto',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(p)}
              style={{
                whiteSpace: 'nowrap',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#D1D5DB',
                fontSize: '0.72rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#F97316';
                e.currentTarget.style.color = '#F97316';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#D1D5DB';
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Message Thread */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {messages.map(msg => {
            const isMe = msg.sender === 'user';
            const isBot = msg.sender === 'assistant';

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                  fontSize: '0.72rem',
                  color: '#9CA3AF'
                }}>
                  {isBot && <Bot size={13} color="#F97316" />}
                  <strong style={{ color: isMe ? '#F97316' : '#E5E7EB' }}>{msg.senderName}</strong>
                  <span>· {msg.senderRole}</span>
                  <span>· {msg.timestamp}</span>
                </div>

                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: isMe ? 'linear-gradient(135deg, #F97316, #EA580C)' : isBot ? '#1e293b' : '#182234',
                  color: '#FFFFFF',
                  fontSize: '0.86rem',
                  lineHeight: 1.45,
                  border: isBot ? '1px solid rgba(249,115,22,0.2)' : 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <input
            placeholder="Type a team message or ask Copilot..."
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={{
              flex: 1,
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#FFFFFF',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim()}
            style={{
              width: '40px', height: '40px',
              borderRadius: '10px',
              background: inputMessage.trim() ? '#F97316' : 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: inputMessage.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s ease'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
