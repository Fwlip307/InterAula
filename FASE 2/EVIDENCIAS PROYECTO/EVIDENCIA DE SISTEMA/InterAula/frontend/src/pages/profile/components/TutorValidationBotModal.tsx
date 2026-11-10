import { useEffect, useRef, useState } from 'react';
import { verificationService, type ServerAssessment, type ServerAssessmentAnswer, type AssessmentQuestion } from '../../../services/verification.service';
import type { AcademicLevel } from '../../../types/profile';
import { XIcon, ShieldCheckIcon } from '../../../components/common/Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subjectId: string, subjectName: string, level?: AcademicLevel) => void;
  availableSubjects: { id: string; name: string }[];
  defaultSubjectId?: string;
  userInstitution?: string;
  userCareer?: string;
}

export default function TutorValidationBotModal({ isOpen, onClose, onSuccess, availableSubjects, defaultSubjectId }: Props) {
  const initialSubjectId = defaultSubjectId || availableSubjects[0]?.id || '';
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [attempt, setAttempt] = useState<ServerAssessment | null>(null);
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [feedback, setFeedback] = useState<ServerAssessmentAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    setAttempt(null); setQuestionNumber(1); setQuestion(null); setAnswer(''); setFeedback(null); setError('');
    setSubjectId(initialSubjectId);
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, [isOpen, initialSubjectId]);
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, textarea, [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); };
  }, [isOpen, busy, onClose]);
  if (!isOpen) return null;
  async function start() {
    setBusy(true); setError('');
    try { const next = await verificationService.startAssessment(subjectId); setAttempt(next); setQuestion(next.question); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo preparar la evaluación.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!attempt || !question || !answer.trim()) return;
    setBusy(true); setError('');
    try { setFeedback(await verificationService.answerAssessment(attempt.id, question.id, answer)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar la respuesta. Puedes reintentar.'); }
    finally { setBusy(false); }
  }
  async function certify() {
    if (!attempt) return;
    setBusy(true); setError('');
    try {
      const grant = await verificationService.botGrant({ attempt_id: attempt.id });
      onSuccess(grant.subject_id, attempt.subjectName, grant.level); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo confirmar la acreditación.'); }
    finally { setBusy(false); }
  }
  return <div className="ia-assessment-overlay">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="assessment-title" className="ia-assessment-dialog">
      <div className="ia-assessment-heading">
        <h2 id="assessment-title"><ShieldCheckIcon size={22} /> Evaluación para tutoría</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar evaluación" className="ia-btn-secondary"><XIcon size={18} /></button>
      </div>
      <p>La evaluación automática acredita el nivel básico con al menos 70% de aciertos. Para otras asignaturas o niveles, solicita revisión docente.</p>
      {error && <p role="alert" className="ia-assessment-error">{error}</p>}
      {!attempt ? <>
        <label htmlFor="assessment-subject">Asignatura ofrecida</label>
        <select id="assessment-subject" className="ia-input" value={subjectId} onChange={event => setSubjectId(event.target.value)} disabled={busy}>
          <option value="">Selecciona una asignatura</option>
          {availableSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <p>Dispones de hasta dos horas por intento, sin cronómetros por pregunta. Puedes usar tus herramientas de accesibilidad.</p>
        <button type="button" className="ia-btn-primary" onClick={start} disabled={!subjectId || busy}>{busy ? 'Preparando evaluación…' : 'Comenzar evaluación'}</button>
      </> : <>
        <p>{attempt.subjectName} · Pregunta {questionNumber} de {attempt.totalQuestions}</p>
        {!feedback && question && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
          <h3>{question.prompt}</h3>
          {question.codeSnippet && <pre>{question.codeSnippet}</pre>}
          {question.type === 'choice' ? <fieldset disabled={busy}>
            <legend>Selecciona una respuesta</legend>
            {question.options?.map(option => <label className="ia-assessment-option" key={option.id}>
              <input type="radio" name="assessment-answer" value={option.id} checked={answer === option.id} onChange={() => setAnswer(option.id)} />{option.text}
            </label>)}
          </fieldset> : <>
            <label htmlFor="assessment-answer">Respuesta breve</label>
            <input id="assessment-answer" className="ia-input" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={1500} placeholder={question.placeholder} disabled={busy} autoComplete="off" />
          </>}
          <button type="submit" className="ia-btn-primary" disabled={busy || !answer.trim()}>{busy ? 'Guardando respuesta…' : 'Enviar respuesta'}</button>
        </form>}
        {feedback && <div aria-live="polite">
          <p><strong>{feedback.correct ? 'Respuesta correcta.' : 'Respuesta para repasar.'}</strong> {feedback.feedback}</p>
          {feedback.finished ? <>
            <p>Resultado: {feedback.score}%. {feedback.passed ? 'Evaluación aprobada.' : 'Puedes repasar y volver a intentarlo.'}</p>
            {feedback.passed && <button type="button" className="ia-btn-primary" onClick={certify} disabled={busy}>{busy ? 'Confirmando acreditación…' : 'Confirmar acreditación básica'}</button>}
          </> : <button type="button" className="ia-btn-primary" onClick={() => { setQuestion(feedback.nextQuestion); setQuestionNumber(feedback.answered + 1); setAnswer(''); setFeedback(null); }}>Siguiente pregunta</button>}
        </div>}
      </>}
    </div>
  </div>;
}
