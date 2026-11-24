import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  verificationService,
  type ServerAssessment,
  type ServerAssessmentAnswer,
  type AssessmentQuestion,
} from '../../../services/verification.service';
import type { AcademicLevel } from '../../../types/profile';
import {
  AlertCircleIcon,
  CheckIcon,
  ClockIcon,
  ShieldCheckIcon,
  XIcon,
} from '../../../components/common/Icons';
import { ReadAloudControls } from '../../../components/common/ReadAloudControls';
import { assessmentSubjectChoices, subjectDisplayName } from '../../../utils/assessmentSubjects';
import AssessmentSubjectPicker from './AssessmentSubjectPicker';
import AssessmentLoading from './AssessmentLoading';
import { useCalmMode } from '../../../context/CalmModeContext';
import { stopSpeech } from '../../../utils/speechReader';
import interaulaLogo from '../../../assets/branding/interaula-logo.png';
import '../../../styles/assessment.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subjectId: string, subjectName: string, level?: AcademicLevel) => void;
  availableSubjects: { id: string; name: string }[];
  defaultSubjectId?: string;
  userInstitution?: string;
  userCareer?: string;
  userId?: string;
  verifiedSubjectNames?: string[];
}

type EventType = 'fullscreen_exit' | 'visibility_hidden' | 'window_blur' | 'copy_attempt' | 'paste_attempt' | 'abandon';
type LoadingStep = 'checking' | 'preparing' | 'saving' | 'next' | 'recovering' | 'certifying' | null;

const formatTime = (seconds: number) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
const NO_VERIFIED_NAMES: string[] = [];
const PAUSE_TIPS = [
  'Respira con calma y prepara tu enfoque para el siguiente enunciado.',
  'Lee cada alternativa con atención. También puedes usar la lectura en voz alta.',
  'Una pregunta a la vez. Continúa cuando estés listo.',
];
const LOADING_TITLES: Record<Exclude<LoadingStep, null>, string> = {
  checking: 'Comprobando disponibilidad del servicio',
  preparing: 'Generando tu evaluación personalizada',
  saving: 'Evaluando y guardando tu respuesta',
  next: 'Cargando la siguiente pregunta',
  recovering: 'Recuperando el estado de tu intento',
  certifying: 'Confirmando tu acreditación de tutor',
};

