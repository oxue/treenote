import { useRef } from 'react';
import { findNodeById } from '../actions';
import DeadlineBadge from './DeadlineBadge';
import './QueueBar.css';

export default function QueueBar({ queue, queueIndex, focus, mode, ejecting, queueEditRef, tree, onSelectItem, onUpdateText, onUpdateDetails, onExitEdit }) {
  const detailsRef = useRef(null);
  const isFocused = focus === 'queue';

  return (
    <>
      {queue.length > 0 && (
        <div className={`queue-bar ${isFocused ? 'queue-focused' : ''}`}>
          <div className="queue-label">Queue</div>
          <div className="queue-items">
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
              const displayDetails = item.details || '';

              if (!isFocused) {
                // Compact box mode when queue is not focused
                return (
                  <div
                    key={i}
                    className={`queue-box ${isSelected ? 'queue-selected' : ''} ${item.type === 'temp' ? 'queue-temp' : ''} ${displayChecked ? 'checked' : ''}`}
                    onClick={() => onSelectItem(i)}
                  >
                    <span className="queue-text">
                      {displayText || (item.type === 'temp' ? '...' : '')}
                    </span>
                  </div>
                );
              }

              // Card mode when queue is focused
              return (
                <div
                  key={i}
                  className={`queue-card ${isSelected ? 'queue-selected' : ''} ${isEditing ? 'queue-editing' : ''} ${item.type === 'temp' ? 'queue-temp' : ''} ${displayChecked ? 'checked' : ''}`}
                  onClick={() => onSelectItem(i)}
                >
                  {isEditing ? (
                    <>
                      <textarea
                        ref={queueEditRef}
                        className="queue-card-title-input"
                        defaultValue={displayText}
                        rows={1}
                        autoFocus
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            onUpdateText(i, e.target.value.trim());
                            if (detailsRef.current) {
                              onUpdateDetails(i, detailsRef.current.value.trim());
                            }
                            onExitEdit();
                          }
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            if (detailsRef.current) detailsRef.current.focus();
                          }
                          e.stopPropagation();
                        }}
                        onBlur={(e) => {
                          // Only commit if focus leaves the card entirely
                          const related = e.relatedTarget;
                          if (related && e.currentTarget.closest('.queue-card')?.contains(related)) return;
                          onUpdateText(i, e.target.value.trim());
                          if (detailsRef.current) {
                            onUpdateDetails(i, detailsRef.current.value.trim());
                          }
                          onExitEdit();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <textarea
                        ref={detailsRef}
                        className="queue-card-details-input"
                        defaultValue={displayDetails}
                        placeholder="Add details..."
                        rows={2}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            if (queueEditRef.current) {
                              onUpdateText(i, queueEditRef.current.value.trim());
                            }
                            onUpdateDetails(i, e.target.value.trim());
                            onExitEdit();
                          }
                          e.stopPropagation();
                        }}
                        onBlur={(e) => {
                          const related = e.relatedTarget;
                          if (related && e.currentTarget.closest('.queue-card')?.contains(related)) return;
                          if (queueEditRef.current) {
                            onUpdateText(i, queueEditRef.current.value.trim());
                          }
                          onUpdateDetails(i, e.target.value.trim());
                          onExitEdit();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </>
                  ) : (
                    <>
                      <div className="queue-card-title">
                        {displayChecked && <span className="queue-card-checked-icon">&#10003; </span>}
                        {displayText || (item.type === 'temp' ? '...' : '')}
                      </div>
                      {displayDetails ? (
                        <div className="queue-card-details">{displayDetails}</div>
                      ) : (
                        <div className="queue-card-details empty">No details</div>
                      )}
                      <div className="queue-card-badges">
                        <DeadlineBadge deadline={displayDeadline} deadlineTime={displayDeadlineTime} deadlineDuration={displayDeadlineDuration} />
                        {displayPriority && <span className={`priority-badge ${displayPriority}`}>{displayPriority}</span>}
                      </div>
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
          className="queue-box ejecting"
          style={{
            position: 'fixed',
            left: item.x,
            top: item.y,
            width: item.width,
            transform: `rotate(${item.rotation}rad)`,
            pointerEvents: 'none',
            zIndex: 400,
          }}
        >
          <span className="queue-text" style={{ textDecoration: 'line-through' }}>
            {item.text || '...'}
          </span>
        </div>
      ))}
    </>
  );
}
