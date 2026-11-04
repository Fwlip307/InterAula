import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tutoringService } from '../../services/tutoring.service';
import { profileService } from '../../services/profile.service';
import { notesService } from '../../services/notes.service';
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
  ShieldCheckIcon,
  PlusIcon,
} from '../../components/common/Icons';
import TutorMaterialsSection, { type TutorUploadedMaterial } from './components/TutorMaterialsSection';

type TutorTabType = 'requests' | 'confirmed' | 'student_sessions' | 'history' | 'workshops' | 'offerings' | 'materials';

export default function MyTutoring() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TutorTabType>('requests');
  const [tutorSessions, setTutorSessions] = useState<TutoringSession[]>([]);
  const [studentSessions, setStudentSessions] = useState<TutoringSession[]>([]);
  const [hostedWorkshops, setHostedWorkshops] = useState<TutoringWorkshop[]>([]);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);
  const [isCreateWorkshopModalOpen, setIsCreateWorkshopModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Publicar / Ofrecer nueva tutoría
  const [isPublishTutoringModalOpen, setIsPublishTutoringModalOpen] = useState(false);
  const [pubSubjectId, setPubSubjectId] = useState('');
  const [pubLevel, setPubLevel] = useState<'basic' | 'intermediate' | 'advanced'>('intermediate');
  const [pubModality, setPubModality] = useState<'online' | 'in_person' | 'hybrid'>('online');
  const [pubDescription, setPubDescription] = useState('');
  const [pubSubmitting, setPubSubmitting] = useState(false);

  // Apuntes reales del tutor conectados a notesService (sin datos ficticios hardcodeados)
  const [materials, setMaterials] = useState<TutorUploadedMaterial[]>([]);

  // Estado para modal de evaluación
  const [selectedSessionForReview, setSelectedSessionForReview] = useState<TutoringSession | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Estado para cancelación con motivo
  const [sessionToCancel, setSessionToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const isTutor = offeredSubjects.length > 0;

  const loadSessions = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [asTutor, asStudent, tutorWorkshops, offered, subjects, myNotes] = await Promise.all([
        tutoringService.getMySessionsAsTutor(),
        tutoringService.getMySessionsAsStudent(),
        tutoringService.getMyWorkshopsAsTutor(),
        user ? profileService.getOfferedSubjects(user.id) : Promise.resolve([]),
        profileService.getSubjects(),
        notesService.getMyNotes().catch(() => []),
      ]);
      setTutorSessions(asTutor);
      setStudentSessions(asStudent);
      setHostedWorkshops(tutorWorkshops);
      setOfferedSubjects(offered);
      setCatalogSubjects(subjects);
      if (subjects.length > 0 && !pubSubjectId) {
        setPubSubjectId(subjects[0].id);
      }

      const mappedMaterials: TutorUploadedMaterial[] = myNotes.map((note) => {
        const ext = (note.fileExtension || '').toLowerCase();
        const format: 'png' | 'word' | 'pdf' | 'text' =
          ext === '.png' || ext === '.jpg' || ext === '.jpeg'
            ? 'png'
            : ext === '.docx' || ext === '.doc'
              ? 'word'
              : ext === '.pdf'
                ? 'pdf'
                : note.sourceType === 'upload'
                  ? 'pdf'
                  : 'text';
        return {
          id: note.id,
          title: note.title,
          subjectName: note.subjectName || 'Materia General',
          format,
          fileName: note.fileName || undefined,
          textContent: note.contentMarkdown || note.summary || undefined,
          uploadedAt: note.createdAt
            ? new Date(note.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Publicado',
        };
      });
      setMaterials(mappedMaterials);
    } catch (err: any) {
      console.error('[MyTutoring] Error al cargar sesiones:', err);
      setErrorMsg(err.message || 'No fue posible cargar tus tutorías.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishTutoringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubSubjectId) return;

    setPubSubmitting(true);
    setErrorMsg('');
    try {
      const descWithExtra = [
        pubDescription.trim(),
        pubModality === 'online' ? 'Modalidad: Online (Aula Virtual)' : pubModality === 'in_person' ? 'Modalidad: Presencial en Sede' : 'Modalidad: Híbrida',
      ].filter(Boolean).join(' · ');

      await profileService.addOfferedSubject(
        pubSubjectId,
        pubLevel,
        descWithExtra
      );
      await profileService.updateMyProfile({ available_for_tutoring: true });

      setSuccessMsg('¡Materia publicada exitosamente! Ya está disponible en Aprendizaje para todos los estudiantes.');
      setTimeout(() => setSuccessMsg(''), 5000);
      setIsPublishTutoringModalOpen(false);
      setPubDescription('');
      setActiveTab('offerings');
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al publicar materia:', err);
      setErrorMsg(err.message || 'No fue posible publicar la materia.');
    } finally {
      setPubSubmitting(false);
    }
  };

  const handleRemoveOfferedSubject = async (subjectId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await profileService.removeOfferedSubject(subjectId);
      setSuccessMsg('Materia dada de baja de tus asignaturas ofertadas.');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al eliminar materia:', err);
      setErrorMsg(err.message || 'No fue posible eliminar la materia.');
    } finally {
      setActionLoading(false);
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
      setSuccessMsg('¡Solicitud de tutoría aceptada! El estudiante ha sido notificado.');
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
      setSuccessMsg('La sesión de tutoría ha sido cancelada.');
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
      setSuccessMsg('Tutoría marcada como completada con éxito.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al completar sesión:', err);
      setErrorMsg(err.message || 'No fue posible marcar la sesión como completada.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReview = (session: TutoringSession) => {
    setSelectedSessionForReview(session);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = async () => {
    setSuccessMsg('Evaluación registrada exitosamente.');
    setTimeout(() => setSuccessMsg(''), 5000);
    await loadSessions();
  };

  const handleCancelWorkshop = async (workshopId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateWorkshopStatus(workshopId, 'cancelled');
      setSuccessMsg('El taller ha sido cancelado.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al cancelar taller:', err);
      setErrorMsg(err.message || 'No fue posible cancelar el taller.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishWorkshop = async (workshopId: string) => {
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

  const handleWorkshopDelete = async (workshopId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setHostedWorkshops((prev) => prev.filter((w) => w.id !== workshopId && w.room_id !== workshopId));
    try {
      await tutoringService.deleteWorkshop(workshopId);
      setSuccessMsg('Clase o taller eliminado correctamente del historial.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadSessions();
    } catch (err: any) {
      console.error('[MyTutoring] Error al eliminar taller:', err);
      setErrorMsg(err.message || 'No fue posible eliminar la clase.');
      await loadSessions();
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

  // Guardar nuevo apunte conectado al backend real (notesService)
  const handleUploadMaterialSubmit = async (data: {
    title: string;
    subjectName: string;
    format: 'png' | 'word' | 'pdf' | 'text';
    fileName?: string;
    textContent?: string;
  }) => {
    setErrorMsg('');
    try {
      const subjectMatch = catalogSubjects.find(
        (s) => s.name.toLowerCase() === (data.subjectName || '').toLowerCase()
      );
      const ext =
        data.format === 'word' ? '.docx' : data.format === 'png' ? '.png' : data.format === 'pdf' ? '.pdf' : '.md';

      const created = await notesService.createNote({
        title: data.title,
        subject_id: subjectMatch?.id || null,
        subject_name: data.subjectName || offeredSubjects[0]?.subject?.name || 'Materia General',
        summary: data.textContent ? data.textContent.slice(0, 220) : `Material de apoyo compartido (${data.format.toUpperCase()})`,
        content_markdown: data.textContent || `Documento de apoyo académico: **${data.title}**`,
        content_html: `<p>${data.textContent || `Documento de apoyo académico: ${data.title}`}</p>`,
        source_type: data.format === 'text' ? 'editor' : 'upload',
        file_name: data.fileName || `${data.title.toLowerCase().replace(/\s+/g, '_')}${ext}`,
        file_extension: ext,
        visibility: 'public',
        is_draft: false,
      });

      const newMat: TutorUploadedMaterial = {
        id: created.id,
        title: created.title,
        subjectName: created.subjectName || data.subjectName || 'Materia General',
        format: data.format,
        fileName: created.fileName || data.fileName,
        textContent: data.textContent,
        uploadedAt: 'Recién publicado',
      };

      setMaterials((prev) => [newMat, ...prev]);
      setSuccessMsg('¡Apunte publicado exitosamente en la Biblioteca de Apuntes y disponible para tus estudiantes!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'No fue posible guardar el apunte en el servidor.');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    setErrorMsg('');
    try {
      await notesService.deleteNote(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setSuccessMsg('El apunte ha sido eliminado.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'No fue posible eliminar el apunte.');
    }
  };

  // Filtrado de sesiones del tutor y del estudiante
  const pendingRequests = tutorSessions.filter((s) => s.status === 'pending');
  const confirmedSessions = tutorSessions.filter((s) => s.status === 'accepted');
  const activeStudentSessions = studentSessions.filter((s) => s.status === 'pending' || s.status === 'accepted');
  const historySessions = [
    ...tutorSessions.filter((s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'rejected'),
    ...studentSessions.filter((s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'rejected'),
  ].filter((session, index, self) => index === self.findIndex((t) => t.id === session.id));

  return (
    <div>
      {/* Cabecera del Panel de Tutor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#15803d',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: '#f0fdf4',
                padding: '3px 10px',
                borderRadius: '9999px',
                border: '1px solid #bbf7d0',
              }}
            >
              Aprendizaje Colaborativo
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>· Gestión de Sesiones, Solicitudes y Material</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
            Gestión de Tutorías y Apoyo Académico
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#475569', margin: 0, maxWidth: '720px' }}>
            En InterAula puedes recibir apoyo en materias desafiantes y enseñar aquellas que dominas. Gestiona tus solicitudes recibidas, tus sesiones como estudiante, talleres grupales y apuntes compartidos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsPublishTutoringModalOpen(true)}
            className="ia-btn-primary"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              borderColor: '#15803d',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '0.86rem',
              fontWeight: 700,
            }}
          >
            <PlusIcon size={16} color="#ffffff" />
            <span>+ Publicar Tutoría</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className="ia-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              fontSize: '0.86rem',
              fontWeight: 700,
            }}
          >
            <PlusIcon size={16} />
            <span>+ Subir Apunte o Guía</span>
          </button>

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
              padding: '9px 18px',
              fontSize: '0.86rem',
              fontWeight: 700,
            }}
          >
            <VideoIcon size={16} color="#ffffff" />
            <span>+ Programar Taller Grupal</span>
          </button>
        </div>
      </div>

      {/* Alertas globales */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircleIcon size={18} color="#b91c1c" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <CheckIcon size={18} color="#15803d" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Si el usuario NO es tutor aún, mostrar invitación con pasos */}
      {!isTutor && !loading && (
        <div
          className="ia-card"
          style={{
            padding: '32px 24px',
            marginBottom: '24px',
            border: '1.5px solid #bbf7d0',
            backgroundColor: '#f0fdf4',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#15803d',
                flexShrink: 0,
              }}
            >
              <ShieldCheckIcon size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#166534', margin: '0 0 6px 0' }}>
                Habilítate para ofrecer Apoyo Académico entre Pares o Certificarte como Tutor
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#15803d', margin: '0 0 16px 0', lineHeight: 1.5, maxWidth: '720px' }}>
                Puedes publicar una asignatura de apoyo colaborativo entre pares ahora mismo o acreditar formalmente tu dominio como Tutor Par Verificado en tu perfil.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsPublishTutoringModalOpen(true)}
                  className="ia-btn-primary"
                  style={{
                    padding: '9px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    background: '#16a34a',
                    borderColor: '#15803d',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <PlusIcon size={16} color="#ffffff" />
                  <span>Publicar Materia de Apoyo entre Pares</span>
                </button>
                <Link
                  to="/profile?tab=tutoring"
                  className="ia-btn-secondary"
                  style={{
                    padding: '9px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ShieldCheckIcon size={16} color="#15803d" />
                  <span>¿Cómo Certificarme como Tutor Verificado?</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pestañas del Panel */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        {/* Pestaña 1: Solicitudes Recibidas */}
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: activeTab === 'requests' ? '#2563eb' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'requests' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CalendarIcon size={18} color={activeTab === 'requests' ? '#2563eb' : '#64748b'} />
          <span>Solicitudes Recibidas ({pendingRequests.length})</span>
          {pendingRequests.length > 0 && (
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
              {pendingRequests.length} nuevas
            </span>
          )}
        </button>

        {/* Pestaña 2: Mis Tutorías Confirmadas */}
        <button
          type="button"
          onClick={() => setActiveTab('confirmed')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: activeTab === 'confirmed' ? '#16a34a' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'confirmed' ? '2px solid #16a34a' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <UsersIcon size={18} color={activeTab === 'confirmed' ? '#16a34a' : '#64748b'} />
          <span>Confirmadas como Tutor ({confirmedSessions.length})</span>
        </button>

        {/* Pestaña 3: Mis Solicitudes como Estudiante */}
        <button
          type="button"
          onClick={() => setActiveTab('student_sessions')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: activeTab === 'student_sessions' ? '#0284c7' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'student_sessions' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CalendarIcon size={18} color={activeTab === 'student_sessions' ? '#0284c7' : '#64748b'} />
          <span>Mis Solicitudes como Estudiante ({activeStudentSessions.length})</span>
        </button>

        {/* Pestaña 4: Historial y Evaluaciones */}
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: activeTab === 'history' ? '#475569' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #475569' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckIcon size={18} color={activeTab === 'history' ? '#475569' : '#64748b'} />
          <span>Historial ({historySessions.length})</span>
        </button>

        {/* Pestaña 5: Talleres Grupales */}
        <button
          type="button"
          onClick={() => setActiveTab('workshops')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
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
          <span>Talleres Grupales ({hostedWorkshops.length})</span>
        </button>

        {/* Pestaña 6: Materias que Imparto */}
        <button
          type="button"
          onClick={() => setActiveTab('offerings')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: activeTab === 'offerings' ? '#059669' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'offerings' ? '2px solid #059669' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpenIcon size={18} color={activeTab === 'offerings' ? '#059669' : '#64748b'} />
          <span>Materias que Imparto ({offeredSubjects.length})</span>
        </button>

        {/* Pestaña 7: Subir Apuntes y Recursos */}
        <button
          type="button"
          onClick={() => setActiveTab('materials')}
          style={{
            padding: '12px 16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: activeTab === 'materials' ? '#d97706' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'materials' ? '2px solid #d97706' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpenIcon size={18} color={activeTab === 'materials' ? '#d97706' : '#64748b'} />
          <span>Apuntes Publicados ({materials.length})</span>
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* 1. SOLICITUDES RECIBIDAS */}
      {activeTab === 'requests' && (
        <div>
          {loading ? (
            <div className="ia-card" style={{ padding: '50px 20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Cargando solicitudes de tutoría...</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '40px 20px' }}
                icon={<CalendarIcon size={32} color="#2563eb" />}
                title="No tienes solicitudes pendientes"
                description="Cuando un estudiante solicite tu apoyo en las materias que impartes, podrás revisar sus preferencias de aprendizaje, temas a reforzar y confirmar la sesión aquí."
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab('offerings')}
                    className="ia-btn-secondary"
                  >
                    Ver mis materias impartidas
                  </button>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {pendingRequests.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  role="tutor"
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
        </div>
      )}

      {/* 2. TUTORÍAS CONFIRMADAS COMO TUTOR */}
      {activeTab === 'confirmed' && (
        <div>
          {loading ? (
            <div className="ia-card" style={{ padding: '50px 20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Cargando sesiones confirmadas...</p>
            </div>
          ) : confirmedSessions.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '40px 20px' }}
                icon={<UsersIcon size={32} color="#16a34a" />}
                title="Sin tutorías confirmadas por impartir"
                description="Acepta solicitudes pendientes para programar y habilitar el Aula Colaborativa para tu compañero."
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {confirmedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  role="tutor"
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
        </div>
      )}

      {/* 3. MIS SOLICITUDES Y SESIONES COMO ESTUDIANTE */}
      {activeTab === 'student_sessions' && (
        <div>
          {loading ? (
            <div className="ia-card" style={{ padding: '50px 20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Cargando tus solicitudes como estudiante...</p>
            </div>
          ) : activeStudentSessions.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '40px 20px' }}
                icon={<CalendarIcon size={32} color="#0284c7" />}
                title="No tienes solicitudes activas como estudiante"
                description="Explora el directorio de tutores pares y solicita apoyo personalizado en las asignaturas que estás cursando."
                action={
                  <Link to="/tutoring" className="ia-btn-primary" style={{ textDecoration: 'none' }}>
                    Explorar Tutores y Asignaturas
                  </Link>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {activeStudentSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  role="student"
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
        </div>
      )}

      {/* 4. HISTORIAL COMPLETO Y EVALUACIONES */}
      {activeTab === 'history' && (
        <div>
          {loading ? (
            <div className="ia-card" style={{ padding: '50px 20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Cargando historial de sesiones...</p>
            </div>
          ) : historySessions.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '40px 20px' }}
                icon={<CheckIcon size={32} color="#475569" />}
                title="Aún no tienes sesiones en el historial"
                description="Aquí aparecerán tus sesiones completadas, canceladas o rechazadas, y podrás dejar evaluaciones constructivas a tus tutores."
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {historySessions.map((session) => {
                const sessionRole = session.tutor_id === user?.id ? 'tutor' : 'student';
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    role={sessionRole}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onCancel={handleCancelClick}
                    onComplete={handleComplete}
                    onReview={handleOpenReview}
                    actionLoading={actionLoading}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TALLERES GRUPALES QUE IMPARTO */}
      {activeTab === 'workshops' && (
        <div>
          {hostedWorkshops.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '40px 20px' }}
                icon={<VideoIcon size={32} color="#7c3aed" />}
                title="Aún no has creado talleres grupales"
                description="Como tutor puedes abrir aulas colaborativas para preparar certámenes o resolver ejercicios paso a paso con varios estudiantes a la vez."
                action={
                  <button
                    type="button"
                    onClick={() => setIsCreateWorkshopModalOpen(true)}
                    className="ia-btn-primary"
                    style={{ background: '#7c3aed', borderColor: '#6d28d9' }}
                  >
                    + Programar mi Primer Taller
                  </button>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {hostedWorkshops.map((w) => (
                <WorkshopCard
                  key={w.id}
                  workshop={w}
                  currentUserId={user?.id}
                  onEnroll={async () => {}}
                  onUnenroll={async () => {}}
                  onCancelWorkshop={handleCancelWorkshop}
                  onFinishWorkshop={handleFinishWorkshop}
                  onDeleteWorkshop={handleWorkshopDelete}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. MATERIAS QUE IMPARTO Y PUBLICAR TUTORÍAS */}
      {activeTab === 'offerings' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Materias y Asignaturas que Impartes ({offeredSubjects.length})
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0' }}>
                Estas asignaturas están publicadas en el directorio para que otros estudiantes puedan solicitarte sesiones de tutoría 1 a 1.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublishTutoringModalOpen(true)}
              className="ia-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '0.86rem',
                fontWeight: 700,
                background: '#16a34a',
                borderColor: '#15803d',
              }}
            >
              <PlusIcon size={16} color="#ffffff" />
              <span>+ Publicar Nueva Asignatura</span>
            </button>
          </div>

          {offeredSubjects.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '40px 20px' }}
                icon={<BookOpenIcon size={32} color="#16a34a" />}
                title="Aún no has publicado materias para enseñar"
                description="Selecciona del catálogo institucional las asignaturas que ya aprobaste para ofrecer apoyo académico a tus compañeros."
                action={
                  <button
                    type="button"
                    onClick={() => setIsPublishTutoringModalOpen(true)}
                    className="ia-btn-primary"
                    style={{ background: '#16a34a', borderColor: '#15803d' }}
                  >
                    + Publicar mi Primera Materia
                  </button>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {offeredSubjects.map((offered) => {
                const subName = offered.subject?.name || offered.subject_id;
                const subCategory = offered.subject?.category || 'Área General';

                return (
                  <div
                    key={offered.subject_id}
                    className="ia-card"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          {subCategory}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: offered.is_verified ? '#15803d' : '#1d4ed8',
                            background: offered.is_verified ? '#f0fdf4' : '#eff6ff',
                            border: `1px solid ${offered.is_verified ? '#bbf7d0' : '#bfdbfe'}`,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {offered.is_verified ? (
                            <>
                              <ShieldCheckIcon size={14} color="#15803d" />
                              <span>Tutor Par Verificado</span>
                            </>
                          ) : (
                            <span>Apoyo Académico entre Pares · Nivel {offered.level === 'advanced' ? 'Avanzado' : offered.level === 'intermediate' ? 'Intermedio' : 'Básico'}</span>
                          )}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                        {subName}
                      </h3>

                      {offered.description ? (
                        <p style={{ fontSize: '0.84rem', color: '#475569', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                          {offered.description}
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic', margin: '0 0 12px 0' }}>
                          Sin descripción personalizada.
                        </p>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>
                        ● Activa para solicitudes 1 a 1
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOfferedSubject(offered.subject_id)}
                        disabled={actionLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        Dejar de ofrecer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. SUBIR Y GESTIONAR APUNTES DEL TUTOR */}
      {activeTab === 'materials' && (
        <TutorMaterialsSection
          materials={materials}
          onUploadMaterial={handleUploadMaterialSubmit}
          onDeleteMaterial={handleDeleteMaterial}
          onDownload={(title) => {
            setSuccessMsg(`Descargando copia de "${title}"`);
            setTimeout(() => setSuccessMsg(''), 4000);
          }}
        />
      )}

      {/* Modal de Cancelación */}
      {sessionToCancel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div className="ia-card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>
              Cancelar Sesión de Tutoría
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '0 0 16px 0' }}>
              Indica el motivo de cancelación para notificar a tu compañero.
            </p>
            <textarea
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Ej: Incompatibilidad de horario de última hora..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                marginBottom: '16px',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSessionToCancel(null)}
                className="ia-btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.85rem' }}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="ia-btn-primary"
                style={{ background: '#dc2626', borderColor: '#b91c1c', padding: '7px 16px', fontSize: '0.85rem' }}
              >
                {actionLoading ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Evaluación */}
      {selectedSessionForReview && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          session={selectedSessionForReview}
          onSuccess={handleReviewSuccess}
        />
      )}

      {/* Modal de Crear Taller Grupal */}
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

      {/* Modal para Publicar Nueva Tutoría / Ofrecer Materia Directamente */}
      {isPublishTutoringModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="ia-card"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '26px',
              borderRadius: '16px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Publicar Asignatura de Tutoría
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '2px 0 0' }}>
                  Habilita una materia para recibir solicitudes directas de otros estudiantes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishTutoringModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handlePublishTutoringSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Asignatura a Impartir *
                </label>
                <select
                  required
                  value={pubSubjectId}
                  onChange={(e) => setPubSubjectId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="" disabled>Selecciona una asignatura del catálogo...</option>
                  <optgroup label="Ramos Críticos de Informática (Prioritarios)">
                    {catalogSubjects
                      .filter((s) => s.is_pilot)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          ⭐ {s.name} ({s.category || 'Informática'})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Todas las Asignaturas Disponibles">
                    {catalogSubjects
                      .filter((s) => !s.is_pilot)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.category || 'General'})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nivel de Dominio
                  </label>
                  <select
                    value={pubLevel}
                    onChange={(e: any) => setPubLevel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="intermediate">Intermedio (Aprobado)</option>
                    <option value="advanced">Avanzado (Distinción)</option>
                    <option value="basic">Básico</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Modalidad Preferida
                  </label>
                  <select
                    value={pubModality}
                    onChange={(e: any) => setPubModality(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="online">Online (Aula Virtual InterAula)</option>
                    <option value="in_person">Presencial en Sede</option>
                    <option value="hybrid">Híbrida (Online o Presencial)</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.84rem',
                  color: '#15803d',
                  fontWeight: 600,
                }}
              >
                <CheckIcon size={16} color="#15803d" />
                <span>Apoyo Académico 100% Gratuito y Solidario entre Pares</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Descripción de tu Metodología o Disponibilidad
                </label>
                <textarea
                  rows={3}
                  value={pubDescription}
                  onChange={(e) => setPubDescription(e.target.value)}
                  placeholder="ej: Apoyo paso a paso en resolución de ejercicios, dudas de laboratorio y preparación de certámenes. Ritmo pausado y ejemplos visuales..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsPublishTutoringModalOpen(false)}
                  className="ia-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pubSubmitting}
                  className="ia-btn-primary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: '#16a34a',
                    borderColor: '#15803d',
                  }}
                >
                  {pubSubmitting ? 'Publicando...' : 'Publicar Tutoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
