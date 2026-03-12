import { useState } from 'react';
import './WebSettingsPanel.css';

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

export default function WebSettingsPanel({ onClose, keybindingScheme, onChangeScheme }) {
  const [tab, setTab] = useState('keybindings');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal web-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Settings</div>

        <div className="web-settings-tabs">
          <button
            className={`web-settings-tab ${tab === 'keybindings' ? 'active' : ''}`}
            onClick={() => setTab('keybindings')}
          >
            Keybindings
          </button>
        </div>

        {tab === 'keybindings' && (
          <div className="web-settings-content">
            <div className="scheme-list">
              {SCHEMES.map((s) => (
                <div
                  key={s.id}
                  className={`scheme-card ${keybindingScheme === s.id ? 'selected' : ''}`}
                  onClick={() => onChangeScheme(s.id)}
                >
                  <div className="scheme-header">
                    <span className="scheme-radio">
                      {keybindingScheme === s.id ? '\u25C9' : '\u25CB'}
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

            {keybindingScheme === 'vim' && (
              <div className="scheme-note">
                <strong>Note:</strong> In vim mode, <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd> are
                reserved for navigation. The legend toggle moves from <kbd>l</kbd> to <kbd>?</kbd>.
                Arrow keys continue to work alongside hjkl.
              </div>
            )}
          </div>
        )}

        <div className="settings-actions">
          <button className="load-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
