export default function ConflictModal({ onKeepMine, onKeepTheirs, onKeepBoth }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Conflict Detected</div>
        <p style={{ color: '#ccc', margin: '0 0 12px', fontSize: '13px' }}>
          Your notes were updated from another window or device.
        </p>
        <div className="modal-option" onClick={onKeepMine}>
          <kbd>1</kbd> Keep mine (overwrite server)
        </div>
        <div className="modal-option" onClick={onKeepTheirs}>
          <kbd>2</kbd> Keep theirs (reload from server)
        </div>
        <div className="modal-option" onClick={onKeepBoth}>
          <kbd>3</kbd> Keep both (save mine as backup, load theirs)
        </div>
      </div>
    </div>
  );
}
