import React from 'react';
import type { TutoringSession } from '../../../types/tutoring';
import {
  getUserDisplayName,
  getUserInitial,
  formatTutoringStatus,
  formatTutoringDateTime,
  formatTutoringDuration,
  formatTutoringModality,
} from '../../../utils/formatters';
import {
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  MapPinIcon,
  CheckIcon,
  XIcon,
  StarIcon,
  BookOpenIcon,
  MessageSquareIcon,
} from '../../../components/common/Icons';

interface SessionCardProps {
  session: TutoringSession;
  role: 'student' | 'tutor';
  onAccept?: (sessionId: string) => void;
  onReject?: (sessionId: string) => void;
  onCancel?: (sessionId: string) => void;
  onComplete?: (sessionId: string) => void;
  onReview?: (session: TutoringSession) => void;
  actionLoading?: boolean;
}

export default function SessionCard({
  session,
  role,
  onAccept,
  onReject,
  onCancel,
  onComplete,
  onReview,
  actionLoading = false,
}: SessionCardProps) {
  const otherPerson = role === 'student' ? session.tutor : session.student;
  const otherRoleLabel = role === 'student' ? 'Tutor' : 'Estudiante solicitante';
  const displayName = getUserDisplayName(otherPerson);
  const initial = getUserInitial(displayName);
  const statusInfo = formatTutoringStatus(session.status);

  // Comprobar si la hora programada ya fue alcanzada para permitir confirmación
  const [isTimeReached] = React.useState(() => {
    const scheduledTime = new Date(session.scheduled_at).getTime();
    return Date.now() >= scheduledTime;
  });

  // Estilos de badge según estado
  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
      case 'accepted':
        return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
      case 'completed':
        return { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' };
      case 'rejected':
        return { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
      case 'cancelled':
        return { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' };
      default:
        return { background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' };
    }
  };

  return (
    <div
      className="ia-card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        borderLeft: `4px solid ${
          session.status === 'completed'
            ? '#16a34a'
            : session.status === 'accepted'
            ? '#2563eb'
            : session.status === 'pending'
            ? '#f59e0b'
            : '#94a3b8'
        }`,
      }}
    >
      {/* Cabecera de la tarjeta: Materia y Estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <BookOpenIcon size={16} color="#2563eb" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              {session.subject?.name || 'Materia no especificada'}
            </h3>
            {session.subject?.category && (
              <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                {session.subject.category}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#64748b' }}>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.7rem',
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <span>
              {otherRoleLabel}: <strong>{displayName}</strong>
              {otherPerson?.career ? ` • ${otherPerson.career}` : ''}
            </span>
          </div>
        </div>

        {/* Badge de estado */}
        <span
          style={{
            ...getBadgeStyle(session.status),
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Detalles de la sesión: Fecha, Hora, Duración, Modalidad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          background: '#f8fafc',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155' }}>
          <CalendarIcon size={16} color="#2563eb" />
          <span>{formatTutoringDateTime(session.scheduled_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155' }}>
          <ClockIcon size={16} color="#2563eb" />
          <span>{formatTutoringDuration(session.duration_minutes)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155' }}>
          {session.modality === 'online' ? (
            <VideoIcon size={16} color="#16a34a" />
          ) : (
            <MapPinIcon size={16} color="#0891b2" />
          )}
          <span>{formatTutoringModality(session.modality)}</span>
        </div>
      </div>

      {/* Ubicación o Enlace */}
      {session.location_or_link && (
        <div style={{ fontSize: '0.84rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          {session.modality === 'online' ? <VideoIcon size={16} color="#64748b" /> : <MapPinIcon size={16} color="#64748b" />}
          <div>
            <strong>{session.modality === 'online' ? 'Plataforma / Enlace:' : 'Lugar:'}</strong>{' '}
            {session.location_or_link.startsWith('http') ? (
              <a
                href={session.location_or_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
              >
                {session.location_or_link}
              </a>
            ) : (
              <span>{session.location_or_link}</span>
            )}
          </div>
        </div>
      )}

      {/* Notas o temas */}
      {session.notes && (
        <div style={{ fontSize: '0.84rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <MessageSquareIcon size={16} color="#64748b" />
          <div>
            <strong>Temas a reforzar:</strong> {session.notes}
          </div>
        </div>
      )}

      {/* Motivo de cancelación si aplica */}
      {session.status === 'cancelled' && session.cancellation_reason && (
        <div style={{ fontSize: '0.82rem', background: '#fef2f2', color: '#b91c1c', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
          <strong>Motivo de cancelación:</strong> {session.cancellation_reason}
        </div>
      )}

      {/* Información de evaluación si está completada */}
      {session.status === 'completed' && session.review && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #86efac',
              fontWeight: 800,
              fontSize: '0.92rem',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <StarIcon size={16} color="#15803d" />
            {Number(session.review.overall_score).toFixed(1)} / 10
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#14532d' }}>
              Tutoría evaluada por el estudiante
            </div>
            {session.review.comment && (
              <div style={{ fontSize: '0.8rem', color: '#166534', fontStyle: 'italic', marginTop: '2px' }}>
                "{session.review.comment}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botones de acción según rol y estado */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
        {/* Caso 1: Como Tutor en sesión PENDIENTE -> Aceptar o Rechazar */}
        {role === 'tutor' && session.status === 'pending' && (
          <>
            <button
              type="button"
              onClick={() => onReject?.(session.id)}
              disabled={actionLoading}
              className="ia-btn-secondary"
              style={{ color: '#b91c1c', borderColor: '#fecaca' }}
            >
              <XIcon size={16} /> Rechazar
            </button>
            <button
              type="button"
              onClick={() => onAccept?.(session.id)}
              disabled={actionLoading}
              className="ia-btn-primary"
            >
              <CheckIcon size={16} /> Aceptar Solicitud
            </button>
          </>
        )}

        {/* Caso 2: Como Estudiante en sesión PENDIENTE -> Cancelar Solicitud */}
        {role === 'student' && session.status === 'pending' && (
          <button
            type="button"
            onClick={() => onCancel?.(session.id)}
            disabled={actionLoading}
            className="ia-btn-secondary"
            style={{ color: '#b91c1c', borderColor: '#fecaca' }}
          >
            <XIcon size={16} /> Cancelar Solicitud
          </button>
        )}

        {/* Caso 3: Sesión ACEPTADA */}
        {session.status === 'accepted' && (
          <>
            {/* Ambos pueden cancelar antes */}
            <button
              type="button"
              onClick={() => onCancel?.(session.id)}
              disabled={actionLoading}
              className="ia-btn-secondary"
              style={{ color: '#b91c1c', borderColor: '#fecaca' }}
            >
              <XIcon size={16} /> Cancelar Sesión
            </button>

            {/* Solo el estudiante puede marcar como completada */}
            {role === 'student' && (
              <>
                {isTimeReached ? (
                  <button
                    type="button"
                    onClick={() => onComplete?.(session.id)}
                    disabled={actionLoading}
                    className="ia-btn-primary"
                    style={{ background: '#16a34a', borderColor: '#15803d' }}
                  >
                    <CheckIcon size={16} /> Confirmar Tutoría Realizada
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                      background: '#f8fafc',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ClockIcon size={14} color="#64748b" />
                    Podrás confirmar su realización una vez iniciada la hora acordada
                  </span>
                )}
              </>
            )}
          </>
        )}

        {/* Caso 4: Sesión COMPLETADA */}
        {session.status === 'completed' && (
          <>
            {role === 'student' && !session.review && (
              <button
                type="button"
                onClick={() => onReview?.(session)}
                className="ia-btn-primary"
              >
                <StarIcon size={16} /> Evaluar Tutor
              </button>
            )}

            {role === 'tutor' && !session.review && (
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                Pendiente de evaluación por el estudiante
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
