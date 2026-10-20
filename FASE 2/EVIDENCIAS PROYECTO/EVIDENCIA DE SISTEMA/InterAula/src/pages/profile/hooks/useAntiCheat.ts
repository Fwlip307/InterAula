import { useState, useEffect } from 'react';

interface UseAntiCheatOptions {
  isOpen: boolean;
  isActiveExam: boolean;
}

export function useAntiCheat({ isOpen, isActiveExam }: UseAntiCheatOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [screenshotBlockedToast, setScreenshotBlockedToast] = useState(false);
  const [pasteWarning, setPasteWarning] = useState(false);

  // Control de pantalla completa (Modo Enfoque)
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('[useAntiCheat] Pantalla completa no soportada o rechazada:', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('[useAntiCheat] Error al salir de pantalla completa:', err);
    }
  };

  // Monitorear cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Bloqueo de capturas y atajos de teclado
  useEffect(() => {
    if (!isOpen) return;

    const blockScreenshot = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        setScreenshotBlockedToast(true);
        setTimeout(() => setScreenshotBlockedToast(false), 3000);
      }

      if (
        e.shiftKey &&
        (e.metaKey || e.ctrlKey) &&
        ['s', 'S', '3', '4', '5'].includes(e.key)
      ) {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        setScreenshotBlockedToast(true);
        setTimeout(() => setScreenshotBlockedToast(false), 3000);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      blockScreenshot(e);

      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'C', 'u', 'U', 's', 'S', 'p', 'P', 'a', 'A'].includes(e.key)
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      blockScreenshot(e);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen]);

  // Detección de pérdida de foco o cambio de pestaña
  useEffect(() => {
    if (!isOpen || !isActiveExam) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setShowTabWarning(true);
        setIsWindowBlurred(true);
      } else {
        setIsWindowBlurred(false);
      }
    };

    const handleWindowBlur = () => {
      setTabSwitchCount((prev) => prev + 1);
      setShowTabWarning(true);
      setIsWindowBlurred(true);
    };

    const handleWindowFocus = () => {
      setIsWindowBlurred(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOpen, isActiveExam]);

  const resetAntiCheat = () => {
    exitFullscreen();
    setTabSwitchCount(0);
    setShowTabWarning(false);
    setIsWindowBlurred(false);
    setPasteWarning(false);
    setScreenshotBlockedToast(false);
  };

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    tabSwitchCount,
    showTabWarning,
    setShowTabWarning,
    isWindowBlurred,
    setIsWindowBlurred,
    screenshotBlockedToast,
    pasteWarning,
    setPasteWarning,
    resetAntiCheat,
  };
}
