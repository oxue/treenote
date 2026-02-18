export function DeleteConfirmModal({ onDeleteWithChildren, onDeleteKeepChildren, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Delete node with children?</div>
        <div className="modal-option" onClick={onDeleteWithChildren}>
          <kbd>1</kbd> <span>Delete with children</span>
        </div>
        <div className="modal-option" onClick={onDeleteKeepChildren}>
          <kbd>2</kbd> <span>Keep children, delete node</span>
        </div>
        <div className="modal-option" onClick={onCancel}>
          <kbd>3</kbd> <span>Cancel</span>
        </div>
      </div>
    </div>
  );
}

export function ClearCheckedModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Delete all checked items in this column?</div>
        <div className="modal-option" onClick={onConfirm}>
          <kbd>1</kbd> <span>Delete checked</span>
        </div>
        <div className="modal-option" onClick={onCancel}>
          <kbd>2</kbd> <span>Cancel</span>
        </div>
      </div>
    </div>
  );
}
