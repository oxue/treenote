import { useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { findNodeById } from '../actions';
import DeadlineBadge from './DeadlineBadge';
import './QueueBar.css';

const SMALL_WIDTH = 120;
const LARGE_WIDTH = 400;
const GAP = 10;
const PEEK = 50; // how much of the previous item peeks from the left

export default function QueueBar({ queue, queueIndex, focus, mode, ejecting, queueEditRef, tree, settings, onSelectItem, onUpdateText, onExitEdit }) {
  const selectedCardRef = useRef(null);
  const isFocused = focus === 'queue';

  // Calculate translateX to keep selected item at a consistent left position
  const containerOffset = useMemo(() => {
    if (!isFocused || queue.length === 0) return 0;
    // Sum widths of all items before queueIndex
    let offset = 0;
    for (let i = 0; i < queueIndex; i++) {
      offset += SMALL_WIDTH + GAP;
    }
    // Shift left so selected aligns near left edge, with peek of previous
    if (queueIndex > 0) {
      return -(offset - PEEK);
    }
    return 0;
  }, [isFocused, queueIndex, queue.length]);

  return (
    <>
      {queue.length > 0 && (
        <div className={`queue-bar ${isFocused ? 'queue-focused' : ''}`}>
          <div className="queue-label">Queue</div>
          <div className="queue-items" style={isFocused ? { transform: `translateX(${containerOffset}px)`, overflow: 'visible' } : {}}>
            {queue.map((item, i) => {
              const isSelected = isFocused && i === queueIndex;
              const isEditing = isSelected && mode === 'edit';
              const resolved = item.type === 'ref' && item.nodeId && tree ? findNodeById(tree, item.nodeId) : null;
              const treeNode = resolved ? resolved.node : null;
              const displayText = treeNode ? treeNode.text : item.text;
              const displayChecked = treeNode ? treeNode.checked : item.checked;
              const displayDeadline = treeNode ? treeNode.deadline : item.deadline;
              const displayDeadlineTime = treeNode ? treeNode.deadlineTime : item.deadlineTime;
              const displayDeadlineDuration = treeNode ? treeNode.deadlineDuration : item.deadlineDuration;
              const displayPriority = treeNode ? treeNode.priority : item.priority;
              const displayMarkdown = treeNode ? treeNode.markdown : item.markdown;
              const displayDetails = item.details || '';

              const firstLine = (displayText || '').split('\n')[0] || (item.type === 'temp' ? '...' : '');

              return (
                <div
                  key={i}
                  ref={isSelected ? selectedCardRef : undefined}
                  className={`queue-item ${isFocused ? (isSelected ? 'expanded queue-large' : 'expanded queue-small') : 'compact'} ${isSelected ? 'queue-selected' : ''} ${isEditing ? 'queue-editing' : ''} ${item.type === 'temp' ? 'queue-temp' : ''} ${displayChecked ? 'checked' : ''}`}
                  onClick={() => onSelectItem(i)}
                >
                  {isEditing ? (
                    <textarea
                      ref={queueEditRef}
                      className="queue-item-input"
                      defaultValue={displayText}
                      rows={4}
                      autoFocus
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          onUpdateText(i, e.target.value.trim());
                          onExitEdit();
                        } else if (e.key === 'Enter' && settings?.enterNewline) {
                          if (e.shiftKey) {
                            e.preventDefault();
                            onUpdateText(i, e.target.value.trim());
                            onExitEdit();
                          }
                        } else if (e.key === 'Enter' && !settings?.enterNewline) {
                          if (!e.shiftKey) {
                            e.preventDefault();
                            onUpdateText(i, e.target.value.trim());
                            onExitEdit();
                          }
                        }
                        e.stopPropagation();
                      }}
                      onBlur={(e) => {
                        onUpdateText(i, e.target.value.trim());
                        onExitEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <div className="queue-item-title">
                        {displayChecked && <span className="queue-item-check">&#10003; </span>}
                        {displayMarkdown ? (
                          <span className="node-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(firstLine) }} />
                        ) : firstLine}
                      </div>
                      {isFocused && displayText && displayText.includes('\n') && (
                        <div className="queue-item-body">
                          {displayMarkdown ? (
                            <span className="node-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(displayText.split('\n').slice(1).join('\n')) }} />
                          ) : displayText.split('\n').slice(1).join('\n')}
                        </div>
                      )}
                      {isFocused && (
                        <div className="queue-item-badges">
                          <DeadlineBadge deadline={displayDeadline} deadlineTime={displayDeadlineTime} deadlineDuration={displayDeadlineDuration} />
                          {displayPriority && <span className={`priority-badge ${displayPriority}`}>{displayPriority}</span>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {ejecting.map((item) => (
        <div
          key={item.id}
          className={`queue-item ${item.expanded ? 'expanded' : 'compact'} ejecting`}
          style={{
            position: 'fixed',
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.expanded ? item.height : undefined,
            transform: `rotate(${item.rotation}rad)`,
            pointerEvents: 'none',
            zIndex: 400,
          }}
        >
          <span className="queue-item-title" style={{ textDecoration: 'line-through' }}>
            {(item.text || '...').split('\n')[0]}
          </span>
        </div>
      ))}
    </>
  );
}