export default function TutorValidationBotModal({
  isOpen,
  onClose,
  onSuccess,
  availableSubjects,
  defaultSubjectId,
  userId,
  verifiedSubjectNames = NO_VERIFIED_NAMES,
}: Props) {
  const { isCalmMode } = useCalmMode();
  const choices = useMemo(
    () => assessmentSubjectChoices(availableSubjects, verifiedSubjectNames),
    [availableSubjects, verifiedSubjectNames]
  );

  const [subjectId, setSubjectId] = useState('');
  const [timeMode, setTimeMode] = useState<'standard' | 'extended'>('standard');
  const [attempt, setAttempt] = useState<ServerAssessment | null>(null);
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<ServerAssessmentAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [loading, setLoading] = useState<LoadingStep>('checking');
  const [calmView, setCalmView] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [privacyHidden, setPrivacyHidden] = useState(false);
  const [captureCover, setCaptureCover] = useState(false);
  const [status, setStatus] = useState<{
    serverConfigured: boolean;
    schemaReady?: boolean;
    generationConfigured: boolean;
    catalogSubjects: number;
  } | null>(null);

  const overlay = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opened = useRef<string | null>(null);
  const current = useRef<ServerAssessment | null>(null);
  const busyRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const clock = useRef({ server: Date.now(), client: performance.now() });
  const timeoutSent = useRef('');
  const lastIncident = useRef(0);
  const pendingEvents = useRef<{ id: string; type: EventType }[]>([]);
  const eventQueue = useRef<Promise<void>>(Promise.resolve());
  const submitRef = useRef<(timedOut?: boolean) => Promise<void>>(async () => {});
  const storageKey = userId ? 'interaula_assessment_v2_' + userId : null;
  const initial = useRef({ choices, defaultSubjectId });
  initial.current = { choices, defaultSubjectId };

  function working(value: boolean, step: Exclude<LoadingStep, null> = 'saving') {
    busyRef.current = value;
    setBusy(value);
    setLoading(value ? step : null);
  }

  function clockSync(serverNow: string) {
    clock.current = { server: Date.parse(serverNow), client: performance.now() };
  }

  function receive(value: ServerAssessment) {
    current.current = value;
    setAttempt(value);
    setQuestion(value.question);
    setFeedback(null);
    clockSync(value.serverNow);
    timeoutSent.current = '';
  }

  function remember(id: string | null) {
    if (!storageKey) return;
    try {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    } catch {
      /* optional browser storage */
    }
  }

  async function enterFullscreen() {
    if (!overlay.current?.requestFullscreen) {
      throw new Error(
        'Este navegador no admite pantalla completa para evaluar. Usa un navegador compatible o solicita revisión docente.'
      );
    }
    await overlay.current.requestFullscreen();
    setFullscreen(true);
    dialog.current?.focus();
    setPrivacyHidden(false);
    delete overlay.current.dataset.obscured;
  }

  async function exitFullscreen() {
    if (document.fullscreenElement === overlay.current) {
      try {
        await document.exitFullscreen();
      } catch {
        /* already exited */
      }
    }
  }

  function flushEvents() {
    eventQueue.current = eventQueue.current
      .catch(() => {})
      .then(async () => {
        while (pendingEvents.current.length && current.current) {
          const event = pendingEvents.current[0];
          const id = current.current.id;
          const state = await verificationService.reportAssessmentEvent(id, event.type, event.id);
          pendingEvents.current.shift();
          if (current.current?.id === id) {
            current.current = {
              ...current.current,
              integrityCount: state.integrityCount,
              state: state.state as ServerAssessment['state'],
            };
            setAttempt(current.current);
            if (state.state === 'failed') {
              setQuestion(null);
              remember(null);
              setNotice(
                event.type === 'abandon'
                  ? 'Abandonaste este intento. La evaluación quedó cancelada.'
                  : 'La evaluación se canceló al alcanzar el límite de tres salidas o incidencias de integridad.'
              );
              await exitFullscreen();
            }
          }
        }
      });
    return eventQueue.current;
  }

  function report(type: EventType) {
    if (!current.current || current.current.state !== 'pending') return;
    const now = performance.now();
    if (type !== 'abandon' && now - lastIncident.current < 1500) return;
    lastIncident.current = now;
    pendingEvents.current.push({ id: crypto.randomUUID(), type });
    setNotice(
      type === 'copy_attempt' || type === 'paste_attempt'
        ? 'Copiar y pegar están bloqueados durante la evaluación. Incidencia registrada.'
        : 'Salida de pantalla completa o foco detectada. Vuelve inmediatamente para continuar; al acumular 3 incidencias la prueba se cancela.'
    );
    void flushEvents().catch(() =>
      setError('No pudimos registrar la incidencia. Al continuar se reintentará antes de enviar tu respuesta.')
    );
  }

  useEffect(() => {
    if (!isOpen) {
      opened.current = null;
      return;
    }
    if (opened.current === (storageKey || 'temporary')) return;
    opened.current = storageKey || 'temporary';
    current.current = null;
    setAttempt(null);
    setQuestion(null);
    setFeedback(null);
    setAnswer('');
    setError('');
    setNotice('');
    setConfirmExit(false);
    setStatus(null);
    setLoading('checking');
    setPrivacyHidden(false);
    setCaptureCover(false);
    setFullscreen(!!overlay.current && document.fullscreenElement === overlay.current);
    pendingEvents.current = [];
    lastIncident.current = Number.NEGATIVE_INFINITY;
    timeoutSent.current = '';

    const values = initial.current;
    setSubjectId(
      values.choices.find(
        (s) => (s.aliases.includes(values.defaultSubjectId || '') || s.aliases.includes('catalog:' + values.defaultSubjectId)) && !s.verified
      )?.id ||
        values.choices.find((s) => !s.verified)?.id ||
        ''
    );

    let live = true;
    verificationService
      .assessmentStatus()
      .then((value) => {
        if (live) setStatus(value);
      })
      .catch(() => {
        if (live) setError('No pudimos comprobar la disponibilidad del servidor. Cierra y vuelve a intentarlo.');
      })
      .finally(() => {
        if (live && !busyRef.current) setLoading(null);
      });

    let saved: string | null = null;
    try {
      saved = storageKey ? localStorage.getItem(storageKey) : null;
    } catch {
      /* optional */
    }
    if (saved) {
      working(true, 'recovering');
      verificationService
        .getAssessment(saved)
        .then((value) => {
          if (live) receive(value);
        })
        .catch((cause) => {
          if (live) {
            remember(null);
            setError(cause instanceof Error ? cause.message : 'No pudimos recuperar el intento.');
          }
        })
        .finally(() => {
          if (live) working(false);
        });
    }
    return () => {
      live = false;
      opened.current = null;
    };
  }, [isOpen, storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      current.current = null;
      void exitFullscreen();
      document.body.style.overflow = overflow;
      previousFocus.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === overlay.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  useEffect(() => {
    if (!isOpen || attempt?.state !== 'pending') return;
    const conceal = () => {
      setPrivacyHidden(true);
      if (overlay.current) overlay.current.dataset.obscured = 'true';
      stopSpeech();
    };
    const reveal = () => {
      if (!document.hidden && document.hasFocus() && document.fullscreenElement === overlay.current) {
        setPrivacyHidden(false);
        if (overlay.current) delete overlay.current.dataset.obscured;
      }
    };
    const hidden = () => {
      if (document.hidden) {
        conceal();
        report('visibility_hidden');
      } else reveal();
    };
    const blur = () => {
      conceal();
      report('window_blur');
    };
    const full = () => {
      if (document.fullscreenElement !== overlay.current) {
        conceal();
        report('fullscreen_exit');
      } else reveal();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blur);
    document.addEventListener('fullscreenchange', full);
    window.addEventListener('focus', reveal);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
      document.removeEventListener('fullscreenchange', full);
      window.removeEventListener('focus', reveal);
    };
  }, [isOpen, attempt?.id, attempt?.state]);

  useEffect(() => {
    if (!captureCover) return;
    const timer = setTimeout(() => setCaptureCover(false), 1800);
    return () => clearTimeout(timer);
  }, [captureCover]);

  useEffect(() => {
    if (!isOpen || !question || busy || privacyHidden || captureCover || !fullscreen) return;
    dialog.current?.querySelector<HTMLElement>('#assessment-question-title')?.focus();
  }, [isOpen, question?.id, busy, privacyHidden, captureCover, fullscreen]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (
        current.current?.state === 'pending' &&
        (event.key === 'PrintScreen' ||
          (event.metaKey && event.shiftKey && ['3', '4', '5', 's'].includes(event.key.toLowerCase())))
      ) {
        event.preventDefault();
        setCaptureCover(true);
        stopSpeech();
        setNotice('Contenido protegido temporalmente. El tiempo continúa.');
        return;
      }
      if (event.key === 'Escape' && (event.target as HTMLElement)?.matches('[role="combobox"][aria-expanded="true"]')) {
        return;
      }
      if (
        current.current?.state === 'pending' &&
        (event.ctrlKey || event.metaKey) &&
        ['k', 'p', 's', 'u'].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setNotice('Este atajo está deshabilitado durante la evaluación.');
        return;
      }
      if (event.key === 'Escape') {
        if (current.current?.state === 'pending') {
          event.preventDefault();
          setNotice('Para salir, usa "Finalizar o abandonar" y confirma tu decisión.');
        } else if (!busyRef.current) {
          onClose();
        }
      }
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handle, true);
    return () => document.removeEventListener('keydown', handle, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !attempt || attempt.state !== 'pending') return;
    const tick = () => {
      const now = clock.current.server + performance.now() - clock.current.client;
      const total = Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - now) / 1000));
      setTotalRemaining(total);
      const left = attempt.questionExpiresAt
        ? Math.max(0, Math.ceil((Date.parse(attempt.questionExpiresAt) - now) / 1000))
        : 0;
      setRemaining(left);
      setPauseRemaining(
        attempt.pauseEndsAt ? Math.max(0, Math.ceil((Date.parse(attempt.pauseEndsAt) - now) / 1000)) : 0
      );
      if (total === 0) {
        current.current = { ...attempt, state: 'failed' };
        setAttempt(current.current);
        setQuestion(null);
        remember(null);
        setNotice('El tiempo total del intento finalizó. Puedes volver a intentarlo con preguntas nuevas.');
        return;
      }
      if (question && !feedback && left === 0 && !busyRef.current && timeoutSent.current !== question.id) {
        timeoutSent.current = question.id;
        void submitRef.current(true);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [isOpen, attempt, question, feedback]);

  async function start() {
    if (busyRef.current || !subjectId) return;
    working(true, 'preparing');
    setError('');
    setNotice('');
    try {
      await enterFullscreen();
      const value = await verificationService.startAssessment(subjectId, timeMode);
      receive(value);
      remember(value.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No pudimos preparar tu evaluación en este momento. Puedes reintentar o solicitar revisión docente.'
      );
      await exitFullscreen();
    } finally {
      working(false);
    }
  }

  async function submit(timedOut = false) {
    const value = current.current;
    if (!value || !question || busyRef.current || (!timedOut && !answer.trim())) return;
    working(true, 'saving');
    setError('');
    try {
      await flushEvents();
      if (current.current?.state !== 'pending') return;
      const next = await verificationService.answerAssessment(value.id, question.id, timedOut ? '' : answer, timedOut);
      setFeedback(next);
      setQuestion(null);
      setAnswer('');
      if (next.serverNow) clockSync(next.serverNow);
      current.current = {
        ...value,
        answered: next.answered,
        pendingQuestions: Math.max(0, next.totalQuestions - next.answered),
        progressPercent: Math.round((next.answered / next.totalQuestions) * 100),
        question: null,
        questionExpiresAt: null,
        needsNext: !next.finished,
        state: next.finished ? (next.passed ? 'passed' : 'failed') : 'pending',
        score: next.score,
        integrityCount: current.current.integrityCount,
        pauseEndsAt: next.pauseEndsAt || null,
        pauseSeconds: next.pauseSeconds || 0,
        terminationReason: next.terminationReason,
      };
      setNotice('');
      setAttempt(current.current);
      if (next.finished && !next.passed) {
        remember(null);
        await exitFullscreen();
      }
    } catch (cause) {
      timeoutSent.current = '';
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar tu respuesta. Reintenta.');
    } finally {
      working(false);
    }
  }
  submitRef.current = submit;

  async function nextQuestion() {
    const value = current.current;
    if (!value || busyRef.current || pauseRemaining > 0) return;
    working(true, 'next');
    setError('');
    setNotice('');
    try {
      await enterFullscreen();
      await flushEvents();
      if (current.current?.state !== 'pending') return;
      const next = await verificationService.nextAssessmentQuestion(value.id);
      receive({
        ...current.current,
        answered: next.answered,
        question: next.question,
        questionExpiresAt: next.questionExpiresAt,
        serverNow: next.serverNow,
        needsNext: false,
      });
      setAnswer('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos abrir la siguiente pregunta.');
    } finally {
      working(false);
    }
  }

  async function certify() {
    const value = current.current;
    if (!value || busyRef.current) return;
    working(true, 'certifying');
    setError('');
    try {
      await flushEvents();
      if (current.current?.state !== 'passed') return;
      const grant = await verificationService.botGrant({ attempt_id: value.id });
      remember(null);
      current.current = null;
      await exitFullscreen();
      onSuccess(grant.subject_id, value.subjectName, grant.level);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No pudimos confirmar la acreditación ahora. Tu aprobación sigue guardada y puedes reintentar.'
      );
    } finally {
      working(false);
    }
  }

  async function close(abandon = false) {
    if (current.current?.state === 'pending' && !abandon) {
      setConfirmExit(true);
      return;
    }
    if (abandon && current.current) {
      working(true, 'saving');
      try {
        pendingEvents.current.push({ id: crypto.randomUUID(), type: 'abandon' });
        await flushEvents();
      } catch {
        setError('No pudimos confirmar el abandono. Reintenta.');
        working(false);
        return;
      }
      working(false);
    }
    remember(null);
    current.current = null;
    await exitFullscreen();
    onClose();
  }

  function reset() {
    remember(null);
    current.current = null;
    setAttempt(null);
    setQuestion(null);
    setFeedback(null);
    setAnswer('');
    setError('');
    setNotice('');
    setConfirmExit(false);
    void exitFullscreen();
  }

  if (!isOpen) return null;

  const selected = choices.find((s) => s.id === subjectId);
  const pending = attempt?.state === 'pending';
  const paused = pending && (!!feedback || attempt.needsNext);
  const shielded = pending && (!fullscreen || privacyHidden || captureCover);
  const answeredCount = attempt?.answered ?? 0;
  const totalCount = attempt?.totalQuestions ?? 10;
  const pendingCount = Math.max(0, totalCount - answeredCount);
  const progress = attempt && totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const currentQuestionIndex = paused ? answeredCount : Math.min(answeredCount + 1, totalCount);
  const isUrgent = Boolean(pending && !paused && !hideTimer && remaining > 0 && remaining <= 7);

  return createPortal(
    <div
      ref={overlay}
      className="ia-assessment-overlay"
      data-calm={calmView || isCalmMode}
      data-large-text={largeText}
      onCopy={(e) => {
        if (pending) {
          e.preventDefault();
          report('copy_attempt');
        }
      }}
      onCut={(e) => {
        if (pending) {
          e.preventDefault();
          report('copy_attempt');
        }
      }}
      onPaste={(e) => {
        if (pending) {
          e.preventDefault();
          report('paste_attempt');
        }
      }}
      onDragStart={(e) => {
        if (pending) e.preventDefault();
      }}
      onContextMenu={(e) => {
        if (pending) e.preventDefault();
      }}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-title"
        aria-busy={!!loading}
        className="ia-assessment-dialog"
      >
        {/* A. Barra superior limpia y compacta */}
        <header className="ia-assess-topbar">
          <div className="ia-assess-topbar-brand">
            <img src={interaulaLogo} alt="InterAula" className="ia-assess-logo" />
            <div className="ia-assess-topbar-titles">
              <div className="ia-assess-topbar-kicker">
                <span>Evaluación de Acreditación</span>
                {attempt?.subjectArea && <span>· {attempt.subjectArea}</span>}
              </div>
              <h2 id="assessment-title">{attempt?.subjectName ? subjectDisplayName(attempt.subjectName) : 'Preparar evaluación de tutor'}</h2>
            </div>
          </div>

          <div className="ia-assess-topbar-meta">
            {attempt && (
              <span className="ia-assess-progress-chip">
                {answeredCount}/{totalCount} · {progress}%
              </span>
            )}
            {pending && !paused && (
              <output
                role="timer"
                aria-live="off"
                aria-label={hideTimer ? 'Tiempo oculto' : 'Tiempo restante para esta pregunta'}
                className="ia-assess-timer-pill"
                data-urgent={isUrgent}
              >
                <ClockIcon size={16} />
                <span>{hideTimer ? 'Oculto' : formatTime(remaining)}</span>
              </output>
            )}
            <button
              type="button"
              onClick={() => void close()}
              disabled={busy}
              className="ia-assess-close-btn"
              aria-label="Cerrar evaluación"
            >
              <XIcon size={18} />
            </button>
          </div>
        </header>

        <div className="ia-assess-body">
          {error && (
            <div role="alert" className="ia-assess-alert ia-assess-alert--error">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <AlertCircleIcon size={18} />
                <span>{error}</span>
              </div>
              {attempt ? (
                <button
                  type="button"
                  className="ia-btn-secondary"
                  disabled={busy}
                  onClick={async () => {
                    working(true, 'recovering');
                    try {
                      await flushEvents();
                      receive(await verificationService.getAssessment(attempt.id));
                      setError('');
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : 'No pudimos recuperar el intento.');
                    } finally {
                      working(false);
                    }
                  }}
                >
                  Recuperar estado
                </button>
              ) : (
                <button
                  type="button"
                  className="ia-btn-secondary"
                  disabled={busy || !subjectId}
                  onClick={() => void start()}
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {notice && (
            <div role="status" className="ia-assess-alert ia-assess-alert--info">
              <span>{notice}</span>
            </div>
          )}

          {confirmExit && (
            <div role="alertdialog" aria-label="Confirmar finalización o abandono" className="ia-assess-confirm-box">
              <h3>¿Seguro que deseas salir de la evaluación?</h3>
              <p>
                Si sales antes de terminar todas las preguntas, este intento se cancelará sin otorgar la acreditación y
                deberás iniciar una evaluación nueva.
              </p>
              <div className="ia-assess-confirm-stats">
                <span>Respondidas: {answeredCount}</span>
                <span>Pendientes: {pendingCount}</span>
                <span>Incidencias: {attempt?.integrityCount ?? 0} / {attempt?.integrityLimit ?? 3}</span>
              </div>
              <div className="ia-assess-confirm-actions">
                <button type="button" className="ia-btn-primary" onClick={() => setConfirmExit(false)}>
                  Seguir evaluando
                </button>
                <button type="button" className="ia-btn-secondary" disabled={busy} onClick={() => void close(true)}>
                  Confirmar abandono
                </button>
              </div>
            </div>
          )}

          {/* Contenido principal según etapa */}
          {loading ? (
            <AssessmentLoading
              title={LOADING_TITLES[loading]}
              detail={
                loading === 'preparing'
                  ? `Construyendo una evaluación específica para ${selected?.name || 'la asignatura seleccionada'}.`
                  : undefined
              }
            />
          ) : !attempt ? (
            /* Pantalla previa a la prueba */
            <section className="ia-assess-setup-grid">
              <div className="ia-assess-panel">
                <div>
                  <h3>Configura tu evaluación</h3>
                  <p className="ia-assess-lead">
                    Selecciona cualquier asignatura del catálogo disponible y define el ritmo de lectura que prefieras.
                  </p>
                </div>

                <AssessmentSubjectPicker choices={choices} value={subjectId} onChange={setSubjectId} disabled={busy} />

                <div className="ia-assess-time-grid" aria-label="Tiempo asignado por pregunta">
                  <div className="ia-assess-time-box">
                    <strong>Selección múltiple</strong>
                    <span>{timeMode === 'extended' ? '40 segundos' : '20 segundos'}</span>
                  </div>
                  <div className="ia-assess-time-box">
                    <strong>Desarrollo breve</strong>
                    <span>{timeMode === 'extended' ? '80 segundos' : '40 segundos'}</span>
                  </div>
                </div>

                <div>
                  <label className="ia-label" htmlFor="assessment-time">
                    Ritmo y pausas entre preguntas
                  </label>
                  <select
                    id="assessment-time"
                    className="ia-input"
                    value={timeMode}
                    onChange={(e) => setTimeMode(e.target.value as 'standard' | 'extended')}
                    disabled={busy}
                  >
                    <option value="standard">Estándar · pausas de 5 segundos</option>
                    <option value="extended">Tiempo extendido · pausas de 10 segundos</option>
                  </select>
                </div>

                <div className="ia-assess-support-toggles">
                  <label>
                    <input type="checkbox" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} />
                    <span>Tipografía ampliada</span>
                  </label>
                  <label>
                    <input type="checkbox" checked={hideTimer} onChange={(e) => setHideTimer(e.target.checked)} />
                    <span>Ocultar cuenta regresiva</span>
                  </label>
                  <label>
                    <input type="checkbox" checked={calmView} onChange={(e) => setCalmView(e.target.checked)} />
                    <span>Sin animaciones</span>
                  </label>
                </div>

                {status && (!status.serverConfigured || status.schemaReady === false) && (
                  <p role="alert" className="ia-assess-alert ia-assess-alert--error">
                    La evaluación automática no está habilitada aún en el servidor. Puedes solicitar revisión docente.
                  </p>
                )}

                <button
                  type="button"
                  className="ia-btn-primary ia-assess-start-cta"
                  onClick={() => void start()}
                  disabled={
                    !subjectId ||
                    selected?.verified ||
                    busy ||
                    !status?.serverConfigured ||
                    status.schemaReady === false
                  }
                >
                  Comenzar en pantalla completa
                </button>
              </div>

              <aside className="ia-assess-panel" aria-label="Condiciones de la evaluación">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheckIcon size={22} color="var(--ia-primary, #2563eb)" />
                  <h3>Condiciones de acreditación</h3>
                </div>
                <ul className="ia-assess-rules-list">
                  <li>
                    <strong>Pantalla completa obligatoria:</strong> al iniciar, el navegador entra en modo pantalla
                    completa. Salir o cambiar de pestaña registra una incidencia; al llegar a 3 incidencias, el intento
                    se cancela automáticamente.
                  </li>
                  <li>
                    <strong>Corrección en servidor:</strong> todas las preguntas y respuestas se corrigen de forma segura
                    en el servidor. El primer error o tiempo agotado finaliza el intento actual.
                  </li>
                  <li>
                    <strong>Preguntas dinámicas por asignatura:</strong> cada intento prepara preguntas nuevas acordes a
                    la materia elegida, evitando repetir ejercicios recientes.
                  </li>
                  <li>
                    <strong>Copiar y pegar deshabilitados:</strong> durante el examen no se permite copiar ni pegar
                    contenido.
                  </li>
                  <li>
                    <strong>Transparencia:</strong> al iniciar se registra tu oferta en esta materia y se acredita solo
                    al aprobar la evaluación completa.
                  </li>
                </ul>
              </aside>
            </section>
          ) : (
            /* Sesión de evaluación activa / pausa / resultado */
            <>
              {/* D. Barra de progreso moderna + Panel de estado de preguntas */}
              <section className="ia-assess-progress-card" aria-label="Progreso de la evaluación">
                <div className="ia-assess-progress-top">
                  <span className="ia-assess-progress-label">
                    Pregunta {currentQuestionIndex} de {totalCount}
                  </span>
                  <div className="ia-assess-progress-counters">
                    <span>
                      Progreso: <strong>{progress}%</strong>
                    </span>
                    <span>
                      Respondidas: <strong>{answeredCount}</strong>
                    </span>
                    <span>
                      Pendientes: <strong>{pendingCount}</strong>
                    </span>
                  </div>
                </div>

                <div
                  className="ia-assess-progress-track"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso ${progress}%`}
                >
                  <div className="ia-assess-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="ia-assess-step-strip" aria-label="Estado de cada pregunta">
                  {Array.from({ length: totalCount }, (_, idx) => {
                    const stepStatus =
                      idx < answeredCount
                        ? 'answered'
                        : pending && !paused && idx === answeredCount
                          ? 'current'
                          : 'pending';
                    return (
                      <span
                        key={idx}
                        className="ia-assess-step-dot"
                        data-status={stepStatus}
                        title={
                          stepStatus === 'answered'
                            ? `Pregunta ${idx + 1}: Respondida`
                            : stepStatus === 'current'
                              ? `Pregunta ${idx + 1}: Actual`
                              : `Pregunta ${idx + 1}: Pendiente`
                        }
                      >
                        {idx + 1}
                      </span>
                    );
                  })}
                </div>
              </section>

              {/* Protección ante salida de pantalla completa */}
              {shielded ? (
                <section className="ia-assess-stage-card" role="status">
                  <span className="ia-assess-stage-icon ia-assess-stage-icon--danger" aria-hidden="true">
                    <ShieldCheckIcon size={30} />
                  </span>
                  <h3>Evaluación protegida</h3>
                  <p>
                    {captureCover
                      ? 'El contenido se ocultó temporalmente por seguridad.'
                      : 'Saliste del modo pantalla completa o cambiaste de ventana. Regresa para continuar antes de agotar el tiempo o el límite de incidencias.'}
                  </p>
                  {!fullscreen && (
                    <button
                      type="button"
                      className="ia-btn-primary ia-assess-submit-btn"
                      onClick={() => void enterFullscreen().catch((cause) => setError(cause.message))}
                    >
                      Volver a pantalla completa
                    </button>
                  )}
                </section>
              ) : (
                <>
                  {/* B & C. Área principal de pregunta y alternativas grandes */}
                  {pending && question && !feedback && (
                    <form
                      className="ia-assess-question-card ia-assessment-sensitive"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                      }}
                    >
                      <div className="ia-assess-question-meta">
                        <div className="ia-assess-question-badges">
                          <span className="ia-assess-pill">
                            {question.type === 'choice' ? 'Selección única' : 'Desarrollo breve'}
                          </span>
                          {question.topic && <span className="ia-assess-pill">{question.topic}</span>}
                        </div>
                        <ReadAloudControls
                          text={[question.prompt, ...(question.options || []).map((o) => o.text)].join('. ')}
                          compact
                          label="Escuchar pregunta"
                        />
                      </div>

                      <h3 id="assessment-question-title" tabIndex={-1} className="ia-assess-question-title">
                        {question.prompt}
                      </h3>

                      {question.codeSnippet && <pre className="ia-assess-code">{question.codeSnippet}</pre>}

                      {question.type === 'choice' ? (
                        <fieldset className="ia-assess-options" disabled={busy || !fullscreen || confirmExit}>
                          <legend className="ia-assessment-sr-only">Selecciona una alternativa</legend>
                          {question.options?.map((o, index) => {
                            const isSelected = answer === o.id;
                            return (
                              <label
                                key={o.id}
                                className="ia-assess-option-card"
                                data-selected={isSelected}
                              >
                                <input
                                  type="radio"
                                  name="assessment-answer"
                                  value={o.id}
                                  checked={isSelected}
                                  onChange={() => setAnswer(o.id)}
                                />
                                <span className="ia-assess-option-letter" aria-hidden="true">
                                  {String.fromCharCode(65 + index)}
                                </span>
                                <span className="ia-assess-option-text">{o.text}</span>
                                {isSelected && <CheckIcon size={18} color="var(--ia-primary, #2563eb)" />}
                              </label>
                            );
                          })}
                        </fieldset>
                      ) : (
                        <div>
                          <label className="ia-label" htmlFor="assessment-answer">
                            Tu respuesta breve
                          </label>
                          <textarea
                            id="assessment-answer"
                            className="ia-assess-textarea"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            maxLength={1500}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={question.placeholder || 'Escribe un concepto o resultado corto'}
                            disabled={busy || !fullscreen || confirmExit}
                          />
                        </div>
                      )}

                      {/* E. Navegación inferior */}
                      <div className="ia-assess-footer-bar">
                        <div className="ia-assess-footer-left">
                          <button
                            type="button"
                            className="ia-btn-secondary"
                            disabled={busy}
                            onClick={() => setConfirmExit(true)}
                          >
                            Finalizar o abandonar
                          </button>
                        </div>

                        <button
                          type="submit"
                          className="ia-btn-primary ia-assess-submit-btn"
                          disabled={busy || !answer.trim() || !fullscreen || confirmExit}
                        >
                          {answeredCount + 1 === totalCount ? 'Enviar y finalizar evaluación' : 'Confirmar respuesta'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Pausa controlada entre preguntas */}
                  {paused && (
                    <section className="ia-assess-stage-card">
                      <span className="ia-assess-stage-icon ia-assess-stage-icon--success" aria-hidden="true">
                        <CheckIcon size={30} />
                      </span>
                      <span className="ia-assess-pill">
                        {feedback?.correct ? 'Respuesta correcta' : feedback ? 'Respuesta guardada' : 'Intento recuperado'}
                      </span>
                      <h3>Breve pausa antes de continuar</h3>
                      <p>{PAUSE_TIPS[(answeredCount - 1 + PAUSE_TIPS.length) % PAUSE_TIPS.length]}</p>

                      {feedback && (
                        <details className="ia-assess-explanation-box">
                          <summary>Ver justificación de la respuesta</summary>
                          <p>{feedback.feedback}</p>
                        </details>
                      )}

                      <span className="ia-assess-break-countdown" aria-live="polite">
                        {pauseRemaining > 0 ? `${pauseRemaining}s` : 'Listo'}
                      </span>

                      <div className="ia-assess-confirm-actions">
                        <button
                          type="button"
                          className="ia-btn-secondary"
                          disabled={busy}
                          onClick={() => setConfirmExit(true)}
                        >
                          Abandonar
                        </button>
                        <button
                          type="button"
                          className="ia-btn-primary ia-assess-submit-btn"
                          onClick={() => void nextQuestion()}
                          disabled={busy || confirmExit || pauseRemaining > 0}
                        >
                          {pauseRemaining > 0 ? 'Pausa en curso' : 'Siguiente pregunta'}
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* Pantalla de aprobación */}
              {(attempt.state === 'passed' || attempt.state === 'granted') && (
                <section className="ia-assess-stage-card">
                  <span className="ia-assess-stage-icon ia-assess-stage-icon--success" aria-hidden="true">
                    <CheckIcon size={32} />
                  </span>
                  <h3>Evaluación aprobada</h3>
                  <strong className="ia-assess-score-big">{attempt.score}%</strong>
                  <p>
                    Completaste correctamente las {totalCount} preguntas de <strong>{subjectDisplayName(attempt.subjectName)}</strong>.
                    Confirma ahora para activar tu insignia de tutor acreditado en nivel básico.
                  </p>
                  <button
                    type="button"
                    className="ia-btn-primary ia-assess-submit-btn"
                    onClick={() => void certify()}
                    disabled={busy}
                  >
                    Confirmar acreditación básica
                  </button>
                </section>
              )}

              {/* Pantalla de intento terminado / cancelado */}
              {attempt.state === 'failed' && (
                <section className="ia-assess-stage-card">
                  <span className="ia-assess-stage-icon ia-assess-stage-icon--danger" aria-hidden="true">
                    <AlertCircleIcon size={32} />
                  </span>
                  <h3>
                    {attempt.integrityCount >= attempt.integrityLimit
                      ? 'Evaluación cancelada por incidencias'
                      : 'Este intento ha finalizado'}
                  </h3>
                  <p>
                    {attempt.integrityCount >= attempt.integrityLimit
                      ? 'Se superó el límite permitido de salidas de pantalla completa o cambios de ventana.'
                      : attempt.terminationReason === 'time_expired'
                        ? 'Se agotó el tiempo asignado para responder la pregunta.'
                        : attempt.terminationReason === 'incorrect_answer'
                          ? 'La respuesta enviada no fue correcta. Puedes repasar y realizar un nuevo intento con preguntas nuevas.'
                          : 'Este intento se cerró sin acreditación. Puedes volver a intentarlo o solicitar revisión docente.'}
                  </p>
                  <div className="ia-assess-confirm-stats">
                    <span>Respondidas: {answeredCount} / {totalCount}</span>
                    <span>Incidencias: {attempt.integrityCount} / {attempt.integrityLimit}</span>
                  </div>
                  <div className="ia-assess-confirm-actions">
                    <button type="button" className="ia-btn-primary" onClick={reset} disabled={busy}>
                      Elegir asignatura nuevamente
                    </button>
                    <button type="button" className="ia-btn-secondary" onClick={() => void close(false)} disabled={busy}>
                      Cerrar
                    </button>
                  </div>
                </section>
              )}

              {/* Barra inferior discreta de apoyos y estado de integridad */}
              {pending && (
                <footer className="ia-assess-supports-bar">
                  <div className="ia-assess-support-toggles">
                    <label>
                      <input type="checkbox" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} />
                      <span>Texto ampliado</span>
                    </label>
                    <label>
                      <input type="checkbox" checked={hideTimer} onChange={(e) => setHideTimer(e.target.checked)} />
                      <span>Ocultar reloj</span>
                    </label>
                    <label>
                      <input type="checkbox" checked={calmView} onChange={(e) => setCalmView(e.target.checked)} />
                      <span>Sin animaciones</span>
                    </label>
                  </div>
                  <span>
                    Incidencias: <strong>{attempt.integrityCount}/{attempt.integrityLimit}</strong> · Total restante:{' '}
                    <strong>{formatTime(totalRemaining)}</strong>
                  </span>
                </footer>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
