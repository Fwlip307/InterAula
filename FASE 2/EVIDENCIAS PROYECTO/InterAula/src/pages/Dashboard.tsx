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
  MegaphoneIcon,
  AlertCircleIcon,
  CheckIcon,
  XIcon,
  EditIcon,
} from '../components/common/Icons';
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
        ] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
          profileService.getProfileSkills(user.id),
          profileService.getProfileProjectInterests(user.id),
          profileService.getSubjects(),
        ]);

        if (isMounted) {
          setProfile(profileData);
          setOfferedSubjects(offeredData);
          setNeededSubjects(neededData);
          setSkills(skillsData);
          setInterests(interestsData);
          setCatalogSubjects(subjectsData.slice(0, 8)); // Top 8 materias del catálogo real
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

  // Saludo dinámico según Requisito 4
  const greetingName =
    profile?.first_name ||
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Estudiante';

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

      {/* Banner de Bienvenida Principal */}
      <section className="ia-hero-banner">
        <div className="ia-hero-text">
          <h1>¡Hola, {greetingName}!</h1>
          <p>
            Bienvenido al portal de <strong>InterAula</strong>. Conecta con tutores pares, colabora en proyectos multidisciplinarios y potencia tu aprendizaje universitario.
          </p>
        </div>
        <div className="ia-hero-actions">
          <button
            type="button"
            className="ia-btn-hero-primary"
            onClick={() => navigate('/tutoring')}
          >
            Buscar Tutoría
          </button>
          <button
            type="button"
            className="ia-btn-hero-secondary"
            onClick={() => navigate('/profile/edit')}
          >
            Ofrecer Materias
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

            {/* Estado Vacío Conectado (Requisito 3) */}
            <div className="ia-empty-box">
              <div className="ia-empty-icon">
                <CalendarIcon size={26} color="#94a3b8" />
              </div>
              <h3 className="ia-empty-title">Aún no tienes tutorías agendadas</h3>
              <p className="ia-empty-desc">
                Explora los tutores pares disponibles en la comunidad o indica qué materias puedes enseñar para que otros estudiantes te contacten.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/tutoring" className="ia-btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Explorar Tutorías
                </Link>
                <Link to="/profile/edit" className="ia-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Gestionar Materias
                </Link>
              </div>
            </div>
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

          {/* Avisos Académicos (Requisito 3 - Estado transparente) */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '16px' }}>
              <MegaphoneIcon size={20} color="#d97706" /> Avisos Académicos
            </h2>
            <div className="ia-notice-list">
              <div className="ia-notice-item">
                <h3 className="ia-notice-title">Bienvenido al Sprint 1 de InterAula</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
                  Ya puedes configurar tus materias de tutoría y habilidades de proyectos en tu perfil.
                </p>
                <span className="ia-notice-date">Hoy</span>
              </div>

              <div className="ia-notice-item" style={{ borderLeftColor: '#16a34a' }}>
                <h3 className="ia-notice-title">Próximamente: Tablón Comunitario</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
                  Espacio en desarrollo para avisos universitarios y grupos de estudio por sede.
                </p>
                <span className="ia-notice-date">Módulo en desarrollo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
