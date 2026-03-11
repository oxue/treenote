export default function DeadlineBadge({ deadline }) {
  if (!deadline) return null;

  const date = new Date(deadline);
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

  return <span className={className}>{label}</span>;
}
