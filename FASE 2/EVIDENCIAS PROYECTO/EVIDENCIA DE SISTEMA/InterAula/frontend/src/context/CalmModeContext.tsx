import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
  type VisualThemeMode,
} from '../types/profile';

const CALM_MODE_STORAGE_KEY = 'ia_calm_mode';
const ACCESSIBILITY_STORAGE_KEY = 'ia_accessibility_prefs';

export interface CalmModeContextValue {
  isCalmMode: boolean;
  isDarkMode: boolean;
  themeMode: VisualThemeMode;
  setCalmMode: (enabled: boolean) => void;
  toggleCalmMode: () => void;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  setThemeMode: (mode: VisualThemeMode) => void;
  preferences: AccessibilityPreferences;
  updatePreferences: (partial: Partial<AccessibilityPreferences>) => void;
  resetPreferences: () => void;
}

const CalmModeContext = createContext<CalmModeContextValue | undefined>(undefined);

function loadInitialPreferences(): AccessibilityPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
  try {
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const legacyCalm = window.localStorage.getItem(CALM_MODE_STORAGE_KEY);
    const savedRaw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);

    if (savedRaw) {
      const parsed = JSON.parse(savedRaw) as Partial<AccessibilityPreferences>;
      const calm =
        typeof parsed.calmMode === 'boolean'
          ? parsed.calmMode
          : legacyCalm !== null
          ? legacyCalm === 'true'
          : prefersReduced;
      const dark = typeof parsed.darkMode === 'boolean' ? parsed.darkMode : parsed.themeMode === 'dark';
      const resolvedTheme: VisualThemeMode =
        parsed.themeMode || (dark ? 'dark' : calm ? 'calm' : 'light');

      return {
        ...DEFAULT_ACCESSIBILITY_PREFERENCES,
        ...parsed,
        themeMode: resolvedTheme,
        darkMode: dark,
        calmMode: calm,
        reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : calm || prefersReduced,
      };
    }

    const initialCalm = legacyCalm !== null ? legacyCalm === 'true' : prefersReduced;
    return {
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      themeMode: initialCalm ? 'calm' : 'light',
      darkMode: false,
      calmMode: initialCalm,
      reduceMotion: initialCalm || prefersReduced,
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
}

