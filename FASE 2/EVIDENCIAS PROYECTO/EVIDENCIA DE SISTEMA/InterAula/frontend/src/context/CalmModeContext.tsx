import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
  type VisualThemeMode,
} from '../types/profile';
import { hasSavedVisualPreference } from '../utils/visualPreferences';

const CALM_MODE_STORAGE_KEY = 'ia_calm_mode';
const ACCESSIBILITY_STORAGE_KEY = 'ia_accessibility_prefs';

export interface CalmModeContextValue {
  isCalmMode: boolean;
  isDarkMode: boolean;
  /** True whenever the active visual surface is dark (Dark Mode OR Calm Mode - Crepúsculo). */
  isDarkSurface: boolean;
  themeMode: VisualThemeMode;
  /** True when the browser already had an explicit visual choice before initial mount or completed onboarding. */
  hadExplicitVisualChoice: boolean;
  setCalmMode: (enabled: boolean) => void;
  toggleCalmMode: () => void;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  setThemeMode: (mode: VisualThemeMode) => void;
  preferences: AccessibilityPreferences;
  updatePreferences: (partial: Partial<AccessibilityPreferences>) => void;
  markVisualOnboardingDone: (partial?: Partial<AccessibilityPreferences>) => AccessibilityPreferences;
  resetPreferences: () => void;
}

const CalmModeContext = createContext<CalmModeContextValue | undefined>(undefined);

interface BootPreferencesState {
  preferences: AccessibilityPreferences;
  hadExplicitChoice: boolean;
}

function loadBootPreferencesState(): BootPreferencesState {
  if (typeof window === 'undefined') {
    return {
      preferences: { ...DEFAULT_ACCESSIBILITY_PREFERENCES },
      hadExplicitChoice: false,
    };
  }
  try {
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const legacyCalm = window.localStorage.getItem(CALM_MODE_STORAGE_KEY);
    const savedRaw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);

    if (savedRaw) {
      const parsed = JSON.parse(savedRaw) as Partial<AccessibilityPreferences>;
      const explicit = hasSavedVisualPreference(parsed, legacyCalm);
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
        preferences: {
          ...DEFAULT_ACCESSIBILITY_PREFERENCES,
          ...parsed,
          themeMode: resolvedTheme,
          darkMode: resolvedTheme === 'dark',
          calmMode: resolvedTheme === 'calm',
          reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : calm || prefersReduced,
        },
        hadExplicitChoice: explicit,
      };
    }

    const explicitLegacy = legacyCalm === 'true';
    const initialCalm = legacyCalm !== null ? legacyCalm === 'true' : prefersReduced;
    return {
      preferences: {
        ...DEFAULT_ACCESSIBILITY_PREFERENCES,
        themeMode: initialCalm ? 'calm' : 'light',
        darkMode: false,
        calmMode: initialCalm,
        reduceMotion: initialCalm || prefersReduced,
      },
      hadExplicitChoice: explicitLegacy,
    };
  } catch {
    return {
      preferences: { ...DEFAULT_ACCESSIBILITY_PREFERENCES },
      hadExplicitChoice: false,
    };
  }
}

