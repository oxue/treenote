import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'treenote-settings';

const DEFAULT_SETTINGS = {
  keybindingScheme: 'arrows',
  theme: 'dark',
  enterNewline: true,
  defaultMarkdown: false,
};

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    // ignore parse errors
  }
  return { ...DEFAULT_SETTINGS };
}

function persistSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // ignore write errors
  }
}

// Apply theme to document on load (before React renders)
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Apply saved theme immediately on module load
const initialSettings = loadSettings();
applyTheme(initialSettings.theme);

export default function useSettings() {
  const [settings, setSettingsState] = useState(initialSettings);

  // Persist whenever settings change
  useEffect(() => {
    persistSettings(settings);
    applyTheme(settings.theme);
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
