import { useState, useRef, useEffect, useCallback } from 'react';
import './MobileEditScreen.css';

const DURATION_OPTIONS = [
  { value: 15, label: '15min' },
  { value: 30, label: '30min' },
  { value: 45, label: '45min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
];

const PRIORITIES = [
  { value: null, label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function formatDateShort(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime12h(time24) {
  if (!time24) return null;
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const opt = DURATION_OPTIONS.find(o => o.value === minutes);
  return opt ? opt.label : `${minutes}m`;
}

function priorityLabel(value) {
  const p = PRIORITIES.find(o => o.value === value);
  return p ? p.label : 'None';
}

export default function MobileEditScreen({
  initialText,
  initialDeadline,
  initialDeadlineTime,
  initialDeadlineDuration,
  initialPriority,
  initialMarkdown,
  onSave,
  onCancel,
  visible,
}) {
  const [text, setText] = useState(initialText || '');
  const [deadline, setDeadline] = useState(initialDeadline || '');
  const [deadlineTime, setDeadlineTime] = useState(initialDeadlineTime || '');
  const [deadlineDuration, setDeadlineDuration] = useState(initialDeadlineDuration || '');
  const [priority, setPriority] = useState(initialPriority || null);
  const [markdown, setMarkdown] = useState(initialMarkdown ?? false);

  const textareaRef = useRef(null);

  // Reset state when props change (new item opened)
  useEffect(() => {
    if (visible) {
      setText(initialText || '');
      setDeadline(initialDeadline || '');
      setDeadlineTime(initialDeadlineTime || '');
      setDeadlineDuration(initialDeadlineDuration || '');
      setPriority(initialPriority || null);
      setMarkdown(initialMarkdown ?? false);
    }
  }, [visible, initialText, initialDeadline, initialDeadlineTime, initialDeadlineDuration, initialPriority, initialMarkdown]);

  // Auto-focus textarea on open
  useEffect(() => {
    if (visible && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current.focus();
      }, 350); // wait for slide-up animation
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    autoGrow();
  }, [text, visible, autoGrow]);

  function handleSave() {
    onSave({
      text,
      deadline: deadline || null,
      deadlineTime: deadlineTime || null,
      deadlineDuration: deadlineDuration ? Number(deadlineDuration) : null,
      priority: priority || null,
      markdown,
    });
  }

  return (
    <div className={`mob-edit-backdrop ${visible ? 'visible' : ''}`}>
      <div className={`mob-edit-screen ${visible ? 'visible' : ''}`}>
        {/* Header */}
        <div className="mob-edit-header">
          <button className="mob-edit-header-btn mob-edit-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="mob-edit-header-btn mob-edit-done" onClick={handleSave}>
            Done
          </button>
        </div>

        {/* Text editor */}
        <div className="mob-edit-body">
          <textarea
            ref={textareaRef}
            className="mob-edit-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={autoGrow}
            placeholder="Enter text..."
            rows={3}
          />
        </div>

        {/* Metadata bar */}
        <div className="mob-edit-metadata">
          <div className="mob-edit-meta-row">
            <label className="mob-edit-meta-chip">
              <span className="mob-edit-meta-icon">&#x1F4C5;</span>
              <span className="mob-edit-meta-label">
                {formatDateShort(deadline) || 'Date'}
              </span>
              <input
                type="date"
                className="mob-edit-native-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>

            <label className="mob-edit-meta-chip">
              <span className="mob-edit-meta-icon">&#x23F0;</span>
              <span className="mob-edit-meta-label">
                {formatTime12h(deadlineTime) || 'Time'}
              </span>
              <input
                type="time"
                className="mob-edit-native-input"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
              />
            </label>

            <label className="mob-edit-meta-chip">
              <span className="mob-edit-meta-icon">&#x23F1;</span>
              <span className="mob-edit-meta-label">
                {formatDuration(Number(deadlineDuration)) || 'Duration'}
              </span>
              <select
                className="mob-edit-native-input"
                value={deadlineDuration}
                onChange={(e) => setDeadlineDuration(e.target.value)}
              >
                <option value="">None</option>
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Priority segmented control */}
          <div className="mob-edit-priority-row">
            <div className="mob-edit-priority-segmented">
              {PRIORITIES.map((p) => (
                <button
                  key={p.label}
                  className={`mob-edit-priority-seg ${priority === p.value ? 'active' : ''} ${p.value ? `priority-${p.value}` : ''}`}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Markdown toggle */}
        <div className="mob-edit-footer">
          <button
            className="mob-edit-markdown-toggle"
            onClick={() => setMarkdown(!markdown)}
          >
            <span className="mob-edit-markdown-label">Markdown</span>
            <span className={`mob-settings-toggle ${markdown ? 'on' : 'off'}`}>
              <span className="mob-settings-toggle-thumb" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