export function CalmModeProvider({ children }: { children: ReactNode }) {
  const [bootState] = useState<BootPreferencesState>(loadBootPreferencesState);
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(bootState.preferences);
  const [hadExplicitVisualChoice, setHadExplicitVisualChoice] = useState<boolean>(
    bootState.hadExplicitChoice
  );

  const isDarkMode = Boolean(preferences.darkMode || preferences.themeMode === 'dark');
  const isCalmMode = !isDarkMode && Boolean(preferences.calmMode || preferences.themeMode === 'calm');
  const calmTone = preferences.calmTone || 'sage';
  const isDuskMode = isCalmMode && calmTone === 'dusk';
  const isDarkSurface = isDarkMode || isDuskMode;
  const resolvedThemeMode: VisualThemeMode = isDarkMode ? 'dark' : isCalmMode ? 'calm' : 'light';

  useEffect(() => {
    try {
      window.localStorage.setItem(CALM_MODE_STORAGE_KEY, String(isCalmMode));
      window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage write errors in restricted environments
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      root.classList.toggle('ia-calm-mode', isCalmMode);
      root.classList.toggle('ia-dark-mode', isDarkMode);
      root.classList.toggle('ia-dark-surface', isDarkSurface);
      root.setAttribute('data-calm-mode', isCalmMode ? 'true' : 'false');
      root.setAttribute('data-calm-tone', calmTone);
      root.setAttribute('data-dark-mode', isDarkMode ? 'true' : 'false');
      root.setAttribute('data-dark-surface', isDarkSurface ? 'true' : 'false');
      root.setAttribute('data-theme', resolvedThemeMode);
      root.setAttribute('data-font-size', preferences.fontSize || 'normal');
      root.setAttribute('data-contrast', preferences.contrast || 'standard');
      root.setAttribute('data-spacing', preferences.spacing || 'standard');
      root.setAttribute(
        'data-reduce-motion',
        preferences.reduceMotion || preferences.disableFlashing || isCalmMode ? 'true' : 'false'
      );
      root.setAttribute('data-warm-filter', preferences.warmFilter ? 'true' : 'false');
      root.setAttribute('data-easy-font', preferences.easyReadingFont ? 'true' : 'false');
      root.setAttribute('data-reading-ruler', preferences.readingRuler ? 'true' : 'false');
      root.setAttribute(
        'data-disable-flashing',
        preferences.disableFlashing || isCalmMode ? 'true' : 'false'
      );
      root.setAttribute('data-literal-language', preferences.literalLanguage ? 'true' : 'false');

      if (document.body) {
        document.body.classList.toggle('ia-calm-mode', isCalmMode);
        document.body.classList.toggle('ia-dark-mode', isDarkMode);
        document.body.classList.toggle('ia-dark-surface', isDarkSurface);
      }
    }
  }, [preferences, isCalmMode, isDarkMode, isDarkSurface, calmTone, resolvedThemeMode]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CALM_MODE_STORAGE_KEY && e.newValue !== null) {
        const enabled = e.newValue === 'true';
        setPreferences((prev) => ({
          ...prev,
          calmMode: enabled,
          darkMode: enabled ? false : prev.darkMode,
          themeMode: enabled ? 'calm' : prev.darkMode ? 'dark' : 'light',
        }));
      } else if (e.key === ACCESSIBILITY_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<AccessibilityPreferences>;
          setPreferences((prev) => ({ ...prev, ...parsed }));
          if (parsed.visualOnboardingCompleted) {
            setHadExplicitVisualChoice(true);
          }
        } catch {
          // Ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setCalmMode = useCallback((enabled: boolean) => {
    setHadExplicitVisualChoice(true);
    setPreferences((prev) => ({
      ...prev,
      calmMode: enabled,
      darkMode: enabled ? false : prev.darkMode,
      themeMode: enabled ? 'calm' : prev.darkMode ? 'dark' : 'light',
      reduceMotion: enabled ? true : prev.reduceMotion,
      visualOnboardingCompleted: true,
    }));
  }, []);

  const toggleCalmMode = useCallback(() => {
    setHadExplicitVisualChoice(true);
    setPreferences((prev) => {
      const nextCalm = !prev.calmMode;
      return {
        ...prev,
        calmMode: nextCalm,
        darkMode: nextCalm ? false : prev.darkMode,
        themeMode: nextCalm ? 'calm' : prev.darkMode ? 'dark' : 'light',
        reduceMotion: nextCalm ? true : prev.reduceMotion,
        visualOnboardingCompleted: true,
      };
    });
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    setHadExplicitVisualChoice(true);
    setPreferences((prev) => ({
      ...prev,
      darkMode: enabled,
      calmMode: enabled ? false : prev.calmMode,
      themeMode: enabled ? 'dark' : prev.calmMode ? 'calm' : 'light',
      visualOnboardingCompleted: true,
    }));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setHadExplicitVisualChoice(true);
    setPreferences((prev) => {
      const nextDark = !prev.darkMode;
      return {
        ...prev,
        darkMode: nextDark,
        calmMode: nextDark ? false : prev.calmMode,
        themeMode: nextDark ? 'dark' : prev.calmMode ? 'calm' : 'light',
        visualOnboardingCompleted: true,
      };
    });
  }, []);

  const setThemeMode = useCallback((mode: VisualThemeMode) => {
    setHadExplicitVisualChoice(true);
    setPreferences((prev) => ({
      ...prev,
      themeMode: mode,
      darkMode: mode === 'dark',
      calmMode: mode === 'calm',
      reduceMotion: mode === 'calm' ? true : prev.reduceMotion,
      visualOnboardingCompleted: true,
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
      } else if (partial.calmTone) {
        merged.calmMode = true;
        merged.darkMode = false;
        merged.themeMode = 'calm';
      }
      if (partial.visualOnboardingCompleted) {
        setHadExplicitVisualChoice(true);
      }
      return merged;
    });
  }, []);

  const markVisualOnboardingDone = useCallback(
    (partial?: Partial<AccessibilityPreferences>): AccessibilityPreferences => {
      setHadExplicitVisualChoice(true);
      let snapshot: AccessibilityPreferences = {
        ...preferences,
        ...partial,
        visualOnboardingCompleted: true,
      };
      setPreferences((prev) => {
        const merged: AccessibilityPreferences = {
          ...prev,
          ...partial,
          visualOnboardingCompleted: true,
        };
        if (partial?.themeMode) {
          merged.darkMode = partial.themeMode === 'dark';
          merged.calmMode = partial.themeMode === 'calm';
        }
        snapshot = merged;
        return merged;
      });
      return snapshot;
    },
    [preferences]
  );

  const resetPreferences = useCallback(() => {
    setPreferences((prev) => ({
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      visualOnboardingCompleted: Boolean(prev.visualOnboardingCompleted),
    }));
  }, []);

  return (
    <CalmModeContext.Provider
      value={{
        isCalmMode,
        isDarkMode,
        isDarkSurface,
        themeMode: resolvedThemeMode,
        hadExplicitVisualChoice,
        setCalmMode,
        toggleCalmMode,
        setDarkMode,
        toggleDarkMode,
        setThemeMode,
        preferences,
        updatePreferences,
        markVisualOnboardingDone,
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
      isDarkSurface: false,
      themeMode: 'light',
      hadExplicitVisualChoice: false,
      setCalmMode: () => {},
      toggleCalmMode: () => {},
      setDarkMode: () => {},
      toggleDarkMode: () => {},
      setThemeMode: () => {},
      preferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
      updatePreferences: () => {},
      markVisualOnboardingDone: () => DEFAULT_ACCESSIBILITY_PREFERENCES,
      resetPreferences: () => {},
    };
  }
  return ctx;
}
