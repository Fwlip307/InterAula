import { Link } from 'react-router-dom';
import type { TutoringSession, TutoringWorkshop } from '../../../types/tutoring';
import SessionCard from '../../tutoring/components/SessionCard';
import WorkshopCard from '../../tutoring/components/WorkshopCard';
import EmptyState from '../../../components/common/EmptyState';
import {
  CalendarIcon,
  BookOpenIcon,
  VideoIcon,
  UsersIcon,
} from '../../../components/common/Icons';

interface LearningClassesTabProps {
  studentSessions: TutoringSession[];
  enrolledWorkshops: TutoringWorkshop[];
  currentUserId?: string;
  onCancelSession: (sessionId: string) => void;
  onReviewSession: (session: TutoringSession) => void;
  onUnenrollWorkshop: (workshopId: string) => Promise<void>;
  actionLoading?: boolean;
}

export default function LearningClassesTab({
  studentSessions,
  enrolledWorkshops,
  currentUserId,
  onCancelSession,
  onReviewSession,
  onUnenrollWorkshop,
  actionLoading = false,
}: LearningClassesTabProps) {
  const pendingSessions = studentSessions.filter((s) => s.status === 'pending');
  const acceptedSessions = studentSessions.filter((s) => s.status === 'accepted');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Resumen de Aprendizaje Activo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div className="ia-card" style={{ padding: '16px 20px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Tutorias Agendadas
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {acceptedSessions.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '2px' }}>
            {pendingSessions.length > 0 ? `${pendingSessions.length} en espera de confirmacion` : 'Listas para ingresar'}
          </div>
        </div>

        <div className="ia-card" style={{ padding: '16px 20px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Talleres en Vivo Inscritos
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {enrolledWorkshops.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '2px' }}>
            Cupos reservados en aulas grupales
          </div>
        </div>

        <div className="ia-card" style={{ padding: '16px 20px', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Explorar Mas Ayuda
          </div>
          <div style={{ marginTop: '8px' }}>
            <Link
              to="/tutoring"
              className="ia-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BookOpenIcon size={14} color="#7c3aed" />
              <span>Ver Tutores Disponibles</span>
            </Link>
          </div>
        </div>
      </div>

      {/* SECCION 1: Talleres Grupales en Vivo Reservados */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <VideoIcon size={20} color="#16a34a" /> Talleres y Clases en Vivo Reservadas ({enrolledWorkshops.length})
          </h2>
          <Link to="/tutoring" style={{ fontSize: '0.84rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Ver agenda de talleres abierta
          </Link>
        </div>

        {enrolledWorkshops.length === 0 ? (
          <div className="ia-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '0.9rem' }}>
              No tienes reservas activas en talleres grupales en vivo.
            </p>
            <Link to="/tutoring" className="ia-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <UsersIcon size={16} /> Explorar talleres abiertos
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {enrolledWorkshops.map((w) => (
              <WorkshopCard
                key={w.id}
                workshop={w}
                currentUserId={currentUserId}
                onEnroll={async () => {}}
                onUnenroll={onUnenrollWorkshop}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* SECCION 2: Tutorias 1 a 1 Solicitadas como Estudiante */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={20} color="#2563eb" /> Sesiones de Tutoria 1 a 1 Solicitadas ({studentSessions.length})
          </h2>
        </div>

        {studentSessions.length === 0 ? (
          <div className="ia-card">
            <EmptyState
              style={{ padding: '40px 20px' }}
              icon={<BookOpenIcon size={32} color="#2563eb" />}
              title="Aun no has solicitado tutorias 1 a 1"
              description="Puedes buscar companeros validados en materias criticas de tu carrera y pedirles apoyo personalizado para preparar tus evaluaciones."
              action={
                <Link to="/tutoring" className="ia-btn-primary">
                  <BookOpenIcon size={16} /> Explorar Tutores por Materia
                </Link>
              }
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {studentSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                role="student"
                onCancel={onCancelSession}
                onReview={onReviewSession}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
