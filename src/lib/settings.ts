import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_REMINDER_TIME, isValidTime } from './reminders';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  sound: boolean;
  /** Send anonymous usage events (docs/spec/v2.md §7.7). Missing in older saves → true. */
  analytics: boolean;
  /** Speaking exercises (microphone). Missing in older saves → true. */
  speaking: boolean;
  /** Daily practice reminder (Android notifications). Missing in older saves → off. */
  reminder: boolean;
  /** Reminder time, "HH:MM" local. */
  reminderTime: string;
}

const STORAGE_KEY = 'baktana-english:settings:v1';
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  sound: true,
  analytics: true,
  speaking: true,
  reminder: false,
  reminderTime: DEFAULT_REMINDER_TIME,
};

/** Parses saved settings, ignoring anything unknown or malformed. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const data = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: data.theme === 'light' || data.theme === 'dark' ? data.theme : 'system',
      sound: typeof data.sound === 'boolean' ? data.sound : true,
      analytics: typeof data.analytics === 'boolean' ? data.analytics : true,
      speaking: typeof data.speaking === 'boolean' ? data.speaking : true,
      reminder: data.reminder === true,
      reminderTime: isValidTime(data.reminderTime) ? data.reminderTime : DEFAULT_REMINDER_TIME,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function load(): Settings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Per-device preferences. The theme is applied as `data-theme` on <html> ("system" removes it). */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore – preferences just won't persist.
    }
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings]);

  const change = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return { settings, change };
}
