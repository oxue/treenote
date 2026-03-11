import { useState, useEffect } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PRIORITIES = [null, 'low', 'medium', 'high', 'urgent'];
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function MetadataPanel({ node, onSetDeadline, onSetPriority, onToggleCalendarSync, hasGoogleToken, onClose }) {
  const today = new Date();
  const initial = node?.deadline ? new Date(node.deadline) : today;

  const [activeField, setActiveField] = useState('deadline'); // 'deadline' | 'priority'
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [cursorDay, setCursorDay] = useState(initial.getDate());
  const [priorityIndex, setPriorityIndex] = useState(
    node?.priority ? PRIORITIES.indexOf(node.priority) : 0
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth).toLocaleString('en', { month: 'long', year: 'numeric' });

  useEffect(() => {
    function handleKey(e) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Tab') {
        setActiveField(f => f === 'deadline' ? 'priority' : 'deadline');
        return;
      }

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (activeField === 'deadline') {
        switch (e.key) {
          case 'ArrowRight':
            setCursorDay(d => {
              if (d >= daysInMonth) {
                if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
                else setViewMonth(m => m + 1);
                return 1;
              }
              return d + 1;
            });
            break;
          case 'ArrowLeft':
            setCursorDay(d => {
              if (d <= 1) {
                if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
                else setViewMonth(m => m - 1);
                const prevDays = getDaysInMonth(
                  viewMonth === 0 ? viewYear - 1 : viewYear,
                  viewMonth === 0 ? 11 : viewMonth - 1
                );
                return prevDays;
              }
              return d - 1;
            });
            break;
          case 'ArrowDown':
            setCursorDay(d => {
              const next = d + 7;
              if (next > daysInMonth) {
                if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
                else setViewMonth(m => m + 1);
                return next - daysInMonth;
              }
              return next;
            });
            break;
          case 'ArrowUp':
            setCursorDay(d => {
              const prev = d - 7;
              if (prev < 1) {
                const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
                const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
                if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
                else setViewMonth(m => m - 1);
                return getDaysInMonth(prevYear, prevMonth) + prev;
              }
              return prev;
            });
            break;
          case 'Enter':
            onSetDeadline(new Date(viewYear, viewMonth, cursorDay).toISOString().slice(0, 10));
            break;
          case 'Backspace':
          case 'Delete':
            onSetDeadline(null);
            break;
        }
      } else if (activeField === 'priority') {
        switch (e.key) {
          case 'ArrowUp':
            setPriorityIndex(i => Math.max(0, i - 1));
            break;
          case 'ArrowDown':
            setPriorityIndex(i => Math.min(PRIORITIES.length - 1, i + 1));
            break;
          case 'Enter':
            onSetPriority(PRIORITIES[priorityIndex]);
            break;
          case 'Backspace':
          case 'Delete':
            onSetPriority(null);
            setPriorityIndex(0);
            break;
        }
      }
    }

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [viewYear, viewMonth, cursorDay, daysInMonth, activeField, priorityIndex, onSetDeadline, onSetPriority, onClose]);

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-cell empty" />);
  }

  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const deadlineStr = node?.deadline ? (() => {
    const d = new Date(node.deadline);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  })() : null;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${viewYear}-${viewMonth}-${d}`;
    const isCursor = d === cursorDay && activeField === 'deadline';
    const isToday = dayStr === todayStr;
    const isDeadline = dayStr === deadlineStr;

    let cls = 'cal-cell';
    if (isCursor) cls += ' cursor';
    if (isToday) cls += ' today';
    if (isDeadline) cls += ' deadline';

    cells.push(
      <div key={d} className={cls} onClick={() => onSetDeadline(new Date(viewYear, viewMonth, d).toISOString().slice(0, 10))}>
        {d}
      </div>
    );
  }

  return (
    <div className="metadata-panel">
      <div className="meta-panel-header">
        <span className="meta-panel-title">Node Metadata</span>
        <span className="meta-panel-hint"><kbd>Tab</kbd> switch field &nbsp; <kbd>Esc</kbd> close</span>
      </div>

      <div className="meta-panel-node-preview">
        {node?.text || 'No node selected'}
      </div>

      <div className={`meta-field ${activeField === 'deadline' ? 'active' : ''}`}>
        <div className="meta-field-label">
          Deadline
          {node?.deadline && <span className="meta-field-value">{node.deadline}</span>}
        </div>
        <div className="cal-header-panel">
          <span className="cal-month">{monthName}</span>
        </div>
        <div className="cal-weekdays">
          {DAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells}
        </div>
        <div className="meta-field-actions">
          <kbd>Enter</kbd> set &nbsp; <kbd>Del</kbd> clear
        </div>
      </div>

      <div className={`meta-field ${activeField === 'priority' ? 'active' : ''}`}>
        <div className="meta-field-label">
          Priority
          {node?.priority && <span className={`priority-value ${node.priority}`}>{PRIORITY_LABELS[node.priority]}</span>}
        </div>
        <div className="priority-list">
          {PRIORITIES.map((p, i) => (
            <div
              key={i}
              className={`priority-option ${i === priorityIndex && activeField === 'priority' ? 'cursor' : ''} ${p === node?.priority ? 'current' : ''}`}
              onClick={() => onSetPriority(p)}
            >
              <span className={`priority-dot ${p || 'none'}`} />
              <span>{p ? PRIORITY_LABELS[p] : 'None'}</span>
            </div>
          ))}
        </div>
        <div className="meta-field-actions">
          <kbd>&uarr;</kbd><kbd>&darr;</kbd> select &nbsp; <kbd>Enter</kbd> set
        </div>
      </div>

      {hasGoogleToken && node?.deadline && (
        <div className="meta-field">
          <div className="meta-field-label">Google Calendar</div>
          <div
            className={`cal-sync-toggle ${node?.calendarSync ? 'active' : ''}`}
            onClick={onToggleCalendarSync}
          >
            <span className="cal-sync-icon">{node?.calendarSync ? '\u2713' : '\u25CB'}</span>
            <span>{node?.calendarSync ? 'Synced to Google Calendar' : 'Sync to Google Calendar'}</span>
          </div>
          {node?.calendarEventId && (
            <div className="cal-sync-status">Event ID: {node.calendarEventId.slice(0, 12)}...</div>
          )}
        </div>
      )}

      {!hasGoogleToken && (
        <div className="meta-field">
          <div className="meta-field-label">Google Calendar</div>
          <div className="cal-sync-hint">
            Sign in with Google to enable calendar sync
          </div>
        </div>
      )}
    </div>
  );
}
