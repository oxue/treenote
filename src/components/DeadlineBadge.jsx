function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DeadlineBadge({ deadline, deadlineTime, deadlineDuration }) {
  if (!deadline) return null;

  const date = parseLocalDate(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(date);
  deadlineDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((deadlineDate - today) / (1000 * 60 * 60 * 24));

  let className = 'deadline-badge';
  if (diffDays < 0) className += ' overdue';
  else if (diffDays === 0) className += ' today';
  else if (diffDays <= 2) className += ' soon';

  const month = date.toLocaleString('en', { month: 'short' });
  const day = date.getDate();

  let label = `${month} ${day}`;
  if (diffDays === 0) label = 'Today';
  else if (diffDays === 1) label = 'Tomorrow';
  else if (diffDays === -1) label = 'Yesterday';

  // Append time if set
  if (deadlineTime) {
    const [h, m] = deadlineTime.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    label += ` ${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  // Append duration if set
  if (deadlineDuration) {
    if (deadlineDuration < 60) {
      label += ` (${deadlineDuration}m)`;
    } else {
      const dh = Math.floor(deadlineDuration / 60);
      const dm = deadlineDuration % 60;
      label += dm === 0 ? ` (${dh}h)` : ` (${dh}h${dm}m)`;
    }
  }

  return <span className={className}>{label}</span>;
}
