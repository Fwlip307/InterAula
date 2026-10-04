import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tutoringService } from '../../services/tutoring.service';
import { profileService, isCertifiedAccount } from '../../services/profile.service';
import type { TutoringSession, TutoringWorkshop } from '../../types/tutoring';
import type { Subject, OfferedSubject } from '../../types/profile';
import SessionCard from './components/SessionCard';
import WorkshopCard from './components/WorkshopCard';
import CreateWorkshopModal from './components/CreateWorkshopModal';
import ReviewModal from './components/ReviewModal';
import EmptyState from '../../components/common/EmptyState';
import {
  CalendarIcon,
  UsersIcon,
  BookOpenIcon,
  AlertCircleIcon,
  CheckIcon,
  XIcon,
  VideoIcon,
} from '../../components/common/Icons';

type TabType = 'student' | 'tutor' | 'workshops';

export default function MyTutoring() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('student');
  const [studentSessions, setStudentSessions] = useState<TutoringSession[]>([]);
  const [tutorSessions, setTutorSessions] = useState<TutoringSession[]>([]);
  const [enrolledWorkshops, setEnrolledWorkshops] = useState<TutoringWorkshop[]>([]);
  const [hostedWorkshops, setHostedWorkshops] = useState<TutoringWorkshop[]>([]);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [isCreateWorkshopModalOpen, setIsCreateWorkshopModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isTutor =
    offeredSubjects.length > 0 ||
    Boolean(user?.email && isCertifiedAccount(user.email));

  // Estado para modal de evaluación
  const [selectedSessionForReview, setSelectedSessionForReview] = useState<TutoringSession | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Estado para cancelación con motivo
  const [sessionToCancel, setSessionToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [asStudent, asTutor, studentWorkshops, tutorWorkshops, offered] = await Promise.all([
        tutoringService.getMySessionsAsStudent(),
        tutoringService.getMySessionsAsTutor(),
        tutoringService.getMyWorkshopsAsStudent(),
        tutoringService.getMyWorkshopsAsTutor(),
        user ? profileService.getOfferedSubjects(user.id) : Promise.resolve([]),
      ]);
      setStudentSessions(asStudent);
      setTutorSessions(asTutor);
      setEnrolledWorkshops(studentWorkshops);
      setHostedWorkshops(tutorWorkshops);
      setOfferedSubjects(offered);
      const userIsTutor = offered.length > 0 || Boolean(user?.email && isCertifiedAccount(user.email));
      if (!userIsTutor && activeTab === 'tutor') {
        setActiveTab('student');
      }
    } catch (err: any) {
      console.error('[MyTutoring] Error al cargar sesiones:', err);
      setErrorMsg(err.message || 'No fue posible cargar tus tutorías.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleAccept = async (sessionId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateSessionStatus(sessionId, 'accepted');
      setSuccessMsg('Solicitud de tutoría aceptada correctamente.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al aceptar sesión:', err);
      setErrorMsg(err.message || 'No fue posible aceptar la solicitud.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (sessionId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateSessionStatus(sessionId, 'rejected');
      setSuccessMsg('Solicitud de tutoría rechazada.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al rechazar sesión:', err);
      setErrorMsg(err.message || 'No fue posible rechazar la solicitud.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelClick = (sessionId: string) => {
    setSessionToCancel(sessionId);
    setCancellationReason('');
  };

  const handleConfirmCancel = async () => {
    if (!sessionToCancel) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateSessionStatus(sessionToCancel, 'cancelled', cancellationReason);
      setSuccessMsg('La sesión ha sido cancelada.');
      setTimeout(() => setSuccessMsg(''), 5000);
      setSessionToCancel(null);
      setCancellationReason('');
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al cancelar sesión:', err);
      setErrorMsg(err.message || 'No fue posible cancelar la sesión.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (sessionId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateSessionStatus(sessionId, 'completed');
      setSuccessMsg('¡Tutoría marcada como completada! Ahora puedes calificar a tu tutor.');
      setTimeout(() => setSuccessMsg(''), 6000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al completar sesión:', err);
      setErrorMsg(err.message || 'No fue posible confirmar la realización de la sesión.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReview = (session: TutoringSession) => {
    setSelectedSessionForReview(session);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = async () => {
    setSuccessMsg('¡Evaluación registrada exitosamente! Muchas gracias por colaborar.');
    setTimeout(() => setSuccessMsg(''), 5000);
    await loadSessions();
  };

  const handleWorkshopUnenroll = async (workshopId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.unenrollFromWorkshop(workshopId);
      setSuccessMsg('Has cancelado tu inscripción en el taller.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al cancelar reserva de taller:', err);
      setErrorMsg(err.message || 'No fue posible cancelar tu reserva.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWorkshopCancel = async (workshopId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateWorkshopStatus(workshopId, 'cancelled');
      setSuccessMsg('El taller grupal ha sido cancelado.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al cancelar taller:', err);
      setErrorMsg(err.message || 'No fue posible cancelar el taller.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWorkshopFinish = async (workshopId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateWorkshopStatus(workshopId, 'completed');
      setSuccessMsg('Taller finalizado exitosamente.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al finalizar taller:', err);
      setErrorMsg(err.message || 'No fue posible finalizar el taller.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWorkshopSuccess = async () => {
    setSuccessMsg('¡Taller grupal en vivo programado exitosamente!');
    setTimeout(() => setSuccessMsg(''), 5000);
    setActiveTab('workshops');
    await loadSessions();
  };

  const currentList = activeTab === 'student' ? studentSessions : tutorSessions;

  // Conteo de solicitudes pendientes como tutor para llamar la atención
  const pendingTutorRequestsCount = tutorSessions.filter((s) => s.status === 'pending').length;

  return (
    <div>
      {/* Cabecera y pestañas */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
          Gestión de Mis Tutorías y Clases en Vivo
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
          {isTutor
            ? 'Administra las sesiones que has solicitado como estudiante, atiende peticiones como tutor y gestiona tus talleres grupales.'
            : 'Administra tus solicitudes y sesiones de tutoría agendadas, además de tus talleres grupales inscritos.'}
        </p>
      </div>

      {/* Alertas globales */}
      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckIcon size={18} color="#15803d" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircleIcon size={18} color="#b91c1c" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      {/* Pestañas (Como estudiante / Como tutor / Talleres en Vivo) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('student')}
          style={{
            padding: '12px 20px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'student' ? '#2563eb' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'student' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpenIcon size={18} color={activeTab === 'student' ? '#2563eb' : '#64748b'} />
          Como Estudiante ({studentSessions.length})
        </button>

        {isTutor && (
          <button
            type="button"
            onClick={() => setActiveTab('tutor')}
            style={{
              padding: '12px 20px',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: activeTab === 'tutor' ? '#2563eb' : '#64748b',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'tutor' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <UsersIcon size={18} color={activeTab === 'tutor' ? '#2563eb' : '#64748b'} />
            Como Tutor ({tutorSessions.length})
            {pendingTutorRequestsCount > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}
              >
                {pendingTutorRequestsCount} pendientes
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('workshops')}
          style={{
            padding: '12px 20px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'workshops' ? '#7c3aed' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'workshops' ? '2px solid #7c3aed' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <VideoIcon size={18} color={activeTab === 'workshops' ? '#7c3aed' : '#64748b'} />
          Talleres en Vivo ({enrolledWorkshops.length + (isTutor ? hostedWorkshops.length : 0)})
        </button>
      </div>

      {/* Contenido de la pestaña activa */}
      {loading ? (
        <div className="ia-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Cargando sesiones y talleres...</p>
        </div>
      ) : activeTab === 'workshops' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Barra superior de talleres */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
                Mis Talleres y Aulas Virtuales Grupales
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                {isTutor
                  ? 'Sesiones programadas con enlace al Aula Virtual integrado. Inscríbete o imparte una clase.'
                  : 'Talleres grupales en vivo en los que estás inscrito para reforzar materias.'}
              </p>
            </div>
            {isTutor ? (
              <button
                type="button"
                onClick={() => setIsCreateWorkshopModalOpen(true)}
                className="ia-btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  borderColor: '#7c3aed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  fontWeight: 700,
                }}
              >
                <VideoIcon size={16} color="#ffffff" /> + Programar Nuevo Taller
              </button>
            ) : (
              <Link
                to="/profile?tab=tutoring"
                className="ia-btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span>Habilitarme como Tutor para Dictar Talleres</span>
              </Link>
            )}
          </div>

          {/* Sección 1: Talleres que imparto como tutor (Solo tutores habilitados) */}
          {isTutor && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UsersIcon size={18} color="#7c3aed" />
                Talleres que imparto como Tutor ({hostedWorkshops.length})
              </h3>
              {hostedWorkshops.length === 0 ? (
                <div className="ia-card" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                  No has programado talleres aún. Comparte tu conocimiento programando una clase grupal para tus compañeros.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                  {hostedWorkshops.map((w) => (
                    <WorkshopCard
                      key={w.id}
                      workshop={w}
                      currentUserId={user?.id}
                      onEnroll={async () => {}}
                      onUnenroll={handleWorkshopUnenroll}
                      onCancelWorkshop={handleWorkshopCancel}
                      onFinishWorkshop={handleWorkshopFinish}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sección 2: Talleres inscritos como estudiante */}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpenIcon size={18} color="#16a34a" />
              Talleres inscritos como Estudiante ({enrolledWorkshops.length})
            </h3>
            {enrolledWorkshops.length === 0 ? (
              <div className="ia-card" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                No tienes reservas activas en talleres grupales.{' '}
                <Link to="/tutoring" style={{ color: '#2563eb', fontWeight: 600 }}>
                  Explora los talleres en vivo disponibles
                </Link>
                .
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {enrolledWorkshops.map((w) => (
                  <WorkshopCard
                    key={w.id}
                    workshop={w}
                    currentUserId={user?.id}
                    onEnroll={async () => {}}
                    onUnenroll={handleWorkshopUnenroll}
                    actionLoading={actionLoading}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : currentList.length === 0 ? (
        <div className="ia-card">
          <EmptyState
            style={{ padding: '48px 20px' }}
            icon={<CalendarIcon size={32} color="#2563eb" />}
            title={
              activeTab === 'student'
                ? 'No tienes tutorías solicitadas como estudiante'
                : 'No tienes solicitudes recibidas como tutor'
            }
            description={
              activeTab === 'student'
                ? 'Explora las materias disponibles y solicita apoyo a compañeros con dominio comprobado.'
                : 'Cuando otros compañeros requieran ayuda en las asignaturas que ofreces, sus solicitudes aparecerán aquí.'
            }
            action={
              activeTab === 'student' ? (
                <Link to="/tutoring" className="ia-btn-primary">
                  <BookOpenIcon size={16} /> Explorar Tutores
                </Link>
              ) : (
                <Link to="/profile?tab=tutoring" className="ia-btn-secondary">
                  <UsersIcon size={16} /> Configurar materias que ofrezco
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {currentList.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              role={activeTab as 'student' | 'tutor'}
              onAccept={handleAccept}
              onReject={handleReject}
              onCancel={handleCancelClick}
              onComplete={handleComplete}
              onReview={handleOpenReview}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Modal de Cancelación con Motivo */}
      {sessionToCancel && (
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
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Cancelar Tutoría
              </h3>
              <button
                type="button"
                onClick={() => setSessionToCancel(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginTop: 0, marginBottom: '16px' }}>
              ¿Estás seguro de que deseas cancelar esta sesión? Esta acción notificará el cambio de estado en la plataforma.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Motivo de la cancelación (opcional)
              </label>
              <textarea
                className="ia-input"
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ej: Choque de horario con prueba de laboratorio..."
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="ia-btn-secondary"
                onClick={() => setSessionToCancel(null)}
                disabled={actionLoading}
              >
                Volver
              </button>
              <button
                type="button"
                className="ia-btn-primary"
                style={{ background: '#b91c1c', borderColor: '#991b1b' }}
                onClick={handleConfirmCancel}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Evaluación */}
      <ReviewModal
        session={selectedSessionForReview}
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedSessionForReview(null);
        }}
        onSuccess={handleReviewSuccess}
      />

      {/* Modal de Creación de Taller Grupal */}
      <CreateWorkshopModal
        isOpen={isCreateWorkshopModalOpen}
        onClose={() => setIsCreateWorkshopModalOpen(false)}
        onSuccess={handleCreateWorkshopSuccess}
        availableSubjects={
          offeredSubjects
            .map((o) => o.subject)
            .filter((s): s is Subject => Boolean(s))
        }
      />
    </div>
  );
}
