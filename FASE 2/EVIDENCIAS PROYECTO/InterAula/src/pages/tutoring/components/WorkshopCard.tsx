import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TutoringWorkshop } from '../../../types/tutoring';
import {
  getUserDisplayName,
  getUserInitial,
  formatTutoringDateTime,
  formatTutoringDuration,
} from '../../../utils/formatters';
import {
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  UsersIcon,
  CheckIcon,
  ExternalLinkIcon,
  TrashIcon,
} from '../../../components/common/Icons';

interface WorkshopCardProps {
  workshop: TutoringWorkshop;
  currentUserId?: string;
  onEnroll: (workshopId: string) => Promise<void>;
  onUnenroll: (workshopId: string) => Promise<void>;
  onCancelWorkshop?: (workshopId: string) => Promise<void>;
  onFinishWorkshop?: (workshopId: string) => Promise<void>;
  onDeleteWorkshop?: (workshopId: string) => Promise<void>;
  actionLoading?: boolean;
}

export default function WorkshopCard({
  workshop,
  currentUserId,
  onEnroll,
  onUnenroll,
  onCancelWorkshop,
  onFinishWorkshop,
  onDeleteWorkshop,
  actionLoading = false,
}: WorkshopCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isTutor = Boolean(currentUserId) && (currentUserId === workshop.tutor_id || workshop.tutor_id === 'live-host');
  const isEnrolled = Boolean(workshop.is_enrolled);
  const tutorName = getUserDisplayName(workshop.tutor);
  const initial = getUserInitial(tutorName);
  const enrolledCount = workshop.enrollments_count || 0;
  const isFull = enrolledCount >= workshop.max_students;
  const isLive = workshop.status === 'in_progress';
  const isCompleted = workshop.status === 'completed';

  const handleCopyLink = () => {
    try {
      const roomUrl = `${window.location.origin}/tutoring/room/${workshop.id}`;
      navigator.clipboard.writeText(roomUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  // Porcentaje de ocupación para la barrita visual
  const occupancyPercent = Math.min(100, Math.round((enrolledCount / workshop.max_students) * 100));

  return (
    <div
      className="ia-card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        borderLeft: `4px solid ${isTutor ? '#7c3aed' : isEnrolled ? '#16a34a' : '#2563eb'}`,
        position: 'relative',
      }}
    >
      {/* Cabecera: Materia, Tipo y Cupos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: isCompleted ? '#f1f5f9' : isLive ? '#fef2f2' : isTutor ? '#faf5ff' : '#eff6ff',
                color: isCompleted ? '#64748b' : isLive ? '#dc2626' : isTutor ? '#7c3aed' : '#1d4ed8',
                border: `1px solid ${isCompleted ? '#cbd5e1' : isLive ? '#fecaca' : isTutor ? '#e9d5ff' : '#bfdbfe'}`,
              }}
            >
              <VideoIcon size={12} /> {isCompleted ? 'Clase Finalizada' : isLive ? 'EN VIVO AHORA' : 'Taller en Vivo'}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              {workshop.subject?.name}
            </span>
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
            {workshop.title}
          </h3>
        </div>

        {/* Badge de Cupos */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: isFull ? '#fef2f2' : '#f0fdf4',
              color: isFull ? '#b91c1c' : '#15803d',
              border: `1px solid ${isFull ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            <UsersIcon size={14} />
            <span>{enrolledCount} / {workshop.max_students} inscritos</span>
          </div>
        </div>
      </div>

      {/* Barra de progreso de cupos */}
      <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${occupancyPercent}%`,
            height: '100%',
            backgroundColor: isFull ? '#ef4444' : occupancyPercent > 75 ? '#f59e0b' : '#22c55e',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Datos del Tutor expositor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: '#475569' }}>
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.72rem',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <span>
          Impartido por: <strong>{tutorName}</strong> {isTutor && <span style={{ color: '#7c3aed', fontWeight: 700 }}>(Tú)</span>}
          {workshop.tutor?.career ? ` • ${workshop.tutor.career}` : ''}
        </span>
      </div>

      {/* Descripción o temario */}
      {workshop.description && (
        <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.4, background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <strong>Pauta:</strong> {workshop.description}
        </p>
      )}

      {/* Horario y Duración */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '8px',
          fontSize: '0.82rem',
          color: '#334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CalendarIcon size={14} color="#2563eb" />
          <span>{formatTutoringDateTime(workshop.scheduled_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ClockIcon size={14} color="#2563eb" />
          <span>{formatTutoringDuration(workshop.duration_minutes)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <VideoIcon size={14} color="#16a34a" />
          <span>Aula Virtual InterAula</span>
        </div>
      </div>

      {/* Botones de Acción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
        {/* Botón copiar enlace rápido */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="ia-btn-secondary"
          title="Copiar enlace para invitar a compañeros a esta clase"
          style={{
            fontSize: '0.8rem',
            padding: '6px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: copiedLink ? '#15803d' : '#475569',
            borderColor: copiedLink ? '#86efac' : '#cbd5e1',
          }}
        >
          {copiedLink ? <CheckIcon size={14} color="#15803d" /> : <ExternalLinkIcon size={14} />}
          <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Caso 1: El usuario es el TUTOR que imparte la clase */}
          {isTutor && (
            <>
              {onFinishWorkshop && !isCompleted && workshop.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => onFinishWorkshop(workshop.id)}
                  disabled={actionLoading}
                  className="ia-btn-secondary"
                  title="Dar por terminada esta clase para todos los alumnos"
                  style={{ color: '#b91c1c', borderColor: '#fecaca', fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  Finalizar Clase
                </button>
              )}

              {onCancelWorkshop && workshop.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => onCancelWorkshop(workshop.id)}
                  disabled={actionLoading}
                  className="ia-btn-secondary"
                  style={{ color: '#64748b', borderColor: '#cbd5e1', fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  Cancelar Taller
                </button>
              )}

              {!isCompleted && workshop.status !== 'cancelled' ? (
                <Link
                  to={`/tutoring/room/${workshop.id}`}
                  className="ia-btn ia-btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
                  }}
                >
                  <VideoIcon size={16} color="#ffffff" /> Entrar al Aula Virtual
                </Link>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {isCompleted ? 'Clase Finalizada' : 'Taller Cancelado'}
                </span>
              )}

              {/* Confirmación y Botón de Eliminación */}
              {onDeleteWorkshop && (
                confirmDelete ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '4px 10px',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>
                      ¿Eliminar clase?
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteWorkshop(workshop.id);
                        setConfirmDelete(false);
                      }}
                      disabled={actionLoading}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={actionLoading}
                      style={{
                        background: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={actionLoading}
                    className="ia-btn-secondary"
                    title="Eliminar esta clase del historial para no acumular registros"
                    style={{
                      color: '#b91c1c',
                      borderColor: '#fecaca',
                      fontSize: '0.82rem',
                      padding: '6px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <TrashIcon size={14} color="#b91c1c" />
                    <span>Eliminar</span>
                  </button>
                )
              )}
            </>
          )}

          {/* Caso 2: El usuario es ESTUDIANTE */}
          {!isTutor && (
            <>
              {isEnrolled && !isCompleted && workshop.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => onUnenroll(workshop.id)}
                  disabled={actionLoading}
                  className="ia-btn-secondary"
                  style={{ color: '#b91c1c', borderColor: '#fecaca', fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  Cancelar mi Reserva
                </button>
              )}

              {!isEnrolled && !isFull && !isCompleted && workshop.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => onEnroll(workshop.id)}
                  disabled={actionLoading}
                  className="ia-btn-secondary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  <CheckIcon size={14} /> Reservar Cupo
                </button>
              )}

              {!isCompleted && workshop.status !== 'cancelled' ? (
                <Link
                  to={`/tutoring/room/${workshop.id}`}
                  className="ia-btn ia-btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                  }}
                >
                  <VideoIcon size={16} color="#ffffff" /> Unirme a la Clase en Vivo
                </Link>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {isCompleted ? 'Clase Finalizada' : 'Taller Cancelado'}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
