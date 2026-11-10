import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profile.service';
import type {
  Profile,
  OfferedSubject,
  NeededSubject,
  Subject,
} from '../types/profile';
import {
  BookOpenIcon,
  SparklesIcon,
  CalendarIcon,
  TargetIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  CheckIcon,
  XIcon,
  EditIcon,
  SearchIcon,
  ArrowLeftIcon,
  VideoIcon,
  BriefcaseIcon,
  CompassIcon,
  MessageSquareIcon,
  SlidersIcon,
} from '../components/common/Icons';
import EmptyState from '../components/common/EmptyState';
import { getUserDisplayName, formatTutoringDateTime, formatTutoringStatus } from '../utils/formatters';
import { tutoringService } from '../services/tutoring.service';
import { projectService } from '../services/project.service';
import { learningSpaceService } from '../services/learningSpace.service';
import type { TutoringSession } from '../types/tutoring';
import type { Project } from '../types/project';
import type { LearningSpaceOverview } from '../types/learningSpace';
import '../styles/dashboard.css';
import ForYouSection from '../components/recommendations/ForYouSection';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<TutoringSession[]>([]);
  const [openProjects, setOpenProjects] = useState<Project[]>([]);
  const [learningOverview, setLearningOverview] = useState<LearningSpaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      if (!user) return;
      try {
        setLoading(true);
        setLoadError('');
        const [
          profileData,
          offeredData,
          neededData,
          subjectsData,
          studentSessions,
          tutorSessions,
          projectsData,
          spaceData,
        ] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
          profileService.getSubjects(),
          tutoringService.getMySessionsAsStudent().catch(() => []),
          tutoringService.getMySessionsAsTutor().catch(() => []),
          projectService.getProjects().catch(() => []),
          learningSpaceService.getOverview().catch(() => null),
        ]);

        if (isMounted) {
          setProfile(profileData);
          setOfferedSubjects(offeredData);
          setNeededSubjects(neededData);
          setCatalogSubjects(subjectsData.slice(0, 8));
          setOpenProjects(projectsData.filter((p) => p.status === 'open' || p.status === 'recruiting').slice(0, 3));
          setLearningOverview(spaceData);
          const activeSessions = [...(studentSessions || []), ...(tutorSessions || [])]
            .filter((s) => s.status === 'pending' || s.status === 'accepted')
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
          setUpcomingSessions(activeSessions);
        }
      } catch (err) {
        console.error('[Dashboard] Error al cargar datos:', err);
        if (isMounted) setLoadError('No se pudieron cargar todos los datos del portal. Reintenta en unos instantes.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Nombre de saludo dinámico
  const greetingName = getUserDisplayName(profile, user?.user_metadata, user?.email);

  // Frase horaria de cortesía
  const getGreetingPhrase = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const verifiedCount = offeredSubjects.filter((s) => s.is_verified).length;
  const isVerifiedTutor = verifiedCount > 0;

  return (
    <div>
      {loadError && <p role="alert" className="ia-assessment-error">{loadError} <button type="button" className="ia-btn-secondary" onClick={() => window.location.reload()}>Reintentar</button></p>}
      {/* Barra de Acceso Rápido al Inicio Principal y Estado de Tutor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <Link
          to="/"
          className="ia-btn-secondary ia-btn-sm"
        >
          <ArrowLeftIcon size={14} />
          <span>Presentación de InterAula</span>
        </Link>

        {/* Botón de certificación para el Dashboard */}
        {!isVerifiedTutor ? (
          <Link
            to="/profile?tab=tutoring"
            className="ia-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              backgroundColor: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#065f46',
              textDecoration: 'none',
              borderRadius: '8px',
            }}
          >
            <ShieldCheckIcon size={16} color="#059669" />
            <span>¿Cómo Certificarme como Tutor?</span>
          </Link>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#166534',
              borderRadius: '8px',
            }}
          >
            <CheckIcon size={14} color="#16a34a" />
            <span>Tutor Verificado Oficial</span>
          </div>
        )}
      </div>

      {/* Banner de Perfil Incompleto */}
      {!loading && profile && !profile.profile_completed && (
        <section className="ia-banner-alert">
          <div className="ia-banner-alert-content">
            <div className="ia-banner-alert-icon">
              <AlertCircleIcon size={22} color="#d97706" />
            </div>
            <div>
              <h3 className="ia-banner-alert-title">Completa tu perfil universitario</h3>
              <p className="ia-banner-alert-text">
                Registra tu institución, carrera, asignaturas de interés y habilidades para recibir recomendaciones precisas.
              </p>
            </div>
          </div>
          <Link to="/profile?edit=true" className="ia-banner-alert-btn">
            <EditIcon size={16} color="#ffffff" />
            Completar perfil
          </Link>
        </section>
      )}

      {/* HERO DE BIENVENIDA - Página de Inicio Académica */}
      <section className="ia-welcome-hero">
        <div className="ia-welcome-hero-content">
          <div className="ia-welcome-hero-greeting">
            <p className="ia-welcome-hero-time">{getGreetingPhrase()} · InterAula: Aprender juntos, a nuestra manera</p>
            <h1 className="ia-welcome-hero-name">{greetingName}</h1>
            <p className="ia-welcome-hero-desc">
              {profile?.career && profile?.institution
                ? `Estudiante de ${profile.career} en ${profile.institution}. Tu espacio colaborativo, accesible e interdisciplinario para solicitar tutorías, compartir conocimientos y formar equipos.`
                : 'Tu espacio de aprendizaje colaborativo, inclusivo e interdisciplinario. Solicita apoyo a tu propio ritmo, comparte lo que sabes y participa en proyectos.'}
            </p>

            {/* Badges de estado integrados en el Hero */}
            <div className="ia-portal-meta-badges">
              <div className="ia-portal-badge">
                <CompassIcon size={14} color="#2563eb" />
                <span>
                  {loading
                    ? 'Cargando...'
                    : `${learningOverview?.paths?.length || 0} ruta${(learningOverview?.paths?.length || 0) === 1 ? '' : 's'} de aprendizaje`}
                </span>
              </div>
              <div className="ia-portal-badge">
                <CalendarIcon size={14} color="#2563eb" />
                <span>{loading ? 'Cargando...' : `${upcomingSessions.length} tutoría${upcomingSessions.length === 1 ? '' : 's'} agendada${upcomingSessions.length === 1 ? '' : 's'}`}</span>
              </div>
              <div className="ia-portal-badge">
                <BookOpenIcon size={14} color="#16a34a" />
                <span>{loading ? '...' : `${offeredSubjects.length} materia${offeredSubjects.length === 1 ? '' : 's'} impartida${offeredSubjects.length === 1 ? '' : 's'}`}</span>
              </div>
              {verifiedCount > 0 && (
                <div className="ia-portal-badge" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#15803d' }}>
                  <ShieldCheckIcon size={14} color="#16a34a" />
                  <span>{`${verifiedCount} acreditada${verifiedCount === 1 ? '' : 's'}`}</span>
                </div>
              )}
            </div>
          </div>

          <div className="ia-welcome-hero-cta">
            <button
              type="button"
              className="ia-welcome-cta-primary"
              onClick={() => navigate('/learning-space')}
            >
              <CompassIcon size={18} color="#ffffff" />
              Mi espacio de aprendizaje
            </button>
            <button
              type="button"
              className="ia-welcome-cta-secondary"
              onClick={() => navigate('/tutoring')}
            >
              <SearchIcon size={18} />
              Explorar tutorías
            </button>
          </div>
        </div>
      </section>

      <ForYouSection key={user?.id} />

      {/* MÓDULOS DE ACCESO RÁPIDO (4 Columnas) */}
      <section className="ia-quick-access-4">
        {/* Módulo 1: Mi espacio de aprendizaje */}
        <div
          className="ia-quick-card"
          onClick={() => navigate('/learning-space')}
          role="button"
          tabIndex={0}
        >
          <div className="ia-quick-card-icon blue">
            <CompassIcon size={24} color="#2563eb" />
          </div>
          <div className="ia-quick-card-body">
            <h3>Mi espacio de aprendizaje</h3>
            <p>Rutas paso a paso, explicaciones adaptables y tareas a tu ritmo</p>
          </div>
          <ArrowLeftIcon size={18} color="#94a3b8" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
        </div>

        {/* Módulo 2: Explorar Tutorías */}
        <div
          className="ia-quick-card"
          onClick={() => navigate('/tutoring')}
          role="button"
          tabIndex={0}
        >
          <div className="ia-quick-card-icon green">
            <BookOpenIcon size={24} color="#16a34a" />
          </div>
          <div className="ia-quick-card-body">
            <h3>Tutorías colaborativas</h3>
            <p>Busca tutores pares o coordina tus sesiones programadas</p>
          </div>
          <ArrowLeftIcon size={18} color="#94a3b8" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
        </div>

        {/* Módulo 3: Acreditación como Tutor */}
        <div
          className="ia-quick-card"
          onClick={() => navigate('/profile?tab=tutoring')}
          role="button"
          tabIndex={0}
        >
          <div className="ia-quick-card-icon amber">
            <ShieldCheckIcon size={24} color="#d97706" />
          </div>
          <div className="ia-quick-card-body">
            <h3>{offeredSubjects.length > 0 ? 'Materias que imparto' : 'Acreditarme como tutor'}</h3>
            <p>{offeredSubjects.length > 0 ? `${offeredSubjects.length} materia${offeredSubjects.length > 1 ? 's' : ''} registrada${offeredSubjects.length > 1 ? 's' : ''}` : 'Sube tu certificado o rinde la prueba con IA'}</p>
          </div>
          <ArrowLeftIcon size={18} color="#94a3b8" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
        </div>

        {/* Módulo 4: Hub de Proyectos */}
        <div
          className="ia-quick-card"
          onClick={() => navigate('/projects')}
          role="button"
          tabIndex={0}
        >
          <div className="ia-quick-card-icon purple">
            <BriefcaseIcon size={24} color="#7c3aed" />
          </div>
          <div className="ia-quick-card-body">
            <h3>Hub de Proyectos</h3>
            <p>Forma equipos, postula a vacantes o crea proyectos</p>
          </div>
          <ArrowLeftIcon size={18} color="#94a3b8" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
        </div>
      </section>

      {/* CONTENIDO PRINCIPAL ESTRUCTURADO */}
      <div className="ia-content-grid">
        {/* Columna Izquierda: Agenda de Actividades y Catálogo de Materias */}
        <div>
          {/* Próximas Tutorías Agendadas */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <CalendarIcon size={20} color="#2563eb" /> Próximas tutorías agendadas
              </h2>
              <Link to="/my-tutoring" className="ia-card-action">
                Ver todas las sesiones
              </Link>
            </div>

            {upcomingSessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingSessions.slice(0, 3).map((session) => {
                  const statusInfo = formatTutoringStatus(session.status);
                  const isTutorRole = session.tutor_id === user?.id;
                  const otherPerson = isTutorRole ? session.student : session.tutor;
                  const otherName = getUserDisplayName(otherPerson);

                  return (
                    <div
                      key={session.id}
                      style={{
                        padding: '16px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <BookOpenIcon size={20} color="#2563eb" />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                            {session.subject?.name}
                          </div>
                          <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '2px' }}>
                            {isTutorRole ? `Estudiante: ${otherName}` : `Tutor: ${otherName}`} · {formatTutoringDateTime(session.scheduled_at)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            background: session.status === 'accepted' ? '#eff6ff' : '#fef3c7',
                            color: session.status === 'accepted' ? '#1d4ed8' : '#b45309',
                            border: `1px solid ${session.status === 'accepted' ? '#bfdbfe' : '#fde68a'}`,
                            flexShrink: 0,
                          }}
                        >
                          {statusInfo.label}
                        </span>

                        {session.status === 'accepted' && (
                          <Link
                            to={`/tutoring/room/${session.id}`}
                            className="ia-btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <VideoIcon size={14} color="#ffffff" />
                            <span>Entrar al aula</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarIcon size={28} color="#94a3b8" />}
                title="Sin tutorías agendadas"
                description="Explora tutores acreditados en tus asignaturas para coordinar una sesión de estudio o habilítate para apoyar a otros compañeros."
                action={
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link to="/tutoring" className="ia-btn-primary" style={{ padding: '9px 18px', fontSize: '0.88rem' }}>
                      <SearchIcon size={16} color="#ffffff" />
                      Buscar tutorías
                    </Link>
                    <Link to="/profile?tab=tutoring" className="ia-btn-secondary" style={{ padding: '9px 18px', fontSize: '0.88rem' }}>
                      <ShieldCheckIcon size={16} />
                      Acreditarme como tutor
                    </Link>
                  </div>
                }
              />
            )}
          </div>

          {/* Materias Críticas Destacadas */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <TargetIcon size={20} color="#2563eb" /> Asignaturas clave para reforzar
              </h2>
              <Link to="/tutoring" className="ia-card-action">
                Explorar catálogo completo
              </Link>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Selecciona una asignatura para encontrar tutores pares disponibles o solicitar una sesión:
            </p>
            {catalogSubjects.length > 0 ? (
              <div className="ia-tags-cloud">
                {catalogSubjects.map((sub) => (
                  <span
                    key={sub.id}
                    className="ia-tag"
                    onClick={() => navigate(`/tutoring?subjectId=${sub.id}`)}
                    title={`Ver tutores y materiales para ${sub.name}`}
                    style={{ cursor: 'pointer', padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <BookOpenIcon size={14} color="#2563eb" style={{ marginRight: '6px' }} />
                    {sub.name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                Cargando asignaturas del catálogo...
              </p>
            )}
          </div>

          {/* Proyectos Interdisciplinarios Abiertos */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <BriefcaseIcon size={20} color="#7c3aed" /> Proyectos interdisciplinarios buscando equipo
              </h2>
              <Link to="/projects" className="ia-card-action">
                Ir al Hub de Proyectos
              </Link>
            </div>
            {openProjects.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {openProjects.map((proj) => (
                  <div
                    key={proj.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.94rem' }}>{proj.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                        {proj.category || 'Desarrollo'} · {(proj.positions || []).length} rol(es) publicados
                      </div>
                    </div>
                    <Link to="/projects" className="ia-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}>
                      Ver vacantes
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                Publica una iniciativa o postula a un equipo multidisciplinario en el{' '}
                <Link to="/projects" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                  Hub de Proyectos Interdisciplinarios
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Ficha del Estudiante y Resumen */}
        <div>
          {/* Ficha Universitaria */}
          <div className="ia-card">
            <div className="ia-card-header" style={{ marginBottom: '14px' }}>
              <h2 className="ia-card-title">
                <ShieldCheckIcon size={20} color="#16a34a" /> Mi ficha universitaria
              </h2>
              <Link to="/profile" className="ia-card-action" title="Ver perfil público">
                Ver perfil
              </Link>
            </div>

            <div style={{ fontSize: '0.88rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Correo institucional:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{user?.email}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b' }}>Institución:</span>{' '}
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {profile?.institution || 'No especificada'}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b' }}>Carrera:</span>{' '}
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {profile?.career || 'No especificada'}
                </span>
              </div>

              <div className="ia-dropdown-divider" style={{ margin: '4px 0' }} />

              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Estado como Tutor
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.84rem', color: '#334155' }}>Disponibilidad:</span>
                  {profile?.available_for_tutoring && offeredSubjects.length > 0 ? (
                    <span className="ia-badge ia-badge-success">
                      <CheckIcon size={12} /> Habilitado
                    </span>
                  ) : (
                    <span className="ia-badge ia-badge-neutral">
                      <XIcon size={12} /> {offeredSubjects.length === 0 ? 'Sin materias' : 'Inactivo'}
                    </span>
                  )}
                </div>
              </div>

              {neededSubjects.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Materias donde busco apoyo ({neededSubjects.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {neededSubjects.slice(0, 3).map((ns) => (
                      <span
                        key={ns.subject_id}
                        style={{
                          fontSize: '0.76rem',
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        {ns.subject?.name}
                      </span>
                    ))}
                    {neededSubjects.length > 3 && (
                      <span style={{ fontSize: '0.76rem', color: '#64748b', alignSelf: 'center' }}>
                        +{neededSubjects.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <Link
                to="/profile?edit=true"
                className="ia-btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
              >
                <EditIcon size={14} /> Editar mis datos académicos
              </Link>
            </div>
          </div>

          {/* Tarjeta visual de Comunidad y Mi espacio de aprendizaje */}
          <div className="ia-card" style={{ padding: 0, overflow: 'hidden' }}>
            <img
              src="/images/academic/comunidad-campus.jpg"
              alt="Comunidad de estudiantes universitarios en el campus"
              loading="lazy"
              style={{ width: '100%', height: '145px', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '16px 18px' }}>
              <span className="badge badge--primary" style={{ marginBottom: '8px' }}>
                <CompassIcon size={13} /> Aprender juntos, a nuestra manera
              </span>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '0.96rem', color: 'var(--ia-text-main)' }}>
                {learningOverview?.paths && learningOverview.paths.length > 0
                  ? `Continúa tu ruta: ${learningOverview.paths[0].title}`
                  : 'Configura tu espacio de aprendizaje adaptativo'}
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'var(--ia-text-muted)', lineHeight: 1.45 }}>
                {learningOverview?.paths && learningOverview.paths.length > 0
                  ? `Avance actual: ${learningOverview.paths[0].progress_percent}% · ${learningOverview.tasks.filter((t) => t.status !== 'completed').length} tarea(s) activa(s).`
                  : 'Divide tus asignaturas en etapas pequeñas, cambia el modo de explicación y organiza tus sesiones sin estrés.'}
              </p>
              <Link to="/learning-space" className="ia-btn-primary ia-btn-sm" style={{ width: '100%' }}>
                <CompassIcon size={14} />
                <span>Abrir Mi espacio de aprendizaje</span>
              </Link>
            </div>
          </div>

          {/* Accesos Rápidos a Recursos, Foro y Accesibilidad */}
          <div className="ia-card" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
            <h2 className="ia-card-title" style={{ marginBottom: '12px', fontSize: '0.98rem' }}>
              <SparklesIcon size={18} color="#2563eb" /> Herramientas y Accesibilidad
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link to="/learning-space" className="ia-btn-secondary" style={{ justifyContent: 'flex-start', textDecoration: 'none', fontSize: '0.84rem', gap: '8px' }}>
                <CompassIcon size={15} color="#2563eb" />
                <span>Mi espacio de aprendizaje</span>
              </Link>
              <Link to="/resources" className="ia-btn-secondary" style={{ justifyContent: 'flex-start', textDecoration: 'none', fontSize: '0.84rem', gap: '8px' }}>
                <BookOpenIcon size={15} color="#2563eb" />
                <span>Biblioteca y Editor de Apuntes</span>
              </Link>
              <Link to="/forum" className="ia-btn-secondary" style={{ justifyContent: 'flex-start', textDecoration: 'none', fontSize: '0.84rem', gap: '8px' }}>
                <MessageSquareIcon size={15} color="#2563eb" />
                <span>Foro Académico Colaborativo</span>
              </Link>
              <Link to="/settings" className="ia-btn-secondary" style={{ justifyContent: 'flex-start', textDecoration: 'none', fontSize: '0.84rem', gap: '8px' }}>
                <SlidersIcon size={15} color="#2563eb" />
                <span>Accesibilidad, Modo Calma y Preferencias</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
