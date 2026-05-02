import { useState, useEffect, useCallback } from 'react';
import './WebSettingsPanel.css';
import { BOX_WIDTH_MIN, BOX_WIDTH_MAX } from '../hooks/useSettings';

const TABS = [
  { id: 'keybindings', label: 'Keybindings' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'export', label: 'Export' },
];

// Only show Electron tab when running in Electron
const ELECTRON_TAB = { id: 'electron', label: 'Desktop' };

const SCHEMES = [
  {
    id: 'arrows',
    name: 'Arrow Keys',
    description: 'Default layout. All letter keys available for commands.',
    keys: [
      { action: 'Navigate', keys: '\u2191 \u2190 \u2193 \u2192' },
      { action: 'Swap node', keys: 'Shift + \u2191/\u2193' },
      { action: 'Insert node', keys: 'Cmd + \u2191/\u2190/\u2193/\u2192' },
      { action: 'Move to parent level', keys: 'Alt + \u2190' },
      { action: 'Move to sibling', keys: 'Alt + \u2191/\u2193' },
      { action: 'Toggle legend', keys: 'l' },
    ],
  },
  {
    id: 'vim',
    name: 'Vim (hjkl)',
    description: 'Vim-style navigation. h/j/k/l are reserved for movement. Arrow keys also work.',
    keys: [
      { action: 'Navigate', keys: 'h j k l (or arrows)' },
      { action: 'Swap node', keys: 'Shift + J/K' },
      { action: 'Insert node', keys: 'Cmd + H/J/K/L' },
      { action: 'Move to parent level', keys: 'Alt + H' },
      { action: 'Move to sibling', keys: 'Alt + J/K' },
      { action: 'Toggle legend', keys: '?' },
    ],
  },
];

