import { useState } from 'react';
import './MobileSettingsScreen.css';

const THEMES = ['dark', 'midnight', 'light'];
const THEME_LABELS = { dark: 'Dark', midnight: 'Midnight', light: 'Light' };

export default function MobileSettingsScreen({
  session,
  settings,
  onUpdateSettings,
  onLogout,
  onOpenBackups,
  onOpenCalendarFeed,
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const currentTheme = settings?.theme || 'dark';
  const currentThemeLabel = THEME_LABELS[currentTheme] || 'Dark';

  function cycleTheme() {
    const idx = THEMES.indexOf(currentTheme);
    const next = THEMES[(idx + 1) % THEMES.length];
    onUpdateSettings('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  function toggleMarkdown() {
    onUpdateSettings('defaultMarkdown', !settings?.defaultMarkdown);
  }

  function handleLogoutTap() {
    if (showLogoutConfirm) {
      onLogout();
    } else {
      setShowLogoutConfirm(true);
    }
  }

  const backupCount = settings?.backupCount ?? 0;
  const email = session?.user?.email || 'Unknown';

  return (
    <div className="mob-settings">
      <h1 className="mob-settings-title">Settings</h1>

      {/* APPEARANCE */}
      <div className="mob-settings-section">
        <div className="mob-settings-section-header">APPEARANCE</div>
        <div className="mob-settings-group">
          <button className="mob-settings-row" onClick={cycleTheme}>
            <span className="mob-settings-row-label">Theme</span>
            <span className="mob-settings-row-value">
              {currentThemeLabel}
              <span className="mob-settings-chevron">&rsaquo;</span>
            </span>
          </button>
          <div className="mob-settings-separator" />
          <button className="mob-settings-row" onClick={toggleMarkdown}>
            <span className="mob-settings-row-label">Default markdown</span>
            <span
              className={`mob-settings-toggle ${settings?.defaultMarkdown ? 'on' : 'off'}`}
            >
              <span className="mob-settings-toggle-thumb" />
            </span>
          </button>
        </div>
      </div>

      {/* DATA */}
      <div className="mob-settings-section">
        <div className="mob-settings-section-header">DATA</div>
        <div className="mob-settings-group">
          <button className="mob-settings-row" onClick={onOpenBackups}>
            <span className="mob-settings-row-label">Backups</span>
            <span className="mob-settings-row-value">
              {backupCount > 0 && (
                <span className="mob-settings-badge">{backupCount}</span>
              )}
              <span className="mob-settings-chevron">&rsaquo;</span>
            </span>
          </button>
          <div className="mob-settings-separator" />
          <button className="mob-settings-row" onClick={onOpenCalendarFeed}>
            <span className="mob-settings-row-label">Calendar feed</span>
            <span className="mob-settings-row-value">
              <span className="mob-settings-chevron">&rsaquo;</span>
            </span>
          </button>
        </div>
      </div>

      {/* ACCOUNT */}
      <div className="mob-settings-section">
        <div className="mob-settings-section-header">ACCOUNT</div>
        <div className="mob-settings-group">
          <div className="mob-settings-row mob-settings-row-static">
            <span className="mob-settings-row-label">Signed in as</span>
          </div>
          <div className="mob-settings-separator" />
          <div className="mob-settings-row mob-settings-row-static">
            <span className="mob-settings-row-email">{email}</span>
          </div>
          <div className="mob-settings-separator" />
          <button
            className="mob-settings-row mob-settings-row-danger"
            onClick={handleLogoutTap}
            onBlur={() => setShowLogoutConfirm(false)}
          >
            <span className="mob-settings-row-label">
              {showLogoutConfirm ? 'Tap again to confirm' : 'Logout'}
            </span>
          </button>
        </div>
      </div>

      <div className="mob-settings-version">v1.0.0</div>
    </div>
  );
}
