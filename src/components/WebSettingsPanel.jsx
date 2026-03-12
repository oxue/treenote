import { useState, useEffect, useCallback } from 'react';
import './WebSettingsPanel.css';

const TABS = [
  { id: 'keybindings', label: 'Keybindings' },
  { id: 'theme', label: 'Theme' },
];

// Only show Electron tab when running in Electron
const ELECTRON_TAB = { id: 'electron', label: 'Desktop' };

const KEYBINDING_SCHEMES = {
  arrows: 'Arrow keys (default)',
};

const THEME_OPTIONS = {
  dark: 'Dark (default)',
};

export default function WebSettingsPanel({
  onClose,
  settings,
  onUpdateSettings,
  // Electron-specific props
  electronSettings,
  onSaveElectronSettings,
}) {
  const isElectron = !!window.treenote;
  const tabs = isElectron ? [...TABS, ELECTRON_TAB] : TABS;

  const [activeTab, setActiveTab] = useState('keybindings');
  const [tabIndex, setTabIndex] = useState(0);

  // Electron settings local state
  const [filePath, setFilePath] = useState(electronSettings?.path || '');
  const [physics, setPhysics] = useState(electronSettings?.physics || { vx: 1.2, vy: -1.2, gravity: 0.4, spin: 0.04 });

  // Keep tab in sync with index
  useEffect(() => {
    setActiveTab(tabs[tabIndex]?.id || 'keybindings');
  }, [tabIndex]);

  // Keyboard navigation within the panel
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' || e.key === 's') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        setTabIndex(i => (i + 1) % tabs.length);
        return;
      }
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        setTabIndex(i => (i - 1 + tabs.length) % tabs.length);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setTabIndex(i => Math.min(i + 1, tabs.length - 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTabIndex(i => Math.max(i - 1, 0));
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, tabs.length]);

  const renderKeybindings = () => (
    <div className="web-settings-section">
      <div className="web-settings-row">
        <span className="web-settings-label">Current scheme</span>
        <div className="web-settings-value">
          <span>{KEYBINDING_SCHEMES[settings.keybindingScheme] || 'Arrow keys (default)'}</span>
          <span className="current-tag">Active</span>
        </div>
      </div>
      <p className="web-settings-hint">
        More keybinding schemes coming soon (Vim, Custom).
      </p>
    </div>
  );

  const renderTheme = () => (
    <div className="web-settings-section">
      <div className="web-settings-row">
        <span className="web-settings-label">Current theme</span>
        <div className="web-settings-value">
          <span>{THEME_OPTIONS[settings.theme] || 'Dark (default)'}</span>
          <span className="current-tag">Active</span>
        </div>
      </div>
      <p className="web-settings-hint">
        More themes coming soon (Midnight, Light).
      </p>
    </div>
  );

  const renderElectron = () => (
    <div className="web-settings-section">
      <div className="web-settings-row">
        <span className="web-settings-label">Default file</span>
        <div className="web-settings-file-row">
          <span className="web-settings-path">{filePath || 'Not set'}</span>
          <button className="load-btn" onClick={() => {
            window.treenote.openFileDialog().then((fp) => {
              if (fp) setFilePath(fp);
            });
          }}>
            Browse
          </button>
        </div>
      </div>
      <div className="web-settings-row">
        <span className="web-settings-label">Eject physics</span>
        <div className="web-settings-physics-grid">
          {[
            { key: 'vx', label: 'Vel X' },
            { key: 'vy', label: 'Vel Y' },
            { key: 'gravity', label: 'Gravity' },
            { key: 'spin', label: 'Spin' },
          ].map(({ key, label }) => (
            <label key={key} className="web-settings-physics-field">
              <span>{label}</span>
              <input
                type="number"
                step="0.1"
                value={physics[key]}
                onChange={(e) => setPhysics(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="web-settings-actions">
        <button className="load-btn" onClick={onClose}>Cancel</button>
        <button className="load-btn web-settings-save-btn" onClick={() => {
          if (onSaveElectronSettings) {
            onSaveElectronSettings({ path: filePath, physics });
          }
        }}>
          Save
        </button>
      </div>
    </div>
  );

  return (
    <div className="web-settings-overlay" onClick={onClose}>
      <div className="web-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="web-settings-header">
          <span className="web-settings-title">Settings</span>
          <span className="web-settings-close-hint">
            <kbd>S</kbd> or <kbd>Esc</kbd> to close
          </span>
        </div>
        <div className="web-settings-tabs">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              className={`web-settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setTabIndex(i); setActiveTab(tab.id); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="web-settings-body">
          {activeTab === 'keybindings' && renderKeybindings()}
          {activeTab === 'theme' && renderTheme()}
          {activeTab === 'electron' && renderElectron()}
        </div>
      </div>
    </div>
  );
}
