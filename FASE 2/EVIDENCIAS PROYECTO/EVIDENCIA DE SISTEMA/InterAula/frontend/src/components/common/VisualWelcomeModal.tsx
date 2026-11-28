import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from './Icons';
import { useCalmMode } from '../../context/CalmModeContext';
import {
  VISUAL_STYLE_OPTIONS,
  buildVisualStylePatch,
  resolveVisualStyleId,
  type VisualStyleId,
  type VisualStyleOption,
} from '../../utils/visualPreferences';
import type { AccessibilityPreferences } from '../../types/profile';
import interaulaLogo from '../../assets/branding/interaula-logo.png';
import '../../styles/visualWelcome.css';

interface VisualWelcomeModalProps {
  isOpen: boolean;
  onComplete: (finalPreferences: AccessibilityPreferences) => Promise<void> | void;
}

function StylePreviewCard({
  option,
  selected,
  onSelect,
}: {
  option: VisualStyleOption;
  selected: boolean;
  onSelect: (option: VisualStyleOption) => void;
}) {
  const { preview } = option;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`ia-visual-option-card ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(option)}
    >
      <div
        className="ia-visual-preview-frame"
        style={{
          backgroundColor: preview.bgBody,
          borderColor: preview.border,
        }}
        aria-hidden="true"
      >
        <div
          className="ia-visual-preview-topbar"
          style={{
            backgroundColor: preview.bgTopbar,
            borderBottomColor: preview.border,
          }}
        >
          <span className="ia-visual-preview-brand-dots">
            <span
              className="ia-visual-preview-logo-dot"
              style={{ backgroundColor: preview.primaryBg }}
            />
            <span
              className="ia-visual-preview-nav-pill"
              style={{ backgroundColor: preview.textMain }}
            />
          </span>
          <span
            className="ia-visual-preview-chip"
            style={{
              backgroundColor: preview.chipBg,
              color: preview.textMuted,
            }}
          >
            {option.categoryLabel}
          </span>
        </div>

        <div className="ia-visual-preview-canvas">
          <div
            className="ia-visual-preview-card"
            style={{
              backgroundColor: preview.bgCard,
              borderColor: preview.border,
            }}
          >
            <div className="ia-visual-preview-copy">
              <span
                className="ia-visual-preview-title"
                style={{ color: preview.textMain }}
              >
                Espacio de estudio
              </span>
              <span
                className="ia-visual-preview-text"
                style={{ color: preview.textMuted }}
              >
                Lectura cómoda y ordenada
              </span>
            </div>

            <div className="ia-visual-preview-footer">
              <span
                className="ia-visual-preview-chip"
                style={{
                  backgroundColor: preview.chipBg,
                  color: preview.textMain,
                }}
              >
                Tarjeta
              </span>
              <span
                className="ia-visual-preview-cta"
                style={{
                  backgroundColor: preview.primaryBg,
                  color: preview.primaryText,
                }}
              >
                Continuar
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="ia-visual-option-meta">
        <div className="ia-visual-option-title-row">
          <span className="ia-visual-option-name">{option.name}</span>
          <span className="ia-visual-option-check" aria-hidden="true">
            <CheckIcon size={13} />
          </span>
        </div>
        <p className="ia-visual-option-desc">{option.shortDescription}</p>
      </div>
    </button>
  );
}

export default function VisualWelcomeModal({ isOpen, onComplete }: VisualWelcomeModalProps) {
  const { preferences, updatePreferences, markVisualOnboardingDone } = useCalmMode();
  const [selectedId, setSelectedId] = useState<VisualStyleId>(() =>
    resolveVisualStyleId(preferences)
  );
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(resolveVisualStyleId(preferences));
    const timer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const baseOptions = VISUAL_STYLE_OPTIONS.filter((opt) => opt.category !== 'calm');
  const calmOptions = VISUAL_STYLE_OPTIONS.filter((opt) => opt.category === 'calm');

  const handleSelectOption = (option: VisualStyleOption) => {
    setSelectedId(option.id);
    updatePreferences(buildVisualStylePatch(option, preferences));
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const chosen =
        VISUAL_STYLE_OPTIONS.find((opt) => opt.id === selectedId) || VISUAL_STYLE_OPTIONS[0];
      const patch = buildVisualStylePatch(chosen, preferences);
      const finalPrefs = markVisualOnboardingDone(patch);
      await onComplete(finalPrefs);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueDefault = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const defaultOption = VISUAL_STYLE_OPTIONS[0];
      const patch = buildVisualStylePatch(defaultOption, preferences);
      const finalPrefs = markVisualOnboardingDone(patch);
      await onComplete(finalPrefs);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="ia-visual-welcome-backdrop" role="presentation">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ia-visual-welcome-title"
        aria-describedby="ia-visual-welcome-desc"
        className="ia-visual-welcome-dialog"
      >
        <header className="ia-visual-welcome-header">
          <span className="ia-visual-welcome-brand">
            <img src={interaulaLogo} alt="" />
            <span>Bienvenida a InterAula</span>
          </span>
          <h2 id="ia-visual-welcome-title">¿Cómo prefieres ver InterAula?</h2>
          <p id="ia-visual-welcome-desc">
            Queremos que tu experiencia sea cómoda. Elige el estilo visual que prefieras. Puedes cambiarlo cuando quieras desde la configuración.
          </p>
        </header>

        <div
          className="ia-visual-welcome-sections"
          role="radiogroup"
          aria-label="Estilos visuales disponibles"
        >
          <div>
            <div className="ia-visual-welcome-group-label">
              <span>Estilos estándar</span>
              <span className="ia-visual-welcome-group-hint">Vista previa interactiva en vivo</span>
            </div>
            <div className="ia-visual-welcome-grid-base">
              {baseOptions.map((opt) => (
                <StylePreviewCard
                  key={opt.id}
                  option={opt}
                  selected={selectedId === opt.id}
                  onSelect={handleSelectOption}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="ia-visual-welcome-group-label">
              <span>Modo Calma · Baja carga visual</span>
              <span className="ia-visual-welcome-group-hint">3 tonos suaves disponibles</span>
            </div>
            <div className="ia-visual-welcome-grid-calm">
              {calmOptions.map((opt) => (
                <StylePreviewCard
                  key={opt.id}
                  option={opt}
                  selected={selectedId === opt.id}
                  onSelect={handleSelectOption}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="ia-visual-welcome-footer">
          <button
            type="button"
            className="ia-visual-welcome-default-btn"
            onClick={handleContinueDefault}
            disabled={submitting}
          >
            Continuar con el estilo predeterminado
          </button>

          <button
            type="button"
            className="ia-btn-primary ia-visual-welcome-confirm-btn"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Aplicando estilo...' : 'Comenzar a utilizar InterAula'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
