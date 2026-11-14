import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCalmMode } from '../../context/CalmModeContext';
import {
  SunIcon,
  MoonIcon,
  SlidersIcon,
  ChevronDownIcon,
  CheckIcon,
} from '../common/Icons';

interface ThemeModeMenuProps {
  variant?: 'app' | 'landing';
}

export default function ThemeModeMenu({ variant = 'app' }: ThemeModeMenuProps) {
  const {
    isCalmMode,
    isDarkMode,
    themeMode,
    setThemeMode,
    preferences,
    updatePreferences,
  } = useCalmMode();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getActiveModeInfo = () => {
    if (isCalmMode || themeMode === 'calm') {
      return {
        label: 'Calma',
        icon: <SlidersIcon size={14} color="var(--ia-text-muted)" />,
      };
    }
    if (isDarkMode || themeMode === 'dark') {
      return {
        label: 'Oscuro',
        icon: <MoonIcon size={14} color="#60a5fa" />,
      };
    }
    return {
      label: 'Claro',
      icon: <SunIcon size={14} color="#eab308" />,
    };
  };

  const current = getActiveModeInfo();

  return (
    <div
      ref={containerRef}
      className={`ia-theme-menu-container ${variant === 'landing' ? 'ia-theme-menu--landing' : ''}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="ia-unified-mode-btn"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Selector de modo visual. Modo actual: ${current.label}`}
        title={`Modo visual: ${current.label}. Clic para cambiar entre Claro, Oscuro, Calma y ajustar texto.`}
      >
        <span className="ia-unified-mode-icon">{current.icon}</span>
        <span className="ia-unified-mode-text">Modo</span>
        <span className="ia-unified-mode-badge">{current.label}</span>
        <ChevronDownIcon
          size={13}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.18s ease',
            opacity: 0.7,
          }}
        />
      </button>

      {isOpen && (
        <div
          className="ia-theme-dropdown-popover"
          role="dialog"
          aria-label="Ajustes de visualización y accesibilidad"
        >
          {/* Header */}
          <div className="ia-theme-popover-header">
            <span className="ia-theme-popover-title">MODO VISUAL</span>
            <span className="ia-theme-popover-hint">Elige la experiencia que prefieras</span>
          </div>

          {/* Opciones de modo: Claro / Oscuro / Calma */}
          <div className="ia-theme-mode-list">
            <button
              type="button"
              className={`ia-theme-mode-option ${themeMode === 'light' && !isCalmMode ? 'selected' : ''}`}
              onClick={() => {
                setThemeMode('light');
                setIsOpen(false);
              }}
            >
              <div className="ia-theme-mode-option__icon sun">
                <SunIcon size={17} />
              </div>
              <div className="ia-theme-mode-option__content">
                <div className="ia-theme-mode-option__title">Modo Claro</div>
                <div className="ia-theme-mode-option__desc">Fondo luminoso estándar y nítido</div>
              </div>
              {themeMode === 'light' && !isCalmMode && (
                <div className="ia-theme-check">
                  <CheckIcon size={14} />
                </div>
              )}
            </button>

            <button
              type="button"
              className={`ia-theme-mode-option ${themeMode === 'dark' ? 'selected' : ''}`}
              onClick={() => {
                setThemeMode('dark');
                setIsOpen(false);
              }}
            >
              <div className="ia-theme-mode-option__icon moon">
                <MoonIcon size={17} />
              </div>
              <div className="ia-theme-mode-option__content">
                <div className="ia-theme-mode-option__title">Modo Oscuro</div>
                <div className="ia-theme-mode-option__desc">Descanso visual para ambientes con poca luz</div>
              </div>
              {themeMode === 'dark' && (
                <div className="ia-theme-check">
                  <CheckIcon size={14} />
                </div>
              )}
            </button>

            <button
              type="button"
              className={`ia-theme-mode-option ${themeMode === 'calm' || isCalmMode ? 'selected' : ''}`}
              onClick={() => {
                setThemeMode('calm');
                setIsOpen(false);
              }}
            >
              <div className="ia-theme-mode-option__icon calm">
                <SlidersIcon size={17} />
              </div>
              <div className="ia-theme-mode-option__content">
                <div className="ia-theme-mode-option__title">Modo Calma</div>
                <div className="ia-theme-mode-option__desc">Sin distracciones, tonos neutros y lectura pausada</div>
              </div>
              {(themeMode === 'calm' || isCalmMode) && (
                <div className="ia-theme-check">
                  <CheckIcon size={14} />
                </div>
              )}
            </button>
          </div>

          <div className="ia-theme-popover-divider" />

          {/* Ajustes de tipografía y lectura */}
          <div className="ia-theme-popover-subheading">TAMAÑO DE TEXTO</div>
          <div className="ia-theme-pills-row">
            <button
              type="button"
              onClick={() => updatePreferences({ fontSize: 'normal' })}
              className={`ia-theme-pill ${preferences.fontSize === 'normal' ? 'active' : ''}`}
            >
              100% (Normal)
            </button>
            <button
              type="button"
              onClick={() => updatePreferences({ fontSize: 'large' })}
              className={`ia-theme-pill ${preferences.fontSize === 'large' ? 'active' : ''}`}
            >
              108% (Medio)
            </button>
            <button
              type="button"
              onClick={() => updatePreferences({ fontSize: 'xlarge' })}
              className={`ia-theme-pill ${preferences.fontSize === 'xlarge' ? 'active' : ''}`}
            >
              116% (Grande)
            </button>
          </div>

          <div className="ia-theme-popover-subheading" style={{ marginTop: '10px' }}>
            ESPACIADO Y LECTURA
          </div>
          <div className="ia-theme-pills-row">
            <button
              type="button"
              onClick={() => updatePreferences({ spacing: 'standard' })}
              className={`ia-theme-pill ${preferences.spacing === 'standard' ? 'active' : ''}`}
            >
              Estándar
            </button>
            <button
              type="button"
              onClick={() => updatePreferences({ spacing: 'spacious' })}
              className={`ia-theme-pill ${preferences.spacing === 'spacious' ? 'active' : ''}`}
            >
              Amplio (Holgado)
            </button>
          </div>

          <div className="ia-theme-popover-subheading" style={{ marginTop: '10px' }}>
            APOYOS SENSORIALES Y LECTURA
          </div>
          <div className="ia-theme-pills-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              aria-pressed={Boolean(preferences.easyReadingFont)}
              onClick={() => updatePreferences({ easyReadingFont: !preferences.easyReadingFont })}
              className={`ia-theme-pill ${preferences.easyReadingFont ? 'active' : ''}`}
              title="Activa la tipografía Lexend de alta legibilidad para lectura cómoda"
            >
              Fuente lectura fácil
            </button>
            <button
              type="button"
              aria-pressed={Boolean(preferences.warmFilter)}
              onClick={() => updatePreferences({ warmFilter: !preferences.warmFilter })}
              className={`ia-theme-pill ${preferences.warmFilter ? 'active' : ''}`}
              title="Suaviza blancos intensos con tonalidad cálida sin distorsionar imágenes"
            >
              Filtro cálido suave
            </button>
            <button
              type="button"
              aria-pressed={Boolean(preferences.readingRuler)}
              onClick={() => updatePreferences({ readingRuler: !preferences.readingRuler })}
              className={`ia-theme-pill ${preferences.readingRuler ? 'active' : ''}`}
              title="Resalta la línea actual de lectura y atenúa el resto"
            >
              Regla guiada
            </button>
            <button
              type="button"
              aria-pressed={Boolean(preferences.disableFlashing)}
              onClick={() =>
                updatePreferences({
                  disableFlashing: !preferences.disableFlashing,
                  reduceMotion: !preferences.disableFlashing || preferences.reduceMotion,
                })
              }
              className={`ia-theme-pill ${preferences.disableFlashing ? 'active' : ''}`}
              title="Desactiva animaciones y elementos parpadeantes"
            >
              Sin destellos
            </button>
          </div>
          {preferences.readingRuler && (
            <div className="ia-theme-pills-row" style={{ marginTop: '6px', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--ia-text-muted)', alignSelf: 'center' }}>
                Intensidad regla:
              </span>
              {(['soft', 'medium', 'strong'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updatePreferences({ readingRulerIntensity: lvl })}
                  className={`ia-theme-pill ${(preferences.readingRulerIntensity || 'medium') === lvl ? 'active' : ''}`}
                >
                  {lvl === 'soft' ? 'Suave' : lvl === 'medium' ? 'Media' : 'Alta'}
                </button>
              ))}
            </div>
          )}

          <div className="ia-theme-popover-divider" />

          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="ia-theme-popover-footer-link"
          >
            <span>Configuración y accesibilidad avanzada</span>
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

