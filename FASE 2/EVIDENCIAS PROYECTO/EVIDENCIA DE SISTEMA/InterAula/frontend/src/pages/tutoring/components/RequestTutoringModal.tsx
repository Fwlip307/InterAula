import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import type { AvailableTutor } from '../../../services/tutoring.service';
import type { SessionModality } from '../../../types/tutoring';
import { tutoringService } from '../../../services/tutoring.service';
import { profileService } from '../../../services/profile.service';
import { formatAcademicLevel, getUserDisplayName } from '../../../utils/formatters';
import {
  XIcon,
  VideoIcon,
  MapPinIcon,
  AlertCircleIcon,
} from '../../../components/common/Icons';

interface RequestTutoringModalProps {
  tutor: AvailableTutor | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const COMFORT_OPTIONS = [
  { id: 'camera_optional', label: 'Sin cámara ni micrófono obligatorio', desc: 'Interactuar por chat escrito y pizarra' },
  { id: 'processing_pause', label: 'Pausas de asimilación', desc: 'Tiempo tranquilo para procesar y responder' },
  { id: 'step_by_step_visual', label: 'Explicación paso a paso', desc: 'Apoyo visual estructurado y ejemplos prácticos' },
  { id: 'written_summary', label: 'Resumen o apuntes clave', desc: 'Síntesis escrita al terminar la sesión' },
];

export const HELP_TYPE_OPTIONS = [
  { id: 'explicacion_base', label: 'Explicación de conceptos desde cero' },
  { id: 'resolucion_guia', label: 'Resolución práctica de ejercicios o guía' },
  { id: 'preparacion_evaluacion', label: 'Preparación para certamen o evaluación' },
  { id: 'revision_avance', label: 'Revisión de dudas puntuales o avance de proyecto' },
] as const;

export const COMMUNICATION_PREF_OPTIONS = [
  { id: 'mensajes_y_pizarra', label: 'Mensajes escritos y pizarra colaborativa (sin voz)' },
  { id: 'voz_y_pizarra', label: 'Voz y pizarra compartida (sin cámara)' },
  { id: 'videollamada', label: 'Videollamada completa (voz y cámara opcional)' },
  { id: 'presencial', label: 'Encuentro presencial en sede o biblioteca' },
] as const;

export default function RequestTutoringModal({
  tutor,
  isOpen,
  onClose,
  onSuccess,
}: RequestTutoringModalProps) {
  const { user } = useAuth();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [topicFocus, setTopicFocus] = useState('');
  const [helpType, setHelpType] = useState<string>(HELP_TYPE_OPTIONS[0].id);
  const [communicationPref, setCommunicationPref] = useState<string>(COMMUNICATION_PREF_OPTIONS[1].id);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('15:00');
  const [alternativeSchedule, setAlternativeSchedule] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [modality, setModality] = useState<SessionModality>('online');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [notes, setNotes] = useState('');
  const [comfortPreferences, setComfortPreferences] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-cargar preferencias privadas de aprendizaje del estudiante para facilitar la solicitud
  useEffect(() => {
    let active = true;
    if (!isOpen || !user) return;
    profileService
      .getMyProfile()
      .then((prof) => {
        if (!active || !prof?.learning_preferences) return;
        const mapped: string[] = [];
        if (
          prof.learning_preferences.includes('message_communication') ||
          prof.learning_preferences.includes('written_support')
        ) {
          mapped.push('camera_optional');
          setCommunicationPref('mensajes_y_pizarra');
        }
        if (
          prof.learning_preferences.includes('extra_response_time') ||
          prof.learning_preferences.includes('paced_rhythm') ||
          prof.learning_preferences.includes('low_stimulus')
        ) {
          mapped.push('processing_pause');
        }
        if (
          prof.learning_preferences.includes('step_by_step') ||
          prof.learning_preferences.includes('visual_support') ||
          prof.learning_preferences.includes('practical_examples')
        ) {
          mapped.push('step_by_step_visual');
        }
        if (prof.learning_preferences.includes('summarized_material')) {
          mapped.push('written_summary');
        }
        if (mapped.length > 0) {
          setComfortPreferences((prev) => (prev.length === 0 ? Array.from(new Set(mapped)) : prev));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, user]);

  if (!isOpen || !tutor) return null;

  const isSelf = Boolean(
    user &&
      (user.id === tutor.profile.id ||
        (user.email &&
          tutor.profile.email &&
          user.email.toLowerCase() === tutor.profile.email.toLowerCase()))
  );

  const tutorName = getUserDisplayName(tutor.profile);
  const minDate = new Date().toISOString().split('T')[0];
  const activeSubjectId = selectedSubjectId || tutor.offeredSubjects[0]?.subject_id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isSelf) {
      setErrorMessage('No puedes solicitar una sesión de tutoría a ti mismo.');
      return;
    }

    if (!activeSubjectId) {
      setErrorMessage('Por favor selecciona la asignatura que necesitas reforzar.');
      return;
    }

    if (!date || !time) {
      setErrorMessage('Por favor indica la fecha y hora propuesta para la sesión.');
      return;
    }

    const scheduledDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      setErrorMessage('Fecha u hora no válida.');
      return;
    }

    if (scheduledDateTime.getTime() <= Date.now()) {
      setErrorMessage('La fecha y hora de la sesión debe ser futura.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedComfortLabels = COMFORT_OPTIONS.filter((c) =>
        comfortPreferences.includes(c.id)
      ).map((c) => c.label);

      const helpTypeLabel =
        HELP_TYPE_OPTIONS.find((h) => h.id === helpType)?.label || helpType;
      const commPrefLabel =
        COMMUNICATION_PREF_OPTIONS.find((c) => c.id === communicationPref)?.label ||
        communicationPref;

      const structuredBlocks: string[] = [];
      if (topicFocus.trim()) {
        structuredBlocks.push(`Contenido a reforzar: ${topicFocus.trim()}`);
      }
      structuredBlocks.push(`Tipo de ayuda: ${helpTypeLabel}`);
      structuredBlocks.push(`Preferencia de comunicación: ${commPrefLabel}`);
      if (alternativeSchedule.trim()) {
        structuredBlocks.push(`Horarios alternativos: ${alternativeSchedule.trim()}`);
      }
      if (selectedComfortLabels.length > 0) {
        structuredBlocks.push(`[Pautas de Confort: ${selectedComfortLabels.join(', ')}]`);
      }
      if (notes.trim()) {
        structuredBlocks.push(`Detalle / dificultad actual: ${notes.trim()}`);
      }

      const combinedNotes = structuredBlocks.join('\n');

      await tutoringService.requestTutoring({
        tutor_id: tutor.profile.id,
        subject_id: activeSubjectId,
        scheduled_at: scheduledDateTime.toISOString(),
        duration_minutes: durationMinutes,
        modality,
        location_or_link: locationOrLink.trim() || undefined,
        notes: combinedNotes || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[RequestTutoringModal] Error al solicitar tutoría:', err);
      setErrorMessage(err.message || 'No fue posible enviar la solicitud de tutoría.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
        overflowY: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-tutoring-title"
    >
      <div
        style={{
          background: 'var(--ia-bg-card, #ffffff)',
          borderRadius: '16px',
          maxWidth: '580px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div>
            <h2 id="request-tutoring-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Solicitar Apoyo Académico entre Pares
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Compañero tutor: <strong>{tutorName}</strong> · Adapta la sesión a tu forma de aprender
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar ventana de solicitud"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
          {isSelf && (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircleIcon size={18} color="#2563eb" />
              <span>Este es tu perfil de tutor. No es posible solicitarte tutorías a ti mismo.</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircleIcon size={18} color="#b91c1c" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Selector de Materia */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="req-subject" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              1. Asignatura que necesitas reforzar *
            </label>
            <select
              id="req-subject"
              className="ia-input"
              value={activeSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              {tutor.offeredSubjects.map((item) => (
                <option key={item.subject_id} value={item.subject_id}>
                  {item.subject?.name} — Nivel {formatAcademicLevel(item.level)}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Contenido específico y Tipo de ayuda */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="req-topic" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Contenido o unidad específica
              </label>
              <input
                id="req-topic"
                type="text"
                className="ia-input"
                value={topicFocus}
                onChange={(e) => setTopicFocus(e.target.value)}
                placeholder="Ej: Consultas JOIN, punteros, derivadas..."
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="req-help-type" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                ¿Qué tipo de ayuda necesitas?
              </label>
              <select
                id="req-help-type"
                className="ia-input"
                value={helpType}
                onChange={(e) => setHelpType(e.target.value)}
                style={{ width: '100%' }}
              >
                {HELP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Modalidad y Preferencia de Comunicación Inclusiva */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              2. Modalidad y forma de interacción *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setModality('online')}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: `2px solid ${modality === 'online' ? '#2563eb' : '#e2e8f0'}`,
                  background: modality === 'online' ? '#eff6ff' : '#ffffff',
                  color: modality === 'online' ? '#1d4ed8' : '#475569',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <VideoIcon size={18} color={modality === 'online' ? '#1d4ed8' : '#64748b'} />
                Virtual (Aula Integrada)
              </button>

              <button
                type="button"
                onClick={() => {
                  setModality('in_person');
                  setCommunicationPref('presencial');
                }}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: `2px solid ${modality === 'in_person' ? '#2563eb' : '#e2e8f0'}`,
                  background: modality === 'in_person' ? '#eff6ff' : '#ffffff',
                  color: modality === 'in_person' ? '#1d4ed8' : '#475569',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <MapPinIcon size={18} color={modality === 'in_person' ? '#1d4ed8' : '#64748b'} />
                Presencial en Sede
              </button>
            </div>

            <label htmlFor="req-comm-pref" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Preferencia de comunicación (no es obligatorio usar cámara ni comunicación oral):
            </label>
            <select
              id="req-comm-pref"
              className="ia-input"
              value={communicationPref}
              onChange={(e) => setCommunicationPref(e.target.value)}
              style={{ width: '100%' }}
            >
              {COMMUNICATION_PREF_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Lugar o Link */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="req-location" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              {modality === 'online' ? 'Enlace externo opcional (por defecto Aula Virtual InterAula)' : 'Lugar o espacio tranquilo de encuentro sugerido'}
            </label>
            <input
              id="req-location"
              type="text"
              className="ia-input"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder={
                modality === 'online'
                  ? 'Dejar vacío para usar la sala integrada con chat y pizarra de InterAula'
                  : 'Ej: Biblioteca Central, Cubículo de Estudio 3'
              }
              style={{ width: '100%' }}
            />
          </div>

          {/* 4. Fecha, Hora y Disponibilidad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label htmlFor="req-date" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Fecha propuesta *
              </label>
              <input
                id="req-date"
                type="date"
                className="ia-input"
                value={date}
                min={minDate}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="req-time" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Hora *
              </label>
              <input
                id="req-time"
                type="time"
                className="ia-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="req-duration" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Duración *
              </label>
              <select
                id="req-duration"
                className="ia-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="req-alt-schedule" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Otros horarios en los que tienes disponibilidad (opcional)
            </label>
            <input
              id="req-alt-schedule"
              type="text"
              className="ia-input"
              value={alternativeSchedule}
              onChange={(e) => setAlternativeSchedule(e.target.value)}
              placeholder="Ej: También puedo miércoles o viernes después de las 17:00 hrs"
              style={{ width: '100%' }}
            />
          </div>

          {/* 5. Pautas de Confort y Aprendizaje (Inclusión DUA) */}
          <div style={{ marginBottom: '18px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Pautas de Confort y Ritmo de Aprendizaje (Opcional y Privado)
            </label>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748b' }}>
              Indica cómo te resulta más cómodo aprender para que tu compañero adapte el ritmo de la sesión:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
              {COMFORT_OPTIONS.map((opt) => {
                const checked = comfortPreferences.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: checked ? '#f0fdf4' : '#ffffff',
                      border: `1px solid ${checked ? '#86efac' : '#e2e8f0'}`,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setComfortPreferences((prev) => [...prev, opt.id]);
                        } else {
                          setComfortPreferences((prev) => prev.filter((id) => id !== opt.id));
                        }
                      }}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: checked ? '#166534' : '#1e293b' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{opt.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 6. Explicación de dificultad o dudas */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="req-notes" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Explica brevemente qué dificultad tienes o qué ejercicio quieres revisar
            </label>
            <textarea
              id="req-notes"
              className="ia-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Me cuesta entender cómo plantear las condiciones de término en ciclos while y quiero resolver juntos 2 ejercicios de la guía..."
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ia-btn-primary"
              disabled={submitting || isSelf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSelf ? 0.6 : 1,
                cursor: isSelf ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Enviando solicitud...' : isSelf ? 'No puedes solicitarte a ti mismo' : 'Enviar Solicitud de Tutoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
