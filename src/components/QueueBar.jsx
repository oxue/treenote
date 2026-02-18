import './QueueBar.css';

export default function QueueBar({ queue, queueIndex, focus, mode, ejecting, queueEditRef, onSelectItem, onUpdateText, onExitEdit }) {
  return (
    <>
      {queue.length > 0 && (
        <div className="queue-bar">
          <div className="queue-label">Queue</div>
          <div className="queue-items">
            {queue.map((item, i) => {
              const isSelected = focus === 'queue' && i === queueIndex;
              const isEditing = isSelected && mode === 'edit' && item.type === 'temp';
              return (
                <div
                  key={i}
                  className={`queue-box ${isSelected ? 'queue-selected' : ''} ${isEditing ? 'queue-editing' : ''} ${item.type === 'temp' ? 'queue-temp' : ''} ${item.checked ? 'checked' : ''}`}
                  onClick={() => onSelectItem(i)}
                >
                  {isEditing ? (
                    <textarea
                      ref={queueEditRef}
                      className="queue-text-input"
                      defaultValue={item.text}
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
                      {item.text || (item.type === 'temp' ? '...' : '')}
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
