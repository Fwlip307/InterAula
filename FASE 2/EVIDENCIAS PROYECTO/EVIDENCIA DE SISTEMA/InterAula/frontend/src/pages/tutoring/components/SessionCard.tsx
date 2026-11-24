import React from 'react';
import ReportLink from '../../../components/common/ReportLink';
import { Link } from 'react-router-dom';
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
  ShieldCheckIcon,
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
  const [now,setNow]=React.useState(Date.now);
  const confirmationTime=Date.parse(session.scheduled_at)+15*60_000;
  React.useEffect(()=>{
    if(!Number.isFinite(confirmationTime)||now>=confirmationTime)return;
    const timer=setTimeout(()=>setNow(Date.now()),Math.min(60_000,Math.max(50,confirmationTime-now)));
    return()=>clearTimeout(timer);
  },[now,confirmationTime]);
  const isTimeReached=now>=confirmationTime;
  const alreadyConfirmed=Boolean(role==='tutor'?session.tutor_completion_confirmed_at:session.student_completion_confirmed_at);

  // Estilos de badge según estado (tokenizados para Modo Claro, Oscuro, Crepúsculo y Filtro cálido)
  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          background: 'var(--ia-amber-bg, #fef3c7)',
          color: 'var(--ia-amber, #b45309)',
          border: '1px solid var(--ia-amber-border, #fde68a)',
        };
      case 'accepted':
        return {
          background: 'var(--ia-primary-subtle, #eff6ff)',
          color: 'var(--ia-primary, #1d4ed8)',
          border: '1px solid var(--ia-primary-border, #bfdbfe)',
        };
      case 'completed':
        return {
          background: 'var(--ia-success-bg, #f0fdf4)',
          color: 'var(--ia-success, #15803d)',
          border: '1px solid var(--ia-success-border, #bbf7d0)',
        };
      case 'rejected':
        return {
          background: 'var(--ia-danger-bg, #fef2f2)',
          color: 'var(--ia-danger, #b91c1c)',
          border: '1px solid var(--ia-danger-border, #fecaca)',
        };
      case 'cancelled':
        return {
          background: 'var(--ia-bg-subtle, #f1f5f9)',
          color: 'var(--ia-text-muted, #64748b)',
          border: '1px solid var(--ia-border, #e2e8f0)',
        };
      default:
        return {
          background: 'var(--ia-bg-subtle, #f1f5f9)',
          color: 'var(--ia-text-body, #334155)',
          border: '1px solid var(--ia-border, #e2e8f0)',
        };
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
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--ia-text-main, #0f172a)' }}>
              {session.subject?.name || 'Materia no especificada'}
            </h3>
            {session.subject?.category && (
              <span style={{ fontSize: '0.75rem', background: 'var(--ia-bg-subtle, #f1f5f9)', color: 'var(--ia-text-body, #475569)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                {session.subject.category}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--ia-text-muted, #64748b)' }}>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                background: 'var(--ia-primary, #2563eb)',
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
              {otherRoleLabel}:{' '}
              {otherPerson?.id ? (
                <Link
                  to={`/profile/${otherPerson.id}`}
                  style={{ color: 'var(--ia-text-main, #0f172a)', fontWeight: 700, textDecoration: 'none' }}
                >
                  {displayName}
                </Link>
              ) : (
                <strong>{displayName}</strong>
              )}
              {otherPerson?.career ? ` • ${otherPerson.career}` : ''}
            </span>
          </div>
        </div>

        {/* Badges de estado y auditoría */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {session.attendance_verified && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                background: 'var(--ia-success-bg, #f0fdf4)',
                color: 'var(--ia-success, #15803d)',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid var(--ia-success-border, #bbf7d0)',
                fontWeight: 700,
              }}
            >
              <ShieldCheckIcon size={14} /> Asistencia registrada
            </span>
          )}

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
      </div>

      {/* Detalles de la sesión: Fecha, Hora, Duración, Modalidad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          background: 'var(--ia-bg-subtle, #f8fafc)',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid var(--ia-border, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: 'var(--ia-text-body, #334155)' }}>
          <CalendarIcon size={16} color="var(--ia-primary, #2563eb)" />
          <span>{formatTutoringDateTime(session.scheduled_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: 'var(--ia-text-body, #334155)' }}>
          <ClockIcon size={16} color="var(--ia-primary, #2563eb)" />
          <span>{formatTutoringDuration(session.duration_minutes)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: 'var(--ia-text-body, #334155)' }}>
          {session.modality === 'online' ? (
            <VideoIcon size={16} color="var(--ia-success, #16a34a)" />
          ) : (
            <MapPinIcon size={16} color="var(--ia-primary, #0891b2)" />
          )}
          <span>{formatTutoringModality(session.modality)}</span>
        </div>
      </div>

      {/* Información del Aula Virtual si es Online */}
      {session.modality === 'online' ? (
        <div
          style={{
            fontSize: '0.84rem',
            color: 'var(--ia-text-main, #1e40af)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--ia-primary-subtle, #eff6ff)',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--ia-primary-border, #bfdbfe)',
          }}
        >
          <VideoIcon size={18} color="var(--ia-primary, #2563eb)" />
          <div style={{ flex: 1 }}>
            <strong>Aula de InterAula:</strong> videollamada, pizarra y registro de conexión. La participación puede ser por voz o chat, sin exigir cámara.
            {session.location_or_link && (
              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--ia-text-muted, #64748b)' }}>
                Enlace alternativo del solicitante: {session.location_or_link}
              </div>
            )}
          </div>
        </div>
      ) : (
        session.location_or_link && (
          <div style={{ fontSize: '0.84rem', color: 'var(--ia-text-body, #475569)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <MapPinIcon size={16} color="var(--ia-text-muted, #64748b)" />
            <div>
              <strong>Lugar de encuentro:</strong> <span>{session.location_or_link}</span>
            </div>
          </div>
        )
      )}

      {/* Pautas de Acompañamiento Empático / Confort */}
      {(() => {
        const comfortMatch = session.notes?.match(/\[Pautas de Confort:\s*([^\]]+)\]/i);
        const comfortTags = comfortMatch
          ? comfortMatch[1].split(',').map((s) => s.trim())
          : [];
        const cleanNotes = session.notes
          ? session.notes.replace(/\[Pautas de Confort:\s*[^\]]+\]/i, '').trim()
          : '';

        return (
          <>
            {comfortTags.length > 0 && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 800, color: '#166534' }}>
                  <span>Guía de Sesión Empática (Preferencias de Aprendizaje del Alumno):</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {comfortTags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#15803d',
                        border: '1px solid #86efac',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {cleanNotes && (
              <div style={{ fontSize: '0.84rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MessageSquareIcon size={16} color="#64748b" />
                <div>
                  <strong>Temas a reforzar:</strong> {cleanNotes}
                </div>
              </div>
            )}
          </>
        );
      })()}

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
      <ReportLink kind="session" targetId={session.id}/>
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
        {(session.status === 'accepted'||session.status === 'in_progress') && (
          <>
            {/* Si es online, botón destacado para entrar al Aula Virtual */}
            {session.modality === 'online' && (
              <Link
                to={`/tutoring/room/${session.id}`}
                className="ia-btn ia-btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                }}
              >
                <VideoIcon size={16} color="#ffffff" /> Entrar al Aula Virtual
              </Link>
            )}

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

            {/* Cada participante confirma su propia realización; el servidor valida el cierre. */}
            {onComplete && (
              <>
                {isTimeReached ? (
                  <button
                    type="button"
                    onClick={() => onComplete?.(session.id)}
                    disabled={actionLoading||(alreadyConfirmed&&!(role==='tutor'&&session.attendance_verified))}
                    className="ia-btn-primary"
                    style={{ background: '#16a34a', borderColor: '#15803d' }}
                  >
                    <CheckIcon size={16} /> {alreadyConfirmed&&!(role==='tutor'&&session.attendance_verified)?'Confirmado · esperando al otro participante':'Confirmar realización'}
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
                    Podrás confirmar tras 15 minutos desde el horario acordado
                  </span>
                )}
              </>
            )}
            {!onComplete&&<Link className="ia-btn-secondary" to="/my-tutoring">Gestionar confirmación</Link>}
            <p style={{fontSize:'.78rem',lineHeight:1.6,margin:0}}>La sesión cuenta cuando hay asistencia registrada y confirmación del tutor, o cuando ambos confirman su realización. Confirma solo si participaste.</p>
          </>
        )}

        {/* Caso 4: Sesión COMPLETADA */}
        {session.status === 'completed' && (
          <>
            <span style={{fontSize:'.78rem'}}>{session.completion_verified_at?'Sesión validada para trayectoria y calidad':'Registro histórico · conserva su valoración, sin nueva evidencia de realización'}</span>
            {session.modality === 'online' && (
              <Link
                to={`/tutoring/room/${session.id}`}
                className="ia-btn ia-btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                }}
              >
                <VideoIcon size={14} /> Ver Sala / Apuntes
              </Link>
            )}

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
