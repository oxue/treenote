import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'treenote-settings';

const DEFAULT_SETTINGS = {
  keybindingScheme: 'arrows',
  theme: 'dark',
};

export default function useSettings() {
  const [settings, setSettingsState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore
    }
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettingsState(prev => ({ ...prev, ...patch }));
  }, []);

  return { settings, updateSettings };
}
