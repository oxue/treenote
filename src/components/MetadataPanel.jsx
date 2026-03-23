import { useState, useEffect } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PRIORITIES = [null, 'low', 'medium', 'high', 'urgent'];
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

// 15-minute time slots: 0..95 => "00:00".."23:45"
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

// Duration options in minutes: 15, 30, 45, ... 240 (4h)
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

function formatTime12h(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function timeToIndex(time24) {
  const [h, m] = time24.split(':').map(Number);
  return h * 4 + m / 15;
}

function durationToIndex(minutes) {
  return DURATION_OPTIONS.indexOf(minutes);
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

const FIELDS = ['deadline', 'time', 'duration', 'priority'];

export default function MetadataPanel({ node, onSetDeadline, onSetPriority, onSetTime, onSetDuration, onClose }) {
  const today = new Date();
  const initial = node?.deadline ? new Date(node.deadline) : today;

  const [activeField, setActiveField] = useState('deadline');
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [cursorDay, setCursorDay] = useState(initial.getDate());
  const [timeIndex, setTimeIndex] = useState(
    node?.deadlineTime ? timeToIndex(node.deadlineTime) : 36 // default 9:00 AM
  );
  const [durationIndex, setDurationIndex] = useState(
    node?.deadlineDuration ? Math.max(0, durationToIndex(node.deadlineDuration)) : 1 // default 30min
  );
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
        setActiveField(f => {
          const idx = FIELDS.indexOf(f);
          return FIELDS[(idx + 1) % FIELDS.length];
        });
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
      } else if (activeField === 'time') {
        switch (e.key) {
          case 'ArrowUp':
            setTimeIndex(i => (i - 1 + 96) % 96);
            break;
          case 'ArrowDown':
            setTimeIndex(i => (i + 1) % 96);
            break;
          case 'ArrowLeft':
            setTimeIndex(i => (i - 4 + 96) % 96); // -1 hour
            break;
          case 'ArrowRight':
            setTimeIndex(i => (i + 4) % 96); // +1 hour
            break;
          case 'Enter':
            onSetTime(TIME_SLOTS[timeIndex]);
            break;
          case 'Backspace':
          case 'Delete':
            onSetTime(null);
            break;
        }
      } else if (activeField === 'duration') {
        switch (e.key) {
          case 'ArrowUp':
            setDurationIndex(i => Math.max(0, i - 1));
            break;
          case 'ArrowDown':
            setDurationIndex(i => Math.min(DURATION_OPTIONS.length - 1, i + 1));
            break;
          case 'Enter':
            onSetDuration(DURATION_OPTIONS[durationIndex]);
            break;
          case 'Backspace':
          case 'Delete':
            onSetDuration(null);
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
  }, [viewYear, viewMonth, cursorDay, daysInMonth, activeField, priorityIndex, timeIndex, durationIndex, onSetDeadline, onSetPriority, onSetTime, onSetDuration, onClose]);

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

  // Visible time slots around cursor (show 5 slots centered on cursor)
  const visibleTimeSlots = [];
  for (let offset = -2; offset <= 2; offset++) {
    const idx = (timeIndex + offset + 96) % 96;
    visibleTimeSlots.push({ index: idx, time: TIME_SLOTS[idx], isCursor: offset === 0 });
  }

  // Visible duration options around cursor (show 5)
  const visibleDurationSlots = [];
  for (let offset = -2; offset <= 2; offset++) {
    const idx = durationIndex + offset;
    if (idx >= 0 && idx < DURATION_OPTIONS.length) {
      visibleDurationSlots.push({ index: idx, value: DURATION_OPTIONS[idx], isCursor: offset === 0 });
    }
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

      {/* Calendar / Date */}
      <div className={`meta-field ${activeField === 'deadline' ? 'active' : ''}`} onClick={() => setActiveField('deadline')}>
        <div className="meta-field-label">
          Deadline
          {node?.deadline && <span className="meta-field-value">{node.deadline}</span>}
        </div>
        {activeField === 'deadline' && (
          <>
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
          </>
        )}
      </div>

      {/* Time picker */}
      <div className={`meta-field ${activeField === 'time' ? 'active' : ''}`} onClick={() => setActiveField('time')}>
        <div className="meta-field-label">
          Time
          {node?.deadlineTime && <span className="meta-field-value">{formatTime12h(node.deadlineTime)}</span>}
        </div>
        {activeField === 'time' && (
          <>
            <div className="time-picker">
              {visibleTimeSlots.map(({ index, time, isCursor }) => (
                <div
                  key={index}
                  className={`time-option ${isCursor ? 'cursor' : ''} ${time === node?.deadlineTime ? 'current' : ''}`}
                  onClick={() => onSetTime(time)}
                >
                  {formatTime12h(time)}
                </div>
              ))}
            </div>
            <div className="meta-field-actions">
              <kbd>&uarr;</kbd><kbd>&darr;</kbd> 15min &nbsp; <kbd>&larr;</kbd><kbd>&rarr;</kbd> 1hr &nbsp; <kbd>Enter</kbd> set
            </div>
          </>
        )}
      </div>

      {/* Duration picker */}
      <div className={`meta-field ${activeField === 'duration' ? 'active' : ''}`} onClick={() => setActiveField('duration')}>
        <div className="meta-field-label">
          Duration
          {node?.deadlineDuration && <span className="meta-field-value">{formatDuration(node.deadlineDuration)}</span>}
        </div>
        {activeField === 'duration' && (
          <>
            <div className="time-picker">
              {visibleDurationSlots.map(({ index, value, isCursor }) => (
                <div
                  key={index}
                  className={`time-option ${isCursor ? 'cursor' : ''} ${value === node?.deadlineDuration ? 'current' : ''}`}
                  onClick={() => onSetDuration(value)}
                >
                  {formatDuration(value)}
                </div>
              ))}
            </div>
            <div className="meta-field-actions">
              <kbd>&uarr;</kbd><kbd>&darr;</kbd> 15min &nbsp; <kbd>Enter</kbd> set
            </div>
          </>
        )}
      </div>

      {/* Priority */}
      <div className={`meta-field ${activeField === 'priority' ? 'active' : ''}`} onClick={() => setActiveField('priority')}>
        <div className="meta-field-label">
          Priority
          {node?.priority && <span className={`priority-value ${node.priority}`}>{PRIORITY_LABELS[node.priority]}</span>}
        </div>
        {activeField === 'priority' && (
          <>
            <div className="priority-list">
              {PRIORITIES.map((p, i) => (
                <div
                  key={i}
                  className={`priority-option ${i === priorityIndex ? 'cursor' : ''} ${p === node?.priority ? 'current' : ''}`}
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
          </>
        )}
      </div>
    </div>
  );
}
