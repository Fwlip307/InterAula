import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profile.service';
import type {
  Profile,
  OfferedSubject,
  NeededSubject,
  ProfileSkill,
  ProfileProjectInterest,
  Subject,
} from '../types/profile';
import {
  BookOpenIcon,
  UsersIcon,
  CodeIcon,
  SparklesIcon,
  CalendarIcon,
  TargetIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  CheckIcon,
  XIcon,
  EditIcon,
} from '../components/common/Icons';
import EmptyState from '../components/common/EmptyState';
import { getUserDisplayName, formatTutoringDateTime, formatTutoringStatus } from '../utils/formatters';
import { tutoringService } from '../services/tutoring.service';
import type { TutoringSession } from '../types/tutoring';
import '../styles/dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [interests, setInterests] = useState<ProfileProjectInterest[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<TutoringSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      if (!user) return;
      try {
        setLoading(true);
        const [
          profileData,
          offeredData,
          neededData,
          skillsData,
          interestsData,
          subjectsData,
          studentSessions,
          tutorSessions,
        ] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
          profileService.getProfileSkills(user.id),
          profileService.getProfileProjectInterests(user.id),
          profileService.getSubjects(),
          tutoringService.getMySessionsAsStudent().catch(() => []),
          tutoringService.getMySessionsAsTutor().catch(() => []),
        ]);

        if (isMounted) {
          setProfile(profileData);
          setOfferedSubjects(offeredData);
          setNeededSubjects(neededData);
          setSkills(skillsData);
          setInterests(interestsData);
          setCatalogSubjects(subjectsData.slice(0, 8)); // Top 8 materias del catálogo real
          const activeSessions = [...(studentSessions || []), ...(tutorSessions || [])]
            .filter((s) => s.status === 'pending' || s.status === 'accepted')
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
          setUpcomingSessions(activeSessions);
        }
      } catch (err) {
        console.error('[Dashboard] Error al cargar datos de Supabase:', err);
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

  // Saludo dinámico según Requisito 4 mediante función centralizada
  const greetingName = getUserDisplayName(profile, user?.user_metadata, user?.email);

  return (
    <div>
      {/* Banner de Perfil Incompleto (Requisito 6) */}
      {!loading && profile && !profile.profile_completed && (
        <section className="ia-banner-alert">
          <div className="ia-banner-alert-content">
            <div className="ia-banner-alert-icon">
              <AlertCircleIcon size={22} color="#d97706" />
            </div>
            <div>
              <h3 className="ia-banner-alert-title">Completa tu perfil</h3>
              <p className="ia-banner-alert-text">
                Agrega tu información académica, materias, habilidades e intereses para aprovechar mejor InterAula.
              </p>
            </div>
          </div>
          <Link to="/profile/edit" className="ia-banner-alert-btn">
            <EditIcon size={16} color="#ffffff" />
            Completar perfil
          </Link>
        </section>
      )}

      {/* Cabecera Académica Principal */}
      <section className="ia-hero-banner">
        <div className="ia-hero-text">
          <h1>Panel de Aprendizaje · {greetingName}</h1>
          <p>
            Plataforma académica para tutorías entre pares, intercambio de conocimientos y proyectos de colaboración universitaria.
          </p>
        </div>
        <div className="ia-hero-actions">
          <button
            type="button"
            className="ia-btn-hero-primary"
            onClick={() => navigate('/tutoring')}
          >
            Buscar tutor
          </button>
          <button
            type="button"
            className="ia-btn-hero-secondary"
            onClick={() => navigate('/my-tutoring')}
          >
            Mis tutorías
          </button>
          <button
            type="button"
            className="ia-btn-hero-secondary"
            onClick={() => navigate('/profile/edit')}
          >
            Puedo enseñar
          </button>
        </div>
      </section>

      {/* Tarjetas de Métricas Reales del Sprint 1 (Requisito 5) */}
      <section className="ia-stats-grid">
        {/* Materias que puedo enseñar */}
        <div className="ia-stat-card">
          <div className="ia-stat-icon blue">
            <BookOpenIcon size={22} color="#2563eb" />
          </div>
          <div>
            <div className="ia-stat-value">{loading ? '...' : offeredSubjects.length}</div>
            <div className="ia-stat-label">Materias que puedo enseñar</div>
          </div>
        </div>

        {/* Materias en las que busco ayuda */}
        <div className="ia-stat-card">
          <div className="ia-stat-icon green">
            <UsersIcon size={22} color="#16a34a" />
          </div>
          <div>
            <div className="ia-stat-value">{loading ? '...' : neededSubjects.length}</div>
            <div className="ia-stat-label">Materias en las que busco ayuda</div>
          </div>
        </div>

        {/* Habilidades para proyectos */}
        <div className="ia-stat-card">
          <div className="ia-stat-icon amber">
            <CodeIcon size={22} color="#d97706" />
          </div>
          <div>
            <div className="ia-stat-value">{loading ? '...' : skills.length}</div>
            <div className="ia-stat-label">Habilidades para proyectos</div>
          </div>
        </div>

        {/* Intereses de proyectos */}
        <div className="ia-stat-card">
          <div className="ia-stat-icon purple">
            <SparklesIcon size={22} color="#9333ea" />
          </div>
          <div>
            <div className="ia-stat-value">{loading ? '...' : interests.length}</div>
            <div className="ia-stat-label">Intereses de proyectos</div>
          </div>
        </div>
      </section>

      {/* Grilla de Contenido Principal */}
      <div className="ia-content-grid">
        {/* Columna Izquierda: Tutorías y Catálogo */}
        <div>
          {/* Próximas Tutorías (Sin datos ficticios) */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <CalendarIcon size={20} color="#2563eb" /> Próximas Tutorías Agendadas
              </h2>
              <Link to="/my-tutoring" className="ia-card-action">
                Ver todas
              </Link>
            </div>

            {/* Lista de Sesiones Activas o Estado Vacío */}
            {upcomingSessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcomingSessions.slice(0, 3).map((session) => {
                  const statusInfo = formatTutoringStatus(session.status);
                  const isTutorRole = session.tutor_id === user?.id;
                  const otherPerson = isTutorRole ? session.student : session.tutor;
                  const otherName = getUserDisplayName(otherPerson);

                  return (
                    <div
                      key={session.id}
                      style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                          {session.subject?.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {isTutorRole ? `Estudiante: ${otherName}` : `Tutor: ${otherName}`} • {formatTutoringDateTime(session.scheduled_at)}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          background: session.status === 'accepted' ? '#eff6ff' : '#fef3c7',
                          color: session.status === 'accepted' ? '#1d4ed8' : '#b45309',
                          border: `1px solid ${session.status === 'accepted' ? '#bfdbfe' : '#fde68a'}`,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  );
                })}

                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <Link to="/my-tutoring" className="ia-card-action" style={{ fontSize: '0.85rem' }}>
                    Ver todas las tutorías en Mis Tutorías
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<CalendarIcon size={26} color="#94a3b8" />}
                title="Aún no tienes tutorías agendadas"
                description="Explora los tutores pares disponibles en la comunidad o indica qué materias puedes enseñar para que otros estudiantes te contacten."
                action={
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link to="/tutoring" className="ia-btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      Explorar Tutorías
                    </Link>
                    <Link to="/profile/edit" className="ia-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      Gestionar Materias
                    </Link>
                  </div>
                }
              />
            )}
          </div>

          {/* Asignaturas Disponibles en Catálogo Real */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <TargetIcon size={20} color="#2563eb" /> Materias Disponibles en InterAula
              </h2>
              <Link to="/tutoring" className="ia-card-action">
                Explorar catálogo
              </Link>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 14px 0' }}>
              Catálogo oficial de asignaturas para intercambio académico entre estudiantes:
            </p>
            {catalogSubjects.length > 0 ? (
              <div className="ia-tags-cloud">
                {catalogSubjects.map((sub) => (
                  <span
                    key={sub.id}
                    className="ia-tag"
                    onClick={() => navigate('/tutoring')}
                    title={`Ver estudiantes y tutores en ${sub.name}`}
                  >
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
        </div>

        {/* Columna Derecha: Estado de Cuenta Híbrido y Avisos */}
        <div>
          {/* Estado de Cuenta Híbrido (Requisito 1 - Sin roles globales ficticios) */}
          <div className="ia-card">
            <div className="ia-card-header" style={{ marginBottom: '14px' }}>
              <h2 className="ia-card-title">
                <ShieldCheckIcon size={20} color="#16a34a" /> Estado de Cuenta
              </h2>
              <Link to="/profile/edit" className="ia-card-action" title="Editar preferencias">
                Configurar
              </Link>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Correo:</span>{' '}
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

              {/* Disponibilidades Reales del Perfil */}
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Disponibilidad de Colaboración
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.84rem', color: '#334155' }}>Para tutorías:</span>
                    {profile?.available_for_tutoring ? (
                      <span className="ia-badge ia-badge-success">
                        <CheckIcon size={12} /> Disponible
                      </span>
                    ) : (
                      <span className="ia-badge ia-badge-neutral">
                        <XIcon size={12} /> No disponible
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.84rem', color: '#334155' }}>Para proyectos:</span>
                    {profile?.available_for_projects ? (
                      <span className="ia-badge ia-badge-blue">
                        <CheckIcon size={12} /> Disponible
                      </span>
                    ) : (
                      <span className="ia-badge ia-badge-neutral">
                        <XIcon size={12} /> No disponible
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Acciones Académicas Reales */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <TargetIcon size={18} color="#2563eb" /> Acciones Rápidas
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to="/tutoring"
                className="ia-btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.88rem' }}
              >
                <BookOpenIcon size={16} /> Buscar tutor de asignatura
              </Link>
              <Link
                to="/my-tutoring"
                className="ia-btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.88rem' }}
              >
                <CalendarIcon size={16} /> Mis solicitudes y sesiones
              </Link>
              <Link
                to="/profile/edit"
                className="ia-btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.88rem' }}
              >
                <EditIcon size={16} /> Actualizar asignaturas y nivel
              </Link>
              <Link
                to="/projects"
                className="ia-btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: '0.88rem' }}
              >
                <UsersIcon size={16} /> Hub de Proyectos estudiantiles
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
