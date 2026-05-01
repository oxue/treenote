import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'treenote-settings';

const DEFAULT_SETTINGS = {
  keybindingScheme: 'arrows',
  theme: 'dark',
  enterNewline: true,
  defaultMarkdown: false,
  boxWidth: 400,
};

export const BOX_WIDTH_MIN = 240;
export const BOX_WIDTH_MAX = 720;

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

function applyBoxWidth(boxWidth) {
  const w = Math.max(BOX_WIDTH_MIN, Math.min(BOX_WIDTH_MAX, Number(boxWidth) || 400));
  document.documentElement.style.setProperty('--main-box-width', w + 'px');
}

// Apply saved theme immediately on module load
const initialSettings = loadSettings();
applyTheme(initialSettings.theme);
applyBoxWidth(initialSettings.boxWidth);

export default function useSettings() {
  const [settings, setSettingsState] = useState(initialSettings);

  // Persist whenever settings change
  useEffect(() => {
    persistSettings(settings);
    applyTheme(settings.theme);
    applyBoxWidth(settings.boxWidth);
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
