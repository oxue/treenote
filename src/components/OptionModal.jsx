export default function OptionModal({ title, description, options }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">{title}</div>
        {description && <p style={{ color: '#ccc', margin: '0 0 12px', fontSize: '13px' }}>{description}</p>}
        {options.map((opt, i) => (
          <div key={i} className="modal-option" onClick={opt.action}>
            <kbd>{i + 1}</kbd> <span>{opt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
