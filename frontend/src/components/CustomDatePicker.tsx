import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // Format: 'YYYY-MM-DD'
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  className = 'form-input',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Initialize view year & month based on value or today
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - popoverWidth - 10));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 320 && rect.top > 320 ? rect.top - 315 : rect.bottom + 4;

      setCoords({ top, left });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (year: number, month: number, day: number) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    onChange(`${year}-${formattedMonth}-${formattedDay}`);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setViewYear(y);
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Calendar math
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const prevMonthDays = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthDays.push({
      day: daysInPrevMonth - i,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  const currentMonthDays = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentMonthDays.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
    });
  }

  const totalCells = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextMonthDays = [];
  for (let i = 1; i <= nextMonthDaysCount; i++) {
    nextMonthDays.push({
      day: i,
      month: viewMonth === 11 ? 0 : viewMonth + 1,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Today comparison
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Formatted display in button
  const displayFormatted = () => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const mIdx = parseInt(m, 10) - 1;
      return `${d} ${monthNames[mIdx]?.slice(0, 3)} ${y}`;
    }
    return value;
  };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          cursor: 'pointer',
          padding: '8px 12px',
          background: '#FFFFFF',
          textAlign: 'left',
          borderColor: isOpen ? 'var(--primary)' : '#E5E7EB',
          boxShadow: isOpen ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : 'none',
          color: value ? '#111827' : '#9CA3AF',
          fontFamily: 'inherit',
          fontSize: '0.88rem',
        }}
      >
        <span style={{ fontWeight: value ? 500 : 400 }}>
          {displayFormatted() || placeholder}
        </span>
        <CalendarIcon size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
      </button>

      {isOpen && coords && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'transparent',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '280px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              zIndex: 9999,
              padding: '14px',
              userSelect: 'none',
              animation: 'fadeIn 0.12s ease-out',
            }}
          >
            {/* Calendar Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>
                {monthNames[viewMonth]} {viewYear}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Day of Week Labels */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px',
                textAlign: 'center',
                marginBottom: '6px',
              }}
            >
              {dayLabels.map((lbl) => (
                <div
                  key={lbl}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#9CA3AF',
                    padding: '4px 0',
                  }}
                >
                  {lbl}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '3px',
                textAlign: 'center',
              }}
            >
              {allDays.map((dObj, idx) => {
                const cellDateStr = `${dObj.year}-${String(dObj.month + 1).padStart(2, '0')}-${String(dObj.day).padStart(2, '0')}`;
                const isSelected = value === cellDateStr;
                const isToday = todayStr === cellDateStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(dObj.year, dObj.month, dObj.day)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '32px',
                      borderRadius: '6px',
                      border: isToday && !isSelected ? '1px solid var(--primary)' : 'none',
                      background: isSelected
                        ? 'var(--primary)'
                        : 'transparent',
                      color: isSelected
                        ? '#FFFFFF'
                        : dObj.isCurrentMonth
                        ? '#1F2937'
                        : '#D1D5DB',
                      fontWeight: isSelected ? 700 : dObj.isCurrentMonth ? 500 : 400,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--primary-light)';
                        e.currentTarget.style.color = 'var(--primary-dark)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = dObj.isCurrentMonth ? '#1F2937' : '#D1D5DB';
                      }
                    }}
                  >
                    {dObj.day}
                  </button>
                );
              })}
            </div>

            {/* Footer Quick Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid #F3F4F6',
              }}
            >
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-crimson)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleToday}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
