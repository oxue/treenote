import { useState } from 'react';
import './SettingsModal.css';

export default function SettingsModal({ onClose, onSave, initialPath, initialPhysics }) {
  const [settingsPath, setSettingsPath] = useState(initialPath);
  const [settingsPhysics, setSettingsPhysics] = useState(initialPhysics);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Settings</div>
        <div className="settings-row">
          <label className="settings-label">Default file</label>
          <div className="settings-file-row">
            <span className="settings-path">{settingsPath || 'Not set'}</span>
            <button className="load-btn" onClick={() => {
              window.treenote.openFileDialog().then((filePath) => {
                if (filePath) setSettingsPath(filePath);
              });
            }}>
              Browse
            </button>
          </div>
        </div>
        <div className="settings-row">
          <label className="settings-label">Eject physics</label>
          <div className="settings-physics-grid">
            {[
              { key: 'vx', label: 'Vel X' },
              { key: 'vy', label: 'Vel Y' },
              { key: 'gravity', label: 'Gravity' },
              { key: 'spin', label: 'Spin' },
            ].map(({ key, label }) => (
              <label key={key} className="settings-physics-field">
                <span>{label}</span>
                <input
                  type="number"
                  step="0.1"
                  value={settingsPhysics[key]}
                  onChange={(e) => setSettingsPhysics(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="settings-actions">
          <button className="load-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="load-btn settings-save-btn" onClick={() => {
            onSave({ path: settingsPath, physics: settingsPhysics });
          }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
