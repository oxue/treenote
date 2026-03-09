import './QueueBar.css';

function resolveNodeFromTree(tree, path, index) {
  if (!tree) return null;
  try {
    let nodes = tree;
    for (const idx of path) {
      nodes = nodes[idx].children;
    }
    return nodes[index] || null;
  } catch {
    return null;
  }
}

export default function QueueBar({ queue, queueIndex, focus, mode, ejecting, queueEditRef, tree, onSelectItem, onUpdateText, onExitEdit }) {
  return (
    <>
      {queue.length > 0 && (
        <div className="queue-bar">
          <div className="queue-label">Queue</div>
          <div className="queue-items">
            {queue.map((item, i) => {
              const isSelected = focus === 'queue' && i === queueIndex;
              const isEditing = isSelected && mode === 'edit';
              const treeNode = item.type === 'ref' ? resolveNodeFromTree(tree, item.path, item.index) : null;
              const displayText = treeNode ? treeNode.text : item.text;
              const displayChecked = treeNode ? treeNode.checked : item.checked;
              return (
                <div
                  key={i}
                  className={`queue-box ${isSelected ? 'queue-selected' : ''} ${isEditing ? 'queue-editing' : ''} ${item.type === 'temp' ? 'queue-temp' : ''} ${displayChecked ? 'checked' : ''}`}
                  onClick={() => onSelectItem(i)}
                >
                  {isEditing ? (
                    <textarea
                      ref={queueEditRef}
                      className="queue-text-input"
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
                          onExitEdit();
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
                    <span className="queue-text">
                      {displayText || (item.type === 'temp' ? '...' : '')}
                    </span>
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
