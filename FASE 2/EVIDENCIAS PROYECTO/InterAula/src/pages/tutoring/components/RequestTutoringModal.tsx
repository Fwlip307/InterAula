import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isCertifiedAccount } from '../../../services/profile.service';
import type { AvailableTutor } from '../../../services/tutoring.service';
import type { SessionModality } from '../../../types/tutoring';
import { tutoringService } from '../../../services/tutoring.service';
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
  { id: 'camera_optional', label: 'Cámara opcional', desc: 'Interactuar por voz, chat o pizarra' },
  { id: 'processing_pause', label: 'Pausas de asimilación', desc: 'Tiempo para procesar preguntas' },
  { id: 'step_by_step_visual', label: 'Explicación paso a paso', desc: 'Apoyo visual y ejemplos prácticos' },
  { id: 'written_summary', label: 'Resumen o apuntes clave', desc: 'Síntesis escrita al terminar la sesión' },
];

export default function RequestTutoringModal({
  tutor,
  isOpen,
  onClose,
  onSuccess,
}: RequestTutoringModalProps) {
  const { user } = useAuth();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('15:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [modality, setModality] = useState<SessionModality>('online');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [notes, setNotes] = useState('');
  const [comfortPreferences, setComfortPreferences] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !tutor) return null;

  const isSelf = Boolean(
    user &&
      (user.id === tutor.profile.id ||
        (user.email &&
          tutor.profile.email &&
          user.email.toLowerCase() === tutor.profile.email.toLowerCase()) ||
        (isCertifiedAccount(user.email) &&
          (isCertifiedAccount(tutor.profile.id) ||
            isCertifiedAccount(tutor.profile.email))))
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
      setErrorMessage('Por favor selecciona la materia a solicitar.');
      return;
    }

    if (!date || !time) {
      setErrorMessage('Por favor indica la fecha y hora de la sesión.');
      return;
    }

    // Construir fecha combinando date + time
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
      const selectedLabels = COMFORT_OPTIONS.filter((c) =>
        comfortPreferences.includes(c.id)
      ).map((c) => c.label);

      const comfortHeader =
        selectedLabels.length > 0
          ? `[Pautas de Confort: ${selectedLabels.join(', ')}]`
          : '';

      const combinedNotes = [comfortHeader, notes.trim()].filter(Boolean).join('\n\n');

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
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '540px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Solicitar Tutoría Académica
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Con tutor: <strong>{tutorName}</strong>
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
            aria-label="Cerrar modal"
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

          {/* Selector de Materia */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Materia que necesitas reforzar *
            </label>
            <div style={{ position: 'relative' }}>
              <select
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
          </div>

          {/* Modalidad */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Modalidad de encuentro *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                Online
              </button>

              <button
                type="button"
                onClick={() => setModality('in_person')}
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
                Presencial
              </button>
            </div>
          </div>

          {/* Lugar o Link */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              {modality === 'online' ? 'Plataforma o enlace propuesto (opcional)' : 'Lugar o sala de encuentro sugerida (opcional)'}
            </label>
            {modality === 'online' && (
              <div
                style={{
                  marginBottom: '8px',
                  padding: '10px 12px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.82rem',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <VideoIcon size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Aula Virtual InterAula integrada:</strong> Se creará automáticamente una sala privada con videollamada HD, pizarra colaborativa y control de asistencia auditada. Si prefieres un enlace externo, puedes ingresarlo a continuación.
                </span>
              </div>
            )}
            <input
              type="text"
              className="ia-input"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder={
                modality === 'online'
                  ? 'Opcional (por defecto se usará el Aula Virtual de InterAula)'
                  : 'Ej: Biblioteca Central, Sala de Estudio 3'
              }
              style={{ width: '100%' }}
            />
          </div>

          {/* Fecha y Hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Fecha *
              </label>
              <input
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
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Hora *
              </label>
              <input
                type="time"
                className="ia-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Duración */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Duración estimada *
            </label>
            <select
              className="ia-input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              style={{ width: '100%' }}
            >
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos (1 hora estándar)</option>
              <option value={90}>90 minutos (1 hora y media)</option>
              <option value={120}>120 minutos (2 horas)</option>
            </select>
          </div>

          {/* Pautas de Confort y Aprendizaje (Inclusión DUA) */}
          <div style={{ marginBottom: '18px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              🌱 Pautas de Confort en la Sesión (Opcional)
            </label>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748b' }}>
              Selecciona cómo te sientes más cómodo aprendiendo para que el tutor adapte el ritmo a tus necesidades (sin etiquetas):
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
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

          {/* Notas / Temas */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Temas que necesitas reforzar o notas (opcional)
            </label>
            <textarea
              className="ia-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Preparación para prueba de integrales dobles y dudas con la guía de ejercicios..."
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
              {submitting ? 'Enviando solicitud...' : isSelf ? 'No puedes solicitarte a ti mismo' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
