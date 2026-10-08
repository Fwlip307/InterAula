import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tutoringService } from '../../services/tutoring.service';
import type { TutoringSession, TutoringWorkshop } from '../../types/tutoring';
import LearningClassesTab from './components/LearningClassesTab';
import StudyMaterialsTab from './components/StudyMaterialsTab';
import QuizzesTab from './components/QuizzesTab';
import FlashcardsTab from './components/FlashcardsTab';
import ReviewModal from '../tutoring/components/ReviewModal';
import {
  BookOpenIcon,
  CalendarIcon,
  SparklesIcon,
  VideoIcon,
  CheckIcon,
  AlertCircleIcon,
  XIcon,
} from '../../components/common/Icons';

type LearningTab = 'classes' | 'materials' | 'quizzes' | 'flashcards';

export default function LearningHub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LearningTab>('classes');
  const [studentSessions, setStudentSessions] = useState<TutoringSession[]>([]);
  const [enrolledWorkshops, setEnrolledWorkshops] = useState<TutoringWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal de evaluacion
  const [selectedSessionForReview, setSelectedSessionForReview] = useState<TutoringSession | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Modal de cancelacion
  const [sessionToCancel, setSessionToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [asStudent, studentWorkshops] = await Promise.all([
        tutoringService.getMySessionsAsStudent(),
        tutoringService.getMyWorkshopsAsStudent(),
      ]);
      setStudentSessions(asStudent);
      setEnrolledWorkshops(studentWorkshops);
    } catch (err: any) {
      console.error('[LearningHub] Error al cargar datos:', err);
      setErrorMsg(err.message || 'No fue posible cargar tus datos de aprendizaje.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelSession = (sessionId: string) => {
    setSessionToCancel(sessionId);
    setCancellationReason('');
  };

  const handleConfirmCancel = async () => {
    if (!sessionToCancel) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateSessionStatus(sessionToCancel, 'cancelled', cancellationReason);
      setSuccessMsg('La sesion ha sido cancelada.');
      setTimeout(() => setSuccessMsg(''), 5000);
      setSessionToCancel(null);
      setCancellationReason('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'No fue posible cancelar la sesion.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReview = (session: TutoringSession) => {
    setSelectedSessionForReview(session);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = async () => {
    setSuccessMsg('Evaluacion registrada exitosamente.');
    setTimeout(() => setSuccessMsg(''), 5000);
    await loadData();
  };

  const handleUnenrollWorkshop = async (workshopId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.unenrollFromWorkshop(workshopId);
      setSuccessMsg('Has cancelado tu inscripcion en el taller.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'No fue posible cancelar tu reserva.');
    } finally {
      setActionLoading(false);
    }
  };

  const tabs: { key: LearningTab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'classes', label: `Mis Clases (${studentSessions.length + enrolledWorkshops.length})`, icon: <CalendarIcon size={18} />, color: '#2563eb' },
    { key: 'materials', label: 'Material de Estudio', icon: <BookOpenIcon size={18} />, color: '#16a34a' },
    { key: 'quizzes', label: 'Quizzes de Practica', icon: <SparklesIcon size={18} />, color: '#7c3aed' },
    { key: 'flashcards', label: 'Flashcards', icon: <VideoIcon size={18} />, color: '#ea580c' },
  ];

  return (
    <div>
      {/* Cabecera */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
          Mi Aprendizaje
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
          Tu espacio de estudio centralizado: revisa tus clases agendadas, accede al material de apoyo, pon a prueba tus conocimientos con quizzes y domina conceptos clave con flashcards.
        </p>
      </div>

      {/* Alertas */}
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

      {/* Pestanas */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px',
          gap: '4px',
          flexWrap: 'wrap',
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 18px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === tab.key ? tab.color : '#64748b',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading && activeTab === 'classes' ? (
        <div className="ia-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Cargando tus datos de aprendizaje...</p>
        </div>
      ) : activeTab === 'classes' ? (
        <LearningClassesTab
          studentSessions={studentSessions}
          enrolledWorkshops={enrolledWorkshops}
          currentUserId={user?.id}
          onCancelSession={handleCancelSession}
          onReviewSession={handleOpenReview}
          onUnenrollWorkshop={handleUnenrollWorkshop}
          actionLoading={actionLoading}
        />
      ) : activeTab === 'materials' ? (
        <StudyMaterialsTab />
      ) : activeTab === 'quizzes' ? (
        <QuizzesTab />
      ) : (
        <FlashcardsTab />
      )}

      {/* Modal de Cancelacion */}
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
                Cancelar Tutoria
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
              ¿Estas seguro de que deseas cancelar esta sesion?
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Motivo de la cancelacion (opcional)
              </label>
              <textarea
                className="ia-input"
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ej: Choque de horario..."
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
                {actionLoading ? 'Cancelando...' : 'Confirmar Cancelacion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Evaluacion */}
      <ReviewModal
        session={selectedSessionForReview}
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedSessionForReview(null);
        }}
        onSuccess={handleReviewSuccess}
      />
    </div>
  );
}
