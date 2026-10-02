import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tutoringService } from '../../services/tutoring.service';
import type { TutoringSession, TutoringWorkshop } from '../../types/tutoring';
import { getUserDisplayName, formatTutoringDuration } from '../../utils/formatters';
import {
  ArrowLeftIcon,
  VideoIcon,
  ClockIcon,
  CheckIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  MessageSquareIcon,
  LoaderIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  UsersIcon,
} from '../../components/common/Icons';
import ReviewModal from './components/ReviewModal';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function VirtualClassroom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<TutoringSession | null>(null);
  const [workshop, setWorkshop] = useState<TutoringWorkshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Jitsi y Videollamada
  const [jitsiLoading, setJitsiLoading] = useState(true);
  const [jitsiError, setJitsiError] = useState<string | null>(null);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const jitsiInitializedRoomRef = useRef<string | null>(null);

  // Estados de Asistencia y Conexión
  const [studentConnected, setStudentConnected] = useState(false);
  const [tutorConnected, setTutorConnected] = useState(false);
  const [attendanceVerified, setAttendanceVerified] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notesText, setNotesText] = useState('');
  const [activeSideTab, setActiveSideTab] = useState<'pedagogy' | 'attendance' | 'notes'>('pedagogy');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  // Modal de evaluación final
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Cargar sesión o taller grupal desde la base de datos
  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setError('Identificador de sala o sesión no especificado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Intentar primero como sesión 1 a 1
      try {
        const data = await tutoringService.getSessionById(sessionId);
        setSession(data);

        if (data.student_joined_at) setStudentConnected(true);
        if (data.tutor_joined_at) setTutorConnected(true);
        if (data.attendance_verified || (data.student_joined_at && data.tutor_joined_at)) {
          setAttendanceVerified(true);
        }
        if (data.actual_duration_minutes) {
          setElapsedSeconds(data.actual_duration_minutes * 60);
        }
        return;
      } catch {
        // Si no es sesión individual, intentar como taller / clase grupal
        const workshopData = await tutoringService.getWorkshopById(sessionId);
        setWorkshop(workshopData);
        setAttendanceVerified(true);
        setStudentConnected(true);
        setTutorConnected(true);
      }
    } catch (err: any) {
      console.error('[VirtualClassroom] Error cargando aula virtual:', err);
      setError(err?.message || 'No fue posible acceder a la sesión o taller de tutoría');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const isWorkshop = Boolean(workshop);
  const isStudent = isWorkshop
    ? user?.id !== workshop?.tutor_id
    : user?.id === session?.student_id;
  const isTutor = isWorkshop
    ? user?.id === workshop?.tutor_id
    : user?.id === session?.tutor_id;

  const currentSubject = isWorkshop ? workshop?.subject : session?.subject;
  const classroomTitle = isWorkshop ? workshop?.title : (currentSubject?.name || 'Materia de Tutoría');
  const expectedDuration = isWorkshop ? (workshop?.duration_minutes || 60) : (session?.duration_minutes || 60);

  const otherPerson = session ? (isStudent ? session.tutor : session.student) : workshop?.tutor;
  const otherRoleName = isWorkshop ? (isTutor ? 'Estudiantes' : 'Tutor / Expositor') : (isStudent ? 'Tutor' : 'Estudiante');
  const otherDisplayName = isWorkshop
    ? (isTutor ? `${workshop?.enrollments_count || 0} alumnos inscritos` : getUserDisplayName(workshop?.tutor))
    : (otherPerson ? getUserDisplayName(otherPerson) : 'Participante');

  // Identificador canónico de sala Jitsi
  const roomId = isWorkshop
    ? (workshop?.room_id || `ia-taller-${sessionId?.replace(/-/g, '').slice(0, 12)}`)
    : (session?.room_id || (sessionId ? `ia-aula-${sessionId.replace(/-/g, '').slice(0, 12)}` : 'interaula-sala'));

  // Limpieza al desmontar el componente (salir definitivamente del aula)
  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
          jitsiApiRef.current = null;
        } catch {
          // Dispose silencioso
        }
      }
      jitsiInitializedRoomRef.current = null;
    };
  }, []);

  // Inicializar Jitsi Meet (única vez por sala)
  useEffect(() => {
    if (loading || (!session && !workshop) || !user || !jitsiContainerRef.current) return;
    if (!roomId) return;

    // Evitar re-instanciar si ya está conectada esta misma sala
    if (jitsiInitializedRoomRef.current === roomId && jitsiApiRef.current) {
      return;
    }

    let isMounted = true;

    const initJitsi = () => {
      try {
        if (!window.JitsiMeetExternalAPI) {
          throw new Error('El script de Jitsi Meet no se cargó correctamente');
        }

        // Limpiar contenedor por si existía instancia previa
        if (jitsiContainerRef.current) {
          jitsiContainerRef.current.innerHTML = '';
        }

        const myDisplayName = getUserDisplayName(
          isWorkshop
            ? (isTutor ? workshop?.tutor : undefined)
            : (isStudent ? session?.student : session?.tutor),
          user.user_metadata,
          user.email
        );

        const JITSI_DOMAIN = (import.meta.env.VITE_JITSI_DOMAIN as string) || 'meet.jit.si';
        const domain = JITSI_DOMAIN;
        const options = {
          roomName: roomId,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          userInfo: {
            displayName: myDisplayName,
            email: user.email || '',
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            prejoinConfig: {
              enabled: false,
            },
            disableDeepLinking: true,
            enableClosePage: false,
            disableThirdPartyRequests: false,
            defaultLanguage: 'es',
            // Prevenir suspensión y desconexión al cambiar de pestaña en Opera GX / Chrome
            disableSuspend: true,
            enableLayerSuspension: false,
            channelLastN: -1,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'desktop',
              'chat',
              'raisehand',
              'videoquality',
              'whiteboard',
              'tileview',
              'fullscreen',
              'hangup',
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Compañero InterAula',
          },
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        jitsiApiRef.current = api;
        jitsiInitializedRoomRef.current = roomId;

        // Registrar asistencia de entrada
        api.addEventListener('videoConferenceJoined', () => {
          if (!isMounted) return;
          setJitsiLoading(false);

          if (isStudent) setStudentConnected(true);
          if (isTutor) setTutorConnected(true);

          if (session?.id) {
            tutoringService.registerClassroomAttendance(session.id, 'join').then((res) => {
              if (res && res.attendance_verified) {
                setAttendanceVerified(true);
              }
            });
          }
        });

        // Detectar entrada de la contraparte
        api.addEventListener('participantJoined', () => {
          if (!isMounted) return;
          if (isStudent) setTutorConnected(true);
          if (isTutor) setStudentConnected(true);
          setAttendanceVerified(true);
        });

        // Evento cuando cuelga la llamada en Jitsi
        api.addEventListener('readyToClose', () => {
          if (!isMounted) return;
          setShowExitConfirm(true);
        });

        setJitsiLoading(false);
      } catch (err: any) {
        console.error('[VirtualClassroom] Error al instanciar Jitsi:', err);
        if (isMounted) {
          setJitsiError('No fue posible cargar el aula virtual integrada en este navegador.');
          setJitsiLoading(false);
        }
      }
    };

    // Cargar script dinámicamente si no existe
    if (!window.JitsiMeetExternalAPI) {
      const activeDomain = (import.meta.env.VITE_JITSI_DOMAIN as string) || 'meet.jit.si';
      const script = document.createElement('script');
      script.src = `https://${activeDomain}/external_api.js`;
      script.async = true;
      script.onload = () => {
        if (isMounted) initJitsi();
      };
      script.onerror = () => {
        if (isMounted) {
          setJitsiError('No se pudo establecer conexión con el servidor de videollamada.');
          setJitsiLoading(false);
        }
      };
      document.body.appendChild(script);
    } else {
      initJitsi();
    }

    return () => {
      isMounted = false;
    };
  }, [loading, session, workshop, user, isStudent, isTutor, roomId, isWorkshop]);

  // Temporizador de duración en vivo y heartbeat cada 60s
  useEffect(() => {
    if (loading || (!session && !workshop)) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // Cada 60 segundos mandar heartbeat a base de datos si es sesión 1 a 1
        if (next % 60 === 0 && session?.id) {
          const minutes = Math.floor(next / 60);
          tutoringService.registerClassroomAttendance(session.id, 'heartbeat', minutes);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, session, workshop]);

  // Formatear segundos a HH:MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Manejar salida de la sesión
  const handleExitSession = async () => {
    if (session) {
      const minutes = Math.floor(elapsedSeconds / 60);
      await tutoringService.registerClassroomAttendance(session.id, 'leave', minutes);

      // Si es el estudiante y la sesión aún no estaba completada
      if (isStudent && session.status === 'accepted') {
        try {
          await tutoringService.updateSessionStatus(session.id, 'completed');
          setIsReviewModalOpen(true);
          setShowExitConfirm(false);
          return;
        } catch {
          // Si no se puede completar aún, redirigir
        }
      }
      navigate('/my-tutoring');
      return;
    }

    if (workshop) {
      if (isTutor && workshop.status === 'scheduled') {
        try {
          await tutoringService.updateWorkshopStatus(workshop.id, 'completed');
        } catch {
          // Continuar
        }
      }
      navigate('/tutoring');
      return;
    }

    navigate('/my-tutoring');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '16px' }}>
        <LoaderIcon size={36} color="#2563eb" style={{ animation: 'ia-spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 600 }}>Cargando Aula Virtual de InterAula...</p>
      </div>
    );
  }

  if (error || (!session && !workshop)) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '32px', textAlign: 'center' }} className="ia-card">
        <AlertCircleIcon size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          No fue posible acceder al Aula Virtual
        </h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>{error || 'Sesión no encontrada o sin permisos suficientes.'}</p>
        <Link to="/my-tutoring" className="ia-btn ia-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeftIcon size={16} /> Volver a Mis Tutorías
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 72px)',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* 1. BARRA SUPERIOR INSTITUCIONAL DEL AULA VIRTUAL */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 20,
        }}
      >
        {/* Lado izquierdo: Botón volver + Materia + Categoría */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setShowExitConfirm(true)}
            title="Salir del aula"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <ArrowLeftIcon size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: isWorkshop ? '#7c3aed' : '#2563eb',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <VideoIcon size={12} /> {isWorkshop ? 'Taller Grupal en Vivo' : 'Aula Virtual'}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                {classroomTitle}
              </h1>
              {isTutor && (
                <span
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    fontWeight: 700,
                  }}
                >
                  Moderador / Anfitrión
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              {isWorkshop
                ? `Impartido por ${getUserDisplayName(workshop?.tutor)} • ${workshop?.enrollments_count || 0} estudiantes inscritos`
                : `Sesión entre ${getUserDisplayName(session?.tutor)} (Tutor) y ${getUserDisplayName(session?.student)} (Estudiante)`}
            </p>
          </div>
        </div>

        {/* Centro: Temporizador en vivo + Certificación de asistencia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Contador de tiempo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              padding: '6px 14px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#38bdf8',
            }}
          >
            <ClockIcon size={16} color="#38bdf8" />
            <span>{formatTimer(elapsedSeconds)}</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
              / {formatTutoringDuration(expectedDuration)}
            </span>
          </div>

          {/* Sello de Auditoría de Asistencia */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: attendanceVerified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              color: attendanceVerified ? '#4ade80' : '#facc15',
              border: `1px solid ${attendanceVerified ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
            }}
          >
            {isWorkshop ? (
              <>
                <UsersIcon size={16} color="#4ade80" />
                <span>Sala Abierta • {workshop?.enrollments_count || 0} Cupos Ocupados</span>
              </>
            ) : attendanceVerified ? (
              <>
                <ShieldCheckIcon size={16} color="#4ade80" />
                <span>Asistencia Auditada en Tiempo Real</span>
              </>
            ) : (
              <>
                <ClockIcon size={16} color="#facc15" />
                <span>Esperando a ambos participantes</span>
              </>
            )}
          </div>
        </div>

        {/* Lado derecho: Indicadores de participantes + Botón Panel + Salir */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Chip de participantes */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.78rem',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: otherRoleName === 'Tutor' ? (tutorConnected ? '#22c55e' : '#64748b') : (studentConnected ? '#22c55e' : '#64748b'),
              }}
            />
            <span style={{ color: '#cbd5e1' }}>{otherDisplayName} ({otherRoleName})</span>
          </div>

          {/* Botón Abrir en Pestaña Independiente */}
          <a
            href={`https://${(import.meta.env.VITE_JITSI_DOMAIN as string) || 'meet.jit.si'}/${roomId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir videollamada en pestaña independiente para compartir pantalla o programar sin interrupciones"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <ExternalLinkIcon size={14} />
            <span>Pestaña Externa</span>
          </a>

          {/* Toggle Panel Lateral */}
          <button
            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: isSidePanelOpen ? '#2563eb' : '#334155',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <BookOpenIcon size={14} />
            <span>{isSidePanelOpen ? 'Ocultar Pauta' : 'Ver Pauta y Notas'}</span>
          </button>

          {/* Botón Salir / Terminar */}
          <button
            onClick={() => setShowExitConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            Salir de la Clase
          </button>
        </div>
      </header>

      {/* 2. ÁREA PRINCIPAL: VIDEOLLAMADA + PANEL LATERAL */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Contenedor Jitsi Meet */}
        <div
          style={{
            flex: 1,
            height: '100%',
            position: 'relative',
            backgroundColor: '#020617',
          }}
        >
          {jitsiLoading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                backgroundColor: '#020617',
                zIndex: 10,
              }}
            >
              <LoaderIcon size={40} color="#38bdf8" style={{ animation: 'ia-spin 1s linear infinite' }} />
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 600 }}>
                Conectando al Aula Virtual encriptada...
              </p>
            </div>
          )}

          {jitsiError ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <AlertCircleIcon size={48} color="#f59e0b" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>{jitsiError}</h2>
              <p style={{ color: '#94a3b8', maxWidth: '480px', fontSize: '0.9rem' }}>
                Puedes unirte directamente a la sala de videollamada institucional en una pestaña externa:
              </p>
              <a
                href={`https://meet.jit.si/${roomId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ia-btn ia-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <ExternalLinkIcon size={16} /> Abrir Sala Virtual en Pestaña Directa
              </a>
            </div>
          ) : (
            <div
              ref={jitsiContainerRef}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          )}
        </div>

        {/* Panel Lateral Pedagógico y de Apuntes */}
        {isSidePanelOpen && (
          <aside
            style={{
              width: '340px',
              backgroundColor: '#1e293b',
              borderLeft: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 15,
            }}
          >
            {/* Pestañas del Panel */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #334155',
                backgroundColor: '#0f172a',
              }}
            >
              <button
                onClick={() => setActiveSideTab('pedagogy')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'pedagogy' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'pedagogy' ? '#38bdf8' : '#94a3b8',
                  borderBottom: activeSideTab === 'pedagogy' ? '2px solid #38bdf8' : 'none',
                }}
              >
                Pedagogía
              </button>
              <button
                onClick={() => setActiveSideTab('attendance')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'attendance' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'attendance' ? '#38bdf8' : '#94a3b8',
                  borderBottom: activeSideTab === 'attendance' ? '2px solid #38bdf8' : 'none',
                }}
              >
                Asistencia
              </button>
              <button
                onClick={() => setActiveSideTab('notes')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'notes' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'notes' ? '#38bdf8' : '#94a3b8',
                  borderBottom: activeSideTab === 'notes' ? '2px solid #38bdf8' : 'none',
                }}
              >
                Apuntes
              </button>
            </div>

            {/* Contenido de la pestaña activa */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {activeSideTab === 'pedagogy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {isWorkshop ? (
                    <>
                      {/* Guía para el Expositor/Moderador de la sala */}
                      {isTutor && (
                        <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '12px', borderRadius: '8px' }}>
                          <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                            Rol: Expositor y Moderador
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                            Haz clic en el botón azul <strong>&quot;Iniciar sesión&quot;</strong> dentro de la videollamada para identificarte como moderador con tu cuenta (Google/GitHub). Al autenticarte, la conferencia comenzará de inmediato y todos los estudiantes inscritos entrarán directo a tu clase.
                          </p>
                        </div>
                      )}

                      {/* Pauta / Objetivos del taller grupal */}
                      <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700 }}>
                          <BookOpenIcon size={14} /> Temario y Pauta del Taller
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {workshop?.description || 'El expositor no especificó temario adicional.'}
                        </p>
                      </div>

                      {/* Reglas de convivencia en taller */}
                      <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', padding: '12px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa' }}>
                          Pauta de Convivencia Virtual
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.76rem', color: '#bfdbfe', lineHeight: 1.4 }}>
                          <li>Mantén tu micrófono silenciado mientras el expositor habla.</li>
                          <li>Utiliza el botón de levantar la mano para pedir la palabra.</li>
                          <li>Comparte tus dudas o código en el chat de la videollamada.</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Temas a reforzar */}
                      <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700 }}>
                          <MessageSquareIcon size={14} /> Temas a reforzar
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {session?.notes || 'No se registraron notas previas para esta sesión.'}
                        </p>
                      </div>

                      {/* Preferencias de Aprendizaje del estudiante */}
                      <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#a78bfa', fontSize: '0.82rem', fontWeight: 700 }}>
                          <BookOpenIcon size={14} /> Preferencias del Estudiante
                        </div>
                        {session?.student?.learning_preferences && session.student.learning_preferences.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {session.student.learning_preferences.map((pref, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: '0.78rem',
                                  backgroundColor: '#1e293b',
                                  color: '#cbd5e1',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  borderLeft: '3px solid #a78bfa',
                                }}
                              >
                                {pref}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                            El estudiante aún no ha configurado preferencias metodológicas específicas.
                          </p>
                        )}
                      </div>

                      {/* Recomendación didáctica para el tutor */}
                      <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', padding: '12px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa' }}>
                          Pauta Didáctica InterAula
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.76rem', color: '#bfdbfe', lineHeight: 1.4 }}>
                          Dedica los primeros 10 minutos a entender las dudas concretas, resuelve un ejercicio guiado en conjunto y deja los últimos 10 minutos para comprobar que el estudiante puede resolverlo por su cuenta.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeSideTab === 'attendance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {isWorkshop ? (
                    <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Estudiantes Inscritos</span>
                        <span style={{ color: '#38bdf8' }}>{workshop?.enrollments_count || 0} / {workshop?.max_students}</span>
                      </h4>
                      {workshop?.enrollments && workshop.enrollments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                          {workshop.enrollments.map((enr) => {
                            const name = getUserDisplayName(enr.student);
                            return (
                              <div
                                key={enr.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  backgroundColor: '#1e293b',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <CheckIcon size={14} color="#4ade80" />
                                <div>
                                  <div style={{ color: '#f8fafc', fontWeight: 600 }}>{name}</div>
                                  {enr.student?.career && (
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{enr.student.career}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                          Aún no hay inscripciones registradas para este taller.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                        Registro de Conexión
                      </h4>

                      {/* Estudiante */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Estudiante:</span>
                        <span style={{ color: studentConnected ? '#4ade80' : '#facc15', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {studentConnected ? <CheckIcon size={14} /> : null}
                          {studentConnected ? 'Conectado' : 'Pendiente'}
                        </span>
                      </div>

                      {/* Tutor */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Tutor:</span>
                        <span style={{ color: tutorConnected ? '#4ade80' : '#facc15', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {tutorConnected ? <CheckIcon size={14} /> : null}
                          {tutorConnected ? 'Conectado' : 'Pendiente'}
                        </span>
                      </div>

                      {/* Auditoría */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #334155', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Estado de Validez:</span>
                        <span style={{ color: attendanceVerified ? '#4ade80' : '#facc15', fontWeight: 800 }}>
                          {attendanceVerified ? 'Certificada' : 'En proceso'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    <ShieldCheckIcon size={14} color="#38bdf8" style={{ marginRight: '4px' }} />
                    La permanencia en esta aula virtual queda auditada criptográficamente en Supabase para validar la asistencia real y habilitar la evaluación docente entre pares.
                  </div>
                </div>
              )}

              {activeSideTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                    Apuntes personales de la sesión:
                  </label>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Escribe aquí fórmulas, ideas clave o acuerdos de estudio..."
                    style={{
                      width: '100%',
                      minHeight: '260px',
                      backgroundColor: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(notesText);
                      alert('Apuntes copiados al portapapeles');
                    }}
                    disabled={!notesText.trim()}
                    className="ia-btn ia-btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    Copiar Apuntes
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 3. MODAL DE CONFIRMACIÓN DE SALIDA */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
              maxWidth: '440px',
              width: '100%',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              border: '1px solid #334155',
              padding: '24px',
              borderRadius: '12px',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
              ¿Deseas salir del Aula Virtual?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Tiempo acumulado en la sesión: <strong>{formatTimer(elapsedSeconds)}</strong>.
              {isWorkshop
                ? ' Podrás volver a ingresar en cualquier momento mientras el taller continúe activo.'
                : isStudent && session?.status === 'accepted'
                ? ' Al salir, la sesión se registrará como completada y podrás evaluar el desempeño pedagógico del tutor.'
                : ' Tu asistencia quedará registrada en el historial de la sesión.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="ia-btn ia-btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Permanecer en clase
              </button>
              <button
                onClick={handleExitSession}
                className="ia-btn"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '8px 16px', fontWeight: 700 }}
              >
                Salir y Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL DE EVALUACIÓN DOCENTE POST-CLASE (Solo para el estudiante en sesiones 1 a 1) */}
      {isReviewModalOpen && session && (
        <ReviewModal
          session={session}
          isOpen={isReviewModalOpen}
          onClose={() => navigate('/my-tutoring')}
          onSuccess={() => {
            navigate('/my-tutoring');
          }}
        />
      )}
    </div>
  );
}