const THEME_OPTIONS = [
  {
    id: 'dark',
    name: 'Dark',
    desc: 'Default dark theme with warm accent',
    colors: ['#0d0d1a', '#16213e', '#e94560'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Deep blue-tinted, richer contrast',
    colors: ['#0a0e1a', '#101830', '#6366f1'],
  },
  {
    id: 'light',
    name: 'Light',
    desc: 'Clean light mode for daytime use',
    colors: ['#f8f9fc', '#ebeef8', '#e03050'],
  },
];

export default function WebSettingsPanel({
  onClose,
  settings,
  onUpdateSettings,
  onExport,
  selectedNodeText,
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

  const handleSchemeChange = useCallback((schemeId) => {
    onUpdateSettings({ keybindingScheme: schemeId });
  }, [onUpdateSettings]);

  const handleThemeSelect = useCallback((themeId) => {
    onUpdateSettings({ theme: themeId });
    document.documentElement.setAttribute('data-theme', themeId);
  }, [onUpdateSettings]);

  const renderKeybindings = () => (
    <div className="web-settings-section">
      <div className="scheme-list">
        {SCHEMES.map((s) => (
          <div
            key={s.id}
            className={`scheme-card ${settings.keybindingScheme === s.id ? 'selected' : ''}`}
            onClick={() => handleSchemeChange(s.id)}
          >
            <div className="scheme-header">
              <span className="scheme-radio">
                {settings.keybindingScheme === s.id ? '\u25C9' : '\u25CB'}
              </span>
              <span className="scheme-name">{s.name}</span>
            </div>
            <p className="scheme-desc">{s.description}</p>
            <table className="scheme-keymap">
              <tbody>
                {s.keys.map((k, i) => (
                  <tr key={i}>
                    <td className="keymap-action">{k.action}</td>
                    <td className="keymap-keys">{k.keys}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {settings.keybindingScheme === 'vim' && (
        <div className="scheme-note">
          <strong>Note:</strong> In vim mode, <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd> are
          reserved for navigation. The legend toggle moves from <kbd>l</kbd> to <kbd>?</kbd>.
          Arrow keys continue to work alongside hjkl.
        </div>
      )}

      <div className="enter-behavior-section">
        <span className="web-settings-label">Enter key in edit mode</span>
        <div className="enter-behavior-toggle">
          <label className={`enter-option ${settings.enterNewline ? 'active' : ''}`}>
            <input
              type="radio"
              name="enterBehavior"
              checked={settings.enterNewline}
              onChange={() => onUpdateSettings({ enterNewline: true })}
            />
            <span className="enter-option-label">Enter = new line, Shift+Enter = exit</span>
          </label>
          <label className={`enter-option ${!settings.enterNewline ? 'active' : ''}`}>
            <input
              type="radio"
              name="enterBehavior"
              checked={!settings.enterNewline}
              onChange={() => onUpdateSettings({ enterNewline: false })}
            />
            <span className="enter-option-label">Enter = exit, Shift+Enter = new line</span>
          </label>
        </div>
      </div>

      <div className="enter-behavior-section">
        <span className="web-settings-label">Default markdown for new boxes</span>
        <div className="enter-behavior-toggle">
          <label className={`enter-option ${settings.defaultMarkdown ? 'active' : ''}`}>
            <input
              type="radio"
              name="defaultMarkdown"
              checked={settings.defaultMarkdown}
              onChange={() => onUpdateSettings({ defaultMarkdown: true })}
            />
            <span className="enter-option-label">New boxes default to markdown</span>
          </label>
          <label className={`enter-option ${!settings.defaultMarkdown ? 'active' : ''}`}>
            <input
              type="radio"
              name="defaultMarkdown"
              checked={!settings.defaultMarkdown}
              onChange={() => onUpdateSettings({ defaultMarkdown: false })}
            />
            <span className="enter-option-label">New boxes default to plain text</span>
          </label>
        </div>
      </div>
    </div>
  );

  const handleBoxWidthChange = useCallback((rawValue) => {
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(BOX_WIDTH_MIN, Math.min(BOX_WIDTH_MAX, parsed));
    onUpdateSettings({ boxWidth: clamped });
  }, [onUpdateSettings]);

  const currentBoxWidth = settings.boxWidth ?? 400;

  const renderAppearance = () => (
    <div className="web-settings-section">
      <div className="web-settings-row">
        <span className="web-settings-label">Choose a theme</span>
      </div>
      <div className="theme-options">
        {THEME_OPTIONS.map((theme) => (
          <div
            key={theme.id}
            className={`theme-option ${settings.theme === theme.id ? 'active' : ''}`}
            onClick={() => handleThemeSelect(theme.id)}
          >
            <div className="theme-preview">
              {theme.colors.map((color, i) => (
                <span
                  key={i}
                  className="theme-preview-dot"
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="theme-option-info">
              <span className="theme-option-name">{theme.name}</span>
              <span className="theme-option-desc">{theme.desc}</span>
            </div>
            {settings.theme === theme.id && (
              <span className="theme-option-active-tag">Active</span>
            )}
          </div>
        ))}
      </div>

      <div className="appearance-section">
        <span className="web-settings-label">Tree box width</span>
        <div className="box-width-control">
          <input
            type="range"
            className="box-width-slider"
            min={BOX_WIDTH_MIN}
            max={BOX_WIDTH_MAX}
            step="10"
            value={currentBoxWidth}
            onChange={(e) => handleBoxWidthChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label="Tree box width"
          />
          <div className="box-width-input-wrap">
            <input
              type="number"
              className="box-width-input"
              min={BOX_WIDTH_MIN}
              max={BOX_WIDTH_MAX}
              step="10"
              value={currentBoxWidth}
              onChange={(e) => handleBoxWidthChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Tree box width in pixels"
            />
            <span className="box-width-unit">px</span>
          </div>
        </div>
        <span className="web-settings-hint">
          Adjusts width of parent, current, and child columns. Queue items are unaffected.
        </span>
      </div>
    </div>
  );

  const renderExport = () => {
    const hasNode = !!(selectedNodeText && selectedNodeText.length > 0);
    const preview = hasNode
      ? `Selected: ${selectedNodeText.split('\n')[0].slice(0, 60)}`
      : 'No node selected. Close this panel and pick one first.';
    return (
      <div className="web-settings-section">
        <div className="web-settings-row">
          <span className="web-settings-label">Self-contained HTML export</span>
        </div>
        <p className="scheme-desc">
          Download the currently selected node and its subtree as a single
          self-contained <code>.html</code> file. Open it in any browser — no
          server, no account, no Treenote install needed. Read-only.
        </p>
        <p className="scheme-desc" style={{ opacity: 0.75 }}>{preview}</p>
        <div className="web-settings-actions" style={{ justifyContent: 'flex-start' }}>
          <button
            className="load-btn web-settings-save-btn"
            disabled={!hasNode || !onExport}
            onClick={() => {
              if (onExport) {
                onExport();
                onClose();
              }
            }}
          >
            Export current node as HTML
          </button>
        </div>
        <div className="scheme-note">
          Tip: press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> (or
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> on Windows/Linux)
          anywhere in the app to export the selected node directly.
        </div>
      </div>
    );
  };

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
          {activeTab === 'appearance' && renderAppearance()}
          {activeTab === 'export' && renderExport()}
          {activeTab === 'electron' && renderElectron()}
        </div>
      </div>
    </div>
  );
}
