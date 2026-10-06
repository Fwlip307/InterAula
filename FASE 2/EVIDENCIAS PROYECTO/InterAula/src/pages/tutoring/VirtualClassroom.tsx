import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tutoringService } from '../../services/tutoring.service';
import { isCertifiedAccount } from '../../services/profile.service';
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
  AwardIcon,
  SparklesIcon,
  HelpCircleIcon,
  XIcon,
} from '../../components/common/Icons';
import ReviewModal from './components/ReviewModal';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

// Banco Pedagógico de Desafíos y Quizzes en Vivo (Materias Críticas de Informática)
interface QuizChallenge {
  id: string;
  subjectCategory: string;
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado';
  question: string;
  codeSnippet?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const INFORMATICS_QUIZ_BANK: QuizChallenge[] = [
  {
    id: 'algo-1',
    subjectCategory: 'Programación de Algoritmos',
    difficulty: 'Básico',
    question: '¿Qué valor imprimirá en consola este bloque de código?',
    codeSnippet: `total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)`,
    options: ['3', '6', '10', '4'],
    correctIndex: 1,
    explanation: 'El bucle for en range(1, 4) recorre 1, 2 y 3 (excluye el 4). La suma es 1 + 2 + 3 = 6.',
  },
  {
    id: 'algo-2',
    subjectCategory: 'Programación de Algoritmos',
    difficulty: 'Básico',
    question: '¿Cuál es la causa principal de que un bucle "while" se vuelva infinito?',
    options: [
      'Declarar la variable antes del bucle',
      'Olvidar actualizar la variable de control que hace falsa la condición',
      'Utilizar una variable de tipo entero',
      'Imprimir mensajes dentro del cuerpo del bucle',
    ],
    correctIndex: 1,
    explanation: 'Un bucle while evalúa su condición en cada ciclo; si ninguna instrucción modifica las variables evaluadas hacia un estado falso, nunca termina.',
  },
  {
    id: 'web-1',
    subjectCategory: 'Programación Web',
    difficulty: 'Básico',
    question: '¿Qué método previene la recarga automática de la página al enviar un formulario en JS?',
    codeSnippet: `const handleSubmit = (event) => {\n  event.????();\n  enviarDatos();\n};`,
    options: ['event.stopPropagation()', 'event.preventDefault()', 'event.stop()', 'event.cancel()'],
    correctIndex: 1,
    explanation: 'event.preventDefault() cancela la acción por defecto del navegador de recargar la página tras el submit.',
  },
  {
    id: 'web-2',
    subjectCategory: 'Programación Web',
    difficulty: 'Intermedio',
    question: 'En JavaScript moderno (ES6+), ¿cuál es la principal diferencia entre "const" y "let"?',
    options: [
      'const no permite reasignar el identificador a otro valor en memoria',
      'const solo se puede usar con números y let con strings',
      'let tiene alcance global obligatorio y const no',
      'const se ejecuta de forma asíncrona',
    ],
    correctIndex: 0,
    explanation: 'Las variables declaradas con const crean una referencia inmutable por reasignación (=). let sí permite reasignar.',
  },
  {
    id: 'db-1',
    subjectCategory: 'Modelamiento y Bases de Datos',
    difficulty: 'Intermedio',
    question: '¿Qué cláusula de SQL permite filtrar grupos generados por la cláusula GROUP BY?',
    codeSnippet: `SELECT carrera_id, COUNT(*)\nFROM estudiantes\nGROUP BY carrera_id\n???? COUNT(*) >= 5;`,
    options: ['WHERE', 'HAVING', 'FILTER BY', 'ORDER BY'],
    correctIndex: 1,
    explanation: 'HAVING actúa sobre las filas agrupadas y funciones de agregación (COUNT, SUM, AVG). WHERE solo filtra filas individuales antes de agrupar.',
  },
  {
    id: 'db-2',
    subjectCategory: 'Modelamiento y Bases de Datos',
    difficulty: 'Básico',
    question: '¿Cuál es la restricción fundamental de una Llave Primaria (PRIMARY KEY) en una tabla relacional?',
    options: [
      'Solo permite valores positivos',
      'Garantiza unicidad en cada registro y prohíbe valores NULL',
      'Debe ser obligatoriamente de tipo VARCHAR',
      'Solo se puede consultar mediante INNER JOIN',
    ],
    correctIndex: 1,
    explanation: 'Una clave primaria identifica unívocamente cada fila y por integridad relacional nunca admite valores NULL.',
  },
  {
    id: 'poo-1',
    subjectCategory: 'Programación Orientada a Objetos',
    difficulty: 'Intermedio',
    question: '¿Qué principio de la POO consiste en ocultar el estado interno y obligar a interactuar mediante métodos?',
    options: ['Polimorfismo', 'Encapsulamiento', 'Herencia múltiple', 'Sobrecarga de operadores'],
    correctIndex: 1,
    explanation: 'El encapsulamiento protege los atributos de una clase declarándolos privados y proveyendo métodos públicos para su acceso y modificación.',
  },
  {
    id: 'math-1',
    subjectCategory: 'Nivelación Matemática',
    difficulty: 'Básico',
    question: 'En lógica proposicional y tablas de verdad, ¿cuándo es Verdadera una conjunción (P ∧ Q)?',
    options: [
      'Cuando al menos una de las proposiciones es verdadera',
      'Únicamente cuando tanto P como Q son verdaderas',
      'Cuando ambas proposiciones son falsas',
      'Cuando P es verdadera y Q es falsa',
    ],
    correctIndex: 1,
    explanation: 'La conjunción lógica (AND / ∧) requiere que todas sus partes sean verdaderas simultáneamente para dar como resultado verdadero.',
  },
];

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
  // Estados de Pestañas y Panel
  const [activeSideTab, setActiveSideTab] = useState<'pedagogy' | 'quiz' | 'attendance' | 'notes'>('pedagogy');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  // Estados para Concentración y Ritmo de Estudio Adaptativo
  const [flexibleCommunication, setFlexibleCommunication] = useState(false);
  const [sensoryBreakActive, setSensoryBreakActive] = useState(false);
  const [sensoryBreakSeconds, setSensoryBreakSeconds] = useState(180);