export function CalmModeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(loadInitialPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(CALM_MODE_STORAGE_KEY, String(preferences.calmMode));
      window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage write errors in restricted environments
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const isDark = Boolean(preferences.darkMode || preferences.themeMode === 'dark');
      const isCalm = Boolean(preferences.calmMode || preferences.themeMode === 'calm');

      root.classList.toggle('ia-calm-mode', isCalm);
      root.classList.toggle('ia-dark-mode', isDark);
      root.setAttribute('data-calm-mode', isCalm ? 'true' : 'false');
      root.setAttribute('data-dark-mode', isDark ? 'true' : 'false');
      root.setAttribute('data-theme', isDark ? 'dark' : isCalm ? 'calm' : 'light');
      root.setAttribute('data-font-size', preferences.fontSize || 'normal');
      root.setAttribute('data-contrast', preferences.contrast || 'standard');
      root.setAttribute('data-spacing', preferences.spacing || 'standard');
      root.setAttribute(
        'data-reduce-motion',
        preferences.reduceMotion || preferences.disableFlashing || isCalm ? 'true' : 'false'
      );
      root.setAttribute('data-warm-filter', preferences.warmFilter ? 'true' : 'false');
      root.setAttribute('data-easy-font', preferences.easyReadingFont ? 'true' : 'false');
      root.setAttribute('data-reading-ruler', preferences.readingRuler ? 'true' : 'false');
      root.setAttribute(
        'data-disable-flashing',
        preferences.disableFlashing || isCalm ? 'true' : 'false'
      );
      root.setAttribute('data-literal-language', preferences.literalLanguage ? 'true' : 'false');

      if (document.body) {
        document.body.classList.toggle('ia-calm-mode', isCalm);
        document.body.classList.toggle('ia-dark-mode', isDark);
      }
    }
  }, [preferences]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CALM_MODE_STORAGE_KEY && e.newValue !== null) {
        const enabled = e.newValue === 'true';
        setPreferences((prev) => ({
          ...prev,
          calmMode: enabled,
          themeMode: enabled ? 'calm' : prev.darkMode ? 'dark' : 'light',
        }));
      } else if (e.key === ACCESSIBILITY_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<AccessibilityPreferences>;
          setPreferences((prev) => ({ ...prev, ...parsed }));
        } catch {
          // Ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setCalmMode = useCallback((enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      calmMode: enabled,
      darkMode: enabled ? false : prev.darkMode,
      themeMode: enabled ? 'calm' : prev.darkMode ? 'dark' : 'light',
      reduceMotion: enabled ? true : prev.reduceMotion,
    }));
  }, []);

  const toggleCalmMode = useCallback(() => {
    setPreferences((prev) => {
      const nextCalm = !prev.calmMode;
      return {
        ...prev,
        calmMode: nextCalm,
        darkMode: nextCalm ? false : prev.darkMode,
        themeMode: nextCalm ? 'calm' : prev.darkMode ? 'dark' : 'light',
        reduceMotion: nextCalm ? true : prev.reduceMotion,
      };
    });
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      darkMode: enabled,
      calmMode: enabled ? false : prev.calmMode,
      themeMode: enabled ? 'dark' : prev.calmMode ? 'calm' : 'light',
    }));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setPreferences((prev) => {
      const nextDark = !prev.darkMode;
      return {
        ...prev,
        darkMode: nextDark,
        calmMode: nextDark ? false : prev.calmMode,
        themeMode: nextDark ? 'dark' : prev.calmMode ? 'calm' : 'light',
      };
    });
  }, []);

  const setThemeMode = useCallback((mode: VisualThemeMode) => {
    setPreferences((prev) => ({
      ...prev,
      themeMode: mode,
      darkMode: mode === 'dark',
      calmMode: mode === 'calm',
      reduceMotion: mode === 'calm' ? true : prev.reduceMotion,
    }));
  }, []);

  const updatePreferences = useCallback((partial: Partial<AccessibilityPreferences>) => {
    setPreferences((prev) => {
      const merged = { ...prev, ...partial };
      if (partial.themeMode) {
        merged.darkMode = partial.themeMode === 'dark';
        merged.calmMode = partial.themeMode === 'calm';
      } else if (typeof partial.darkMode === 'boolean') {
        if (partial.darkMode) merged.calmMode = false;
        merged.themeMode = partial.darkMode ? 'dark' : merged.calmMode ? 'calm' : 'light';
      } else if (typeof partial.calmMode === 'boolean') {
        if (partial.calmMode) merged.darkMode = false;
        merged.themeMode = partial.calmMode ? 'calm' : merged.darkMode ? 'dark' : 'light';
      }
      return merged;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_ACCESSIBILITY_PREFERENCES });
  }, []);

  const isDarkMode = Boolean(preferences.darkMode || preferences.themeMode === 'dark');
  const resolvedThemeMode: VisualThemeMode =
    preferences.themeMode || (isDarkMode ? 'dark' : preferences.calmMode ? 'calm' : 'light');

  return (
    <CalmModeContext.Provider
      value={{
        isCalmMode: preferences.calmMode,
        isDarkMode,
        themeMode: resolvedThemeMode,
        setCalmMode,
        toggleCalmMode,
        setDarkMode,
        toggleDarkMode,
        setThemeMode,
        preferences,
        updatePreferences,
        resetPreferences,
      }}
    >
      {children}
    </CalmModeContext.Provider>
  );
}

export function useCalmMode(): CalmModeContextValue {
  const ctx = useContext(CalmModeContext);
  if (!ctx) {
    return {
      isCalmMode: false,
      isDarkMode: false,
      themeMode: 'light',
      setCalmMode: () => {},
      toggleCalmMode: () => {},
      setDarkMode: () => {},
      toggleDarkMode: () => {},
      setThemeMode: () => {},
      preferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
      updatePreferences: () => {},
      resetPreferences: () => {},
    };
  }
  return ctx;
}
