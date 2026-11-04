import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
} from '../types/profile';

const CALM_MODE_STORAGE_KEY = 'ia_calm_mode';
const ACCESSIBILITY_STORAGE_KEY = 'ia_accessibility_prefs';

export interface CalmModeContextValue {
  isCalmMode: boolean;
  setCalmMode: (enabled: boolean) => void;
  toggleCalmMode: () => void;
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

      return {
        ...DEFAULT_ACCESSIBILITY_PREFERENCES,
        ...parsed,
        calmMode: calm,
        reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : calm || prefersReduced,
      };
    }

    const initialCalm = legacyCalm !== null ? legacyCalm === 'true' : prefersReduced;
    return {
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
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
      root.classList.toggle('ia-calm-mode', preferences.calmMode);
      root.setAttribute('data-calm-mode', preferences.calmMode ? 'true' : 'false');
      root.setAttribute('data-font-size', preferences.fontSize || 'normal');
      root.setAttribute('data-contrast', preferences.contrast || 'standard');
      root.setAttribute('data-spacing', preferences.spacing || 'standard');
      root.setAttribute(
        'data-reduce-motion',
        preferences.reduceMotion || preferences.calmMode ? 'true' : 'false'
      );

      if (document.body) {
        document.body.classList.toggle('ia-calm-mode', preferences.calmMode);
      }
    }
  }, [preferences]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CALM_MODE_STORAGE_KEY && e.newValue !== null) {
        const enabled = e.newValue === 'true';
        setPreferences((prev) => ({ ...prev, calmMode: enabled }));
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
      reduceMotion: enabled ? true : prev.reduceMotion,
    }));
  }, []);

  const toggleCalmMode = useCallback(() => {
    setPreferences((prev) => {
      const nextCalm = !prev.calmMode;
      return {
        ...prev,
        calmMode: nextCalm,
        reduceMotion: nextCalm ? true : prev.reduceMotion,
      };
    });
  }, []);

  const updatePreferences = useCallback((partial: Partial<AccessibilityPreferences>) => {
    setPreferences((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_ACCESSIBILITY_PREFERENCES });
  }, []);

  return (
    <CalmModeContext.Provider
      value={{
        isCalmMode: preferences.calmMode,
        setCalmMode,
        toggleCalmMode,
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
      setCalmMode: () => {},
      toggleCalmMode: () => {},
      preferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
      updatePreferences: () => {},
      resetPreferences: () => {},
    };
  }
  return ctx;
}