  // Estados para Dinámica Interactiva y Mini-Quiz en Vivo
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const [quizCategoryFilter, setQuizCategoryFilter] = useState<string>('all');
  const [showTutorSolution, setShowTutorSolution] = useState(false);

  // Modal de evaluación final y control de finalización de clase
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishingClass, setFinishingClass] = useState(false);
  const [classFinishedByTutor, setClassFinishedByTutor] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback silencioso
    }
  };

  // Temporizador para pausa sensorial de bajo estímulo (3 min)
  useEffect(() => {
    if (!sensoryBreakActive) return;
    const timer = setInterval(() => {
      setSensoryBreakSeconds((prev) => {
        if (prev <= 1) {
          setSensoryBreakActive(false);
          return 180;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sensoryBreakActive]);

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
        try {
          const workshopData = await tutoringService.getWorkshopById(sessionId);
          setWorkshop(workshopData);
          setAttendanceVerified(true);
          setStudentConnected(true);
          setTutorConnected(true);
          return;
        } catch {
          // Fallback dinámico: sala en vivo compartida
          const safeRoomCode = `ia-aula-${sessionId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
          const dynamicWs: TutoringWorkshop = {
            id: sessionId,
            tutor_id: user?.id || 'live-host',
            subject_id: '00000000-0000-4000-8000-000000000001',
            title: 'Clase en Vivo InterAula',
            description: 'Sala de clase en vivo y ayudantía compartida',
            scheduled_at: new Date().toISOString(),
            duration_minutes: 60,
            max_students: 50,
            room_id: safeRoomCode,
            status: 'in_progress',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            enrollments_count: 1,
            is_enrolled: true,
          };
          setWorkshop(dynamicWs);
          setAttendanceVerified(true);
          setStudentConnected(true);
          setTutorConnected(true);
        }
      }
    } catch (err: any) {
      console.error('[VirtualClassroom] Error cargando aula virtual:', err);
      setError(err?.message || 'No fue posible acceder a la sesión o taller de tutoría');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const isWorkshop = Boolean(workshop);
  const isStudent = isWorkshop
    ? user?.id !== workshop?.tutor_id
    : user?.id === session?.student_id;
  const isTutor = isWorkshop
    ? Boolean(
        user &&
          (user.id === workshop?.tutor_id ||
            workshop?.tutor_id === 'live-host' ||
            isCertifiedAccount(user.email) ||
            user.email === 'kendokaponijereklein@gmail.com' ||
            user.email === 'lukasdonoso1911@gmail.com')
      )
    : user?.id === session?.tutor_id;

  const currentSubject = isWorkshop ? workshop?.subject : session?.subject;
  const classroomTitle = isWorkshop ? workshop?.title : (currentSubject?.name || 'Materia de Tutoría');
  const expectedDuration = isWorkshop ? (workshop?.duration_minutes || 60) : (session?.duration_minutes || 60);

  const otherPerson = session ? (isStudent ? session.tutor : session.student) : workshop?.tutor;
  const otherRoleName = isWorkshop ? (isTutor ? 'Estudiantes' : 'Tutor / Expositor') : (isStudent ? 'Tutor' : 'Estudiante');
  const otherDisplayName = isWorkshop
    ? (isTutor ? `${workshop?.enrollments_count || 0} alumnos inscritos` : getUserDisplayName(workshop?.tutor))
    : (otherPerson ? getUserDisplayName(otherPerson) : 'Participante');

  // Identificador canónico de sala Jitsi: consistente para todos los participantes que ingresen a la misma URL
  const safeSessionCode = (sessionId || 'clase-en-vivo').toLowerCase().replace(/[^a-z0-9]/g, '');
  const roomId = workshop?.room_id || session?.room_id || `ia-aula-${safeSessionCode}`;

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
    if (loading || (!session && !workshop) || !jitsiContainerRef.current) return;
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

        const myDisplayName = user
          ? getUserDisplayName(
              isWorkshop
                ? (isTutor ? workshop?.tutor : undefined)
                : (isStudent ? session?.student : session?.tutor),
              user.user_metadata,
              user.email
            )
          : 'Compañero (Invitado)';

        const JITSI_DOMAIN = (import.meta.env.VITE_JITSI_DOMAIN as string) || 'meet.jit.si';
        const domain = JITSI_DOMAIN;
        const options = {
          roomName: roomId,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          userInfo: {
            displayName: myDisplayName,
            email: user?.email || '',
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

  // Detectar finalización de la clase por el tutor en tiempo real
  useEffect(() => {
    if (!workshop) return;
    const handleWorkshopUpdate = (e: any) => {
      const detail = e.detail;
      if (detail) {
        const matchesId =
          detail.id === workshop.id ||
          (workshop.room_id && (detail.id === workshop.room_id || detail.roomId === workshop.room_id));
        if (matchesId && (detail.status === 'completed' || detail.status === 'cancelled')) {
          if (!isTutor) {
            setClassFinishedByTutor(true);
          }
        }
      }
    };
    window.addEventListener('ia_workshops_updated', handleWorkshopUpdate);
    return () => window.removeEventListener('ia_workshops_updated', handleWorkshopUpdate);
  }, [workshop, isTutor]);

  // Finalizar la clase para todos los participantes (Acción exclusiva del Tutor)
  const handleFinishClass = async () => {
    setFinishingClass(true);
    try {
      if (workshop) {
        await tutoringService.updateWorkshopStatus(workshop.id, 'completed');
        if (workshop.room_id && workshop.room_id !== workshop.id) {
          try {
            await tutoringService.updateWorkshopStatus(workshop.room_id, 'completed');
          } catch {}
        }
        setShowFinishConfirm(false);
        setShowExitConfirm(false);
        navigate('/tutoring');
        return;
      }

      if (session) {
        const minutes = Math.max(Math.floor(elapsedSeconds / 60), 1);
        await tutoringService.registerClassroomAttendance(session.id, 'leave', minutes);
        await tutoringService.updateSessionStatus(session.id, 'completed');
        setShowFinishConfirm(false);
        setShowExitConfirm(false);
        navigate('/my-tutoring');
        return;
      }
    } catch (err: any) {
      console.error('[VirtualClassroom] Error al finalizar la clase:', err);
      navigate(workshop ? '/tutoring' : '/my-tutoring');
    } finally {
      setFinishingClass(false);
    }
  };

  // Manejar salida del aula virtual
  const handleExitSession = async () => {
    if (session) {
      const minutes = Math.floor(elapsedSeconds / 60);
      await tutoringService.registerClassroomAttendance(session.id, 'leave', minutes);

      if (isStudent && session.status === 'accepted') {
        try {
          await tutoringService.updateSessionStatus(session.id, 'completed');
          setIsReviewModalOpen(true);
          setShowExitConfirm(false);
          return;
        } catch {}
      }
      navigate('/my-tutoring');
      return;
    }

    if (workshop) {
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
      {!user && (
        <div
          style={{
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            padding: '6px 20px',
            fontSize: '0.8rem',
            color: '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>Estás conectado como compañero invitado a esta clase en vivo.</span>
          <Link
            to="/login"
            state={{ from: window.location.pathname }}
            style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'none' }}
          >
            Iniciar sesión para registrar asistencia oficial
          </Link>
        </div>
      )}
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

          {/* Botón Copiar Enlace para invitar compañeros */}
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copiar enlace directo para invitar a tus compañeros a esta clase en vivo"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: copiedLink ? '#15803d' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {copiedLink ? <CheckIcon size={14} color="#ffffff" /> : <ExternalLinkIcon size={14} />}
            <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
          </button>

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

          {/* Si es Tutor: Botón de Finalizar Clase + Botón de Salir */}
          {isTutor ? (
            <>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(true)}
                title="Finalizar la clase en vivo para todos los participantes"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                }}
              >
                <CheckIcon size={14} /> Finalizar Clase
              </button>

              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                title="Salir del aula virtual"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#334155',
                  color: '#cbd5e1',
                  border: '1px solid #475569',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <button
              type="button"
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
          )}
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
                  padding: '9px 4px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'pedagogy' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'pedagogy' ? '#38bdf8' : '#94a3b8',
                  borderBottom: activeSideTab === 'pedagogy' ? '2px solid #38bdf8' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <BookOpenIcon size={13} />
                <span>Pauta & Foco</span>
              </button>
              <button
                onClick={() => setActiveSideTab('quiz')}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'quiz' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'quiz' ? '#f59e0b' : '#94a3b8',
                  borderBottom: activeSideTab === 'quiz' ? '2px solid #f59e0b' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <SparklesIcon size={13} color={activeSideTab === 'quiz' ? '#f59e0b' : '#94a3b8'} />
                <span>Quiz / Retos</span>
              </button>
              <button
                onClick={() => setActiveSideTab('attendance')}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'attendance' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'attendance' ? '#4ade80' : '#94a3b8',
                  borderBottom: activeSideTab === 'attendance' ? '2px solid #4ade80' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheckIcon size={13} color={activeSideTab === 'attendance' ? '#4ade80' : '#94a3b8'} />
                <span>Asistencia</span>
              </button>
              <button
                onClick={() => setActiveSideTab('notes')}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSideTab === 'notes' ? '#1e293b' : 'transparent',
                  color: activeSideTab === 'notes' ? '#a78bfa' : '#94a3b8',
                  borderBottom: activeSideTab === 'notes' ? '2px solid #a78bfa' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <MessageSquareIcon size={13} color={activeSideTab === 'notes' ? '#a78bfa' : '#94a3b8'} />
                <span>Apuntes</span>
              </button>
            </div>

            {/* Contenido de la pestaña activa */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {activeSideTab === 'pedagogy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* ALERTA DE PAUSA DE ASIMILACIÓN Y FOCO */}
                  {sensoryBreakActive && (
                    <div
                      style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '10px',
                        padding: '14px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
                        <SparklesIcon size={16} /> Pausa de Asimilación en Curso
                      </div>
                      <p style={{ margin: '0 0 10px', color: '#cbd5e1', fontSize: '0.76rem', lineHeight: 1.4 }}>
                        Breve pausa para asimilar conceptos, descansar la vista y retomar la atención. La sesión se mantiene activa.
                      </p>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginBottom: '10px' }}>
                        {Math.floor(sensoryBreakSeconds / 60).toString().padStart(2, '0')}:{(sensoryBreakSeconds % 60).toString().padStart(2, '0')}
                      </div>
                      <button
                        onClick={() => {
                          setSensoryBreakActive(false);
                          setSensoryBreakSeconds(180);
                        }}
                        className="ia-btn ia-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                      >
                        Reanudar Clase Ahora
                      </button>
                    </div>
                  )}

                  {/* HERRAMIENTAS DE CONCENTRACIÓN Y RITMO GUIADO */}
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <SparklesIcon size={14} /> Modo Concentración y Calma
                      </span>
                      {!sensoryBreakActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setSensoryBreakSeconds(180);
                            setSensoryBreakActive(true);
                          }}
                          style={{
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                          title="Iniciar pausa de asimilación de 3 minutos para afianzar el aprendizaje"
                        >
                          Pausa 3 min
                        </button>
                      )}
                    </div>

                    {/* Toggle Comunicación Flexible */}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', color: '#cbd5e1' }}>
                      <input
                        type="checkbox"
                        checked={flexibleCommunication}
                        onChange={(e) => setFlexibleCommunication(e.target.checked)}
                        style={{ marginTop: '2px' }}
                      />
                      <span>
                        <strong>Modo Concentración:</strong> Participación preferente por chat (cámara y micrófono opcionales para mayor comodidad).
                      </span>
                    </label>

                    {flexibleCommunication && (
                      <div style={{ marginTop: '8px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', fontSize: '0.72rem', color: '#4ade80' }}>
                        Activo: Se solicita al tutor priorizar explicaciones secuenciales y dar tiempo para responder por chat o en el quiz.
                      </div>
                    )}
                  </div>

                  {/* AGENDA PREDECIBLE DE LA CLASE */}
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ClockIcon size={14} color="#38bdf8" /> Agenda Guiada por Fases (60 min)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                      {/* Fase 1 */}
                      <div
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: elapsedSeconds < 900 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                          borderLeft: `3px solid ${elapsedSeconds < 900 ? '#38bdf8' : '#22c55e'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#e2e8f0' }}>1. Detección de Dudas y Diagnóstico (0-15m)</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: elapsedSeconds < 900 ? '#38bdf8' : '#22c55e' }}>
                          {elapsedSeconds < 900 ? 'En curso' : 'Listo'}
                        </span>
                      </div>

                      {/* Fase 2 */}
                      <div
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: elapsedSeconds >= 900 && elapsedSeconds < 2100 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                          borderLeft: `3px solid ${elapsedSeconds >= 900 && elapsedSeconds < 2100 ? '#38bdf8' : elapsedSeconds >= 2100 ? '#22c55e' : '#64748b'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#e2e8f0' }}>2. Ejercicio Práctico en Código (15-35m)</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: elapsedSeconds >= 900 && elapsedSeconds < 2100 ? '#38bdf8' : elapsedSeconds >= 2100 ? '#22c55e' : '#64748b' }}>
                          {elapsedSeconds >= 900 && elapsedSeconds < 2100 ? 'En curso' : elapsedSeconds >= 2100 ? 'Listo' : 'Pendiente'}
                        </span>
                      </div>

                      {/* Fase 3 */}
                      <div
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: elapsedSeconds >= 2100 && elapsedSeconds < 3000 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                          borderLeft: `3px solid ${elapsedSeconds >= 2100 && elapsedSeconds < 3000 ? '#f59e0b' : elapsedSeconds >= 3000 ? '#22c55e' : '#64748b'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#e2e8f0' }}>3. Dinámica Interactiva y Quiz (35-50m)</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: elapsedSeconds >= 2100 && elapsedSeconds < 3000 ? '#f59e0b' : elapsedSeconds >= 3000 ? '#22c55e' : '#64748b' }}>
                          {elapsedSeconds >= 2100 && elapsedSeconds < 3000 ? 'En curso' : elapsedSeconds >= 3000 ? 'Listo' : 'Pendiente'}
                        </span>
                      </div>

                      {/* Fase 4 */}
                      <div
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: elapsedSeconds >= 3000 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                          borderLeft: `3px solid ${elapsedSeconds >= 3000 ? '#38bdf8' : '#64748b'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#e2e8f0' }}>4. Síntesis y Plan de Refuerzo (50-60m)</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: elapsedSeconds >= 3000 ? '#38bdf8' : '#64748b' }}>
                          {elapsedSeconds >= 3000 ? 'En curso' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>

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

              {/* PESTAÑA: QUIZ & RETOS EN VIVO (DINÁMICA INTERACTIVA DE COMPRENSIÓN) */}
              {activeSideTab === 'quiz' && (() => {
                const filteredQuestions = quizCategoryFilter === 'all'
                  ? INFORMATICS_QUIZ_BANK
                  : INFORMATICS_QUIZ_BANK.filter((q) => q.subjectCategory.toLowerCase().includes(quizCategoryFilter.toLowerCase()));
                
                const currentQuestion = filteredQuestions[quizQuestionIndex % (filteredQuestions.length || 1)] || INFORMATICS_QUIZ_BANK[0];
                const isCorrect = quizSelectedOption === currentQuestion.correctIndex;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Barra de Gamificación / Puntos */}
                    <div
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 700, fontSize: '0.82rem' }}>
                        <AwardIcon size={16} />
                        <span>{quizScore} pts acumulados</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        {quizCorrectCount} de {filteredQuestions.length} resueltas
                      </span>
                    </div>

                    {/* Filtro por Materia Crítica */}
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                        Filtrar por Materia Troncal:
                      </label>
                      <select
                        value={quizCategoryFilter}
                        onChange={(e) => {
                          setQuizCategoryFilter(e.target.value);
                          setQuizQuestionIndex(0);
                          setQuizSelectedOption(null);
                          setQuizSubmitted(false);
                          setShowTutorSolution(false);
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          padding: '6px 8px',
                          fontSize: '0.78rem',
                        }}
                      >
                        <option value="all">Todas las materias críticas</option>
                        <option value="Algoritmos">Programación de Algoritmos</option>
                        <option value="Web">Programación Web</option>
                        <option value="Bases de Datos">Modelamiento y Bases de Datos</option>
                        <option value="Objetos">Programación Orientada a Objetos</option>
                        <option value="Matemática">Nivelación Matemática</option>
                      </select>
                    </div>

                    {/* Tarjeta del Desafío Actual */}
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                          {currentQuestion.subjectCategory}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: currentQuestion.difficulty === 'Básico' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: currentQuestion.difficulty === 'Básico' ? '#4ade80' : '#fbbf24',
                          }}
                        >
                          {currentQuestion.difficulty}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700, lineHeight: 1.4 }}>
                        {currentQuestion.question}
                      </h4>

                      {/* Bloque de código si aplica */}
                      {currentQuestion.codeSnippet && (
                        <pre
                          style={{
                            backgroundColor: '#020617',
                            border: '1px solid #1e293b',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '0.75rem',
                            color: '#38bdf8',
                            fontFamily: 'monospace',
                            overflowX: 'auto',
                            marginBottom: '12px',
                          }}
                        >
                          <code>{currentQuestion.codeSnippet}</code>
                        </pre>
                      )}

                      {/* Opciones Interactivas */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {currentQuestion.options.map((opt, idx) => {
                          const isSelected = quizSelectedOption === idx;
                          const isThisCorrect = idx === currentQuestion.correctIndex;
                          let btnBg = '#1e293b';
                          let btnBorder = '#334155';
                          let btnColor = '#cbd5e1';

                          if (quizSubmitted) {
                            if (isThisCorrect) {
                              btnBg = 'rgba(34, 197, 94, 0.2)';
                              btnBorder = '#22c55e';
                              btnColor = '#4ade80';
                            } else if (isSelected && !isThisCorrect) {
                              btnBg = 'rgba(239, 68, 68, 0.2)';
                              btnBorder = '#ef4444';
                              btnColor = '#f87171';
                            }
                          }

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={quizSubmitted}
                              onClick={() => {
                                setQuizSelectedOption(idx);
                                setQuizSubmitted(true);
                                if (idx === currentQuestion.correctIndex) {
                                  setQuizScore((prev) => prev + 100);
                                  setQuizCorrectCount((prev) => prev + 1);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                backgroundColor: btnBg,
                                border: `1px solid ${btnBorder}`,
                                color: btnColor,
                                cursor: quizSubmitted ? 'default' : 'pointer',
                                textAlign: 'left',
                                fontSize: '0.78rem',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: '#0f172a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: '#94a3b8',
                                  flexShrink: 0,
                                }}
                              >
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span style={{ flex: 1 }}>{opt}</span>
                              {quizSubmitted && isThisCorrect && <CheckIcon size={14} color="#4ade80" />}
                              {quizSubmitted && isSelected && !isThisCorrect && <XIcon size={14} color="#f87171" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explicación Pedagógica Inmediata */}
                      {(quizSubmitted || showTutorSolution) && (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '10px',
                            borderRadius: '6px',
                            backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            border: `1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            fontSize: '0.76rem',
                          }}
                        >
                          <div style={{ fontWeight: 700, color: isCorrect ? '#4ade80' : '#fbbf24', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HelpCircleIcon size={14} />
                            <span>{isCorrect ? '¡Excelente razonamiento! (+100 pts)' : 'Pauta Pedagógica:'}</span>
                          </div>
                          <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.4 }}>
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      )}

                      {/* Controles de Navegación de Pregunta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1e293b' }}>
                        {isTutor && (
                          <button
                            type="button"
                            onClick={() => setShowTutorSolution(!showTutorSolution)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            {showTutorSolution ? 'Ocultar Pauta' : 'Ver Pauta Docente'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setQuizQuestionIndex((prev) => prev + 1);
                            setQuizSelectedOption(null);
                            setQuizSubmitted(false);
                            setShowTutorSolution(false);
                          }}
                          className="ia-btn ia-btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 12px', marginLeft: 'auto' }}
                        >
                          Siguiente Desafío
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

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

      {/* 3. MODAL DE CONFIRMACIÓN PARA FINALIZAR CLASE (TUTOR) */}
      {showFinishConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
        >
          <div
            className="ia-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              border: '1px solid #ef4444',
              padding: '26px',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <AlertCircleIcon size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  ¿Finalizar la Clase en Vivo?
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Tiempo transcurrido: {formatTimer(elapsedSeconds)}
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Esta acción concluirá la sesión académica para todos los estudiantes conectados y actualizará el estado del taller a completado en InterAula.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(false)}
                disabled={finishingClass}
                className="ia-btn ia-btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Continuar en clase
              </button>
              <button
                type="button"
                onClick={handleFinishClass}
                disabled={finishingClass}
                className="ia-btn"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '8px 18px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {finishingClass ? 'Finalizando...' : 'Finalizar Clase para Todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL DE CONFIRMACIÓN DE SALIDA */}
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
              maxWidth: '460px',
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
                ? isTutor
                  ? ' Como anfitrión, puedes salir dejando la sala disponible para los alumnos, o dar la clase por terminada definitivamente.'
                  : ' Podrás volver a ingresar en cualquier momento mientras el taller continúe activo.'
                : isStudent && session?.status === 'accepted'
                ? ' Al salir, la sesión se registrará como completada y podrás evaluar el desempeño pedagógico del tutor.'
                : ' Tu asistencia quedará registrada en el historial de la sesión.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="ia-btn ia-btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Permanecer en clase
              </button>

              {isTutor && isWorkshop && (
                <button
                  type="button"
                  onClick={handleFinishClass}
                  disabled={finishingClass}
                  className="ia-btn"
                  style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '8px 16px', fontWeight: 700 }}
                >
                  Finalizar para Todos
                </button>
              )}

              <button
                type="button"
                onClick={handleExitSession}
                className="ia-btn"
                style={{
                  backgroundColor: isTutor && isWorkshop ? '#334155' : '#dc2626',
                  color: '#ffffff',
                  padding: '8px 16px',
                  fontWeight: 700,
                  border: isTutor && isWorkshop ? '1px solid #475569' : 'none',
                }}
              >
                {isTutor && isWorkshop ? 'Solo Salir' : 'Salir y Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL CUANDO EL TUTOR FINALIZA LA CLASE (PARA ESTUDIANTES) */}
      {classFinishedByTutor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div
            className="ia-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              padding: '28px',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                margin: '0 auto 16px',
              }}
            >
              <CheckIcon size={28} />
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
              La clase en vivo ha finalizado
            </h3>

            <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5 }}>
              El tutor ha concluido esta sesión académica grupal. Muchas gracias por tu asistencia y participación en el Aula Virtual de InterAula.
            </p>

            <button
              type="button"
              onClick={() => navigate('/tutoring')}
              className="ia-btn ia-btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.9rem', fontWeight: 800 }}
            >
              Volver a Tutorías
            </button>
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
