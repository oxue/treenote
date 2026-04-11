import DeadlineBadge from './DeadlineBadge';
import ChildCount from './ChildCount';

export default function NodeMeta({ node, full }) {
  const hasAny = node.checked || node.children.length > 0 ||
    (full && (node.deadline || node.priority || node.markdown));
  if (!hasAny) return null;

  return (
    <div className="node-meta">
      {full && <DeadlineBadge deadline={node.deadline} deadlineTime={node.deadlineTime} deadlineDuration={node.deadlineDuration} />}
      {full && node.priority && <span className={`priority-badge ${node.priority}`}>{node.priority}</span>}
      {full && node.markdown && <span className="markdown-badge">MD</span>}
      {node.checked && <span className="node-check">&#10003;</span>}
      {node.children.length > 0 && <span className="child-count">{node.children.length}</span>}
    </div>
  );
}
