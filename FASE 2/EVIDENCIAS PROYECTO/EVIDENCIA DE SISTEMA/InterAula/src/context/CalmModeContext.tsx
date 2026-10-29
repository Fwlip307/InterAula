import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

const CALM_MODE_STORAGE_KEY = 'ia_calm_mode';

export interface CalmModeContextValue {
  isCalmMode: boolean;
  setCalmMode: (enabled: boolean) => void;
  toggleCalmMode: () => void;
}

const CalmModeContext = createContext<CalmModeContextValue | undefined>(undefined);

function getInitialCalmMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(CALM_MODE_STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return false;
}

export function CalmModeProvider({ children }: { children: ReactNode }) {
  const [isCalmMode, setIsCalmMode] = useState<boolean>(getInitialCalmMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(CALM_MODE_STORAGE_KEY, String(isCalmMode));
    } catch {
      // Ignore storage write errors
    }

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('ia-calm-mode', isCalmMode);
      document.documentElement.setAttribute('data-calm-mode', isCalmMode ? 'true' : 'false');
      if (document.body) {
        document.body.classList.toggle('ia-calm-mode', isCalmMode);
      }
    }
  }, [isCalmMode]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CALM_MODE_STORAGE_KEY && e.newValue !== null) {
        setIsCalmMode(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setCalmMode = useCallback((enabled: boolean) => {
    setIsCalmMode(enabled);
  }, []);

  const toggleCalmMode = useCallback(() => {
    setIsCalmMode((prev) => !prev);
  }, []);

  return (
    <CalmModeContext.Provider value={{ isCalmMode, setCalmMode, toggleCalmMode }}>
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
    };
  }
  return ctx;
}

