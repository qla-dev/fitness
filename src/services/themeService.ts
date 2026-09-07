import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Uniwind, useUniwind } from 'uniwind';
import { getErrorMessage } from '../utils/errors';
import { addLog } from './LogService';

const THEME_KEY = '@HealthConnect:appTheme';

/**
 * There is exactly one dark appearance. It is called Dark everywhere the user
 * can see it, and the Uniwind `dark` theme it maps to carries the true-black
 * AMOLED palette, so the OS dark appearance under `System` renders the same
 * colors as picking Dark by hand.
 */
export type ThemePreference = 'System' | 'Light' | 'Dark';

/**
 * Reads a stored preference, folding away the retired separate `Amoled`
 * choice. Anyone who had picked either dark option before the two were merged
 * lands on the one that remains rather than silently falling back to System.
 */
function normalizePreference(saved: string | null): ThemePreference {
  switch (saved) {
    case 'Light':
      return 'Light';
    case 'Dark':
    case 'Amoled':
      return 'Dark';
    default:
      return 'System';
  }
}

/**
 * Convert user-facing theme preference to Uniwind theme string
 */
function toUniwindTheme(pref: ThemePreference): 'system' | 'light' | 'dark' {
  switch (pref) {
    case 'Light':
      return 'light';
    case 'Dark':
      return 'dark';
    default:
      return 'system';
  }
}

/**
 * Convert Uniwind theme string to user-facing theme preference
 */
function fromUniwindTheme(
  theme: string,
  hasAdaptiveThemes: boolean
): ThemePreference {
  if (hasAdaptiveThemes) return 'System';
  switch (theme) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
}

/**
 * Load saved theme preference and apply it via Uniwind.
 * Call this once on app startup.
 */
export async function initializeTheme(): Promise<void> {
  try {
    const savedTheme = await AsyncStorage.getItem(THEME_KEY);
    Uniwind.setTheme(toUniwindTheme(normalizePreference(savedTheme)));
  } catch (error) {
    addLog(
      `Failed to load theme preference: ${getErrorMessage(error)}`,
      'ERROR'
    );
    Uniwind.setTheme('system');
  }
}

/**
 * Set theme preference - saves to storage and updates Uniwind
 */
export async function setThemePreference(
  preference: ThemePreference
): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, preference);
    Uniwind.setTheme(toUniwindTheme(preference));
  } catch (error) {
    addLog(
      `Failed to save theme preference: ${getErrorMessage(error)}`,
      'ERROR'
    );
  }
}

/**
 * Hook to get the current theme preference for UI display.
 * Returns the user-facing preference (System/Light/Dark).
 */
export function useThemePreference(): ThemePreference {
  const { theme, hasAdaptiveThemes } = useUniwind();
  const [preference, setPreference] = useState<ThemePreference>('System');

  useEffect(() => {
    // Load saved preference to get accurate user selection
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved) {
        setPreference(normalizePreference(saved));
      } else {
        setPreference(fromUniwindTheme(theme, hasAdaptiveThemes));
      }
    });
  }, [theme, hasAdaptiveThemes]);

  return preference;
}
