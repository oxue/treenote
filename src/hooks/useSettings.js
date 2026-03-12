import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'treenote-settings';

const DEFAULT_SETTINGS = {
  keybindingScheme: 'arrows',
  theme: 'dark',
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

export default function useSettings() {
  const [settings, setSettingsState] = useState(loadSettings);

  // Persist whenever settings change
  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
