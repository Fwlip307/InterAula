import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import type {
  Profile,
  OfferedSubject,
  NeededSubject,
  ProfileSkill,
  ProfileProjectInterest,
  AcademicLevel,
} from '../../types/profile';
import {
  EditIcon,
  BookOpenIcon,
  UsersIcon,
  BriefcaseIcon,
  CodeIcon,
  SparklesIcon,
  CheckIcon,
  XIcon,
  ExternalLinkIcon,
  MapPinIcon,
  GraduationCapIcon,
} from '../../components/common/Icons';

// Función para traducir los niveles académicos
const translateLevel = (level: AcademicLevel | null): string => {
  switch (level) {
    case 'basic':
      return 'Básico';
    case 'intermediate':
      return 'Intermedio';
    case 'advanced':
      return 'Avanzado';
    default:
      return 'Nivel no especificado';
  }
};

export default function ProfileView() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [interests, setInterests] = useState<ProfileProjectInterest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const [p, offered, needed, sk, int] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
          profileService.getProfileSkills(user.id),
          profileService.getProfileProjectInterests(user.id),
        ]);

        if (isMounted) {
          setProfile(p);
          setOfferedSubjects(offered);
          setNeededSubjects(needed);
          setSkills(sk);
          setInterests(int);
        }
      } catch (err) {
        console.error('[ProfileView] Error al cargar perfil:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b', fontSize: '1.05rem' }}>Cargando perfil de usuario...</p>
      </div>
    );
  }

  const fullName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile?.display_name || user?.email?.split('@')[0] || 'Estudiante';

  const initial = (fullName[0] || 'U').toUpperCase();
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div>
      {/* Cabecera del Perfil */}
      <section className="ia-profile-header-card">
        <div className="ia-profile-cover" />
        <div className="ia-profile-header-body">
          <div className="ia-profile-avatar-container">
            <div className="ia-profile-avatar-xl">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="ia-profile-avatar-img-xl"
                  width="100"
                  height="100"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <div className="ia-profile-main-meta">
              <h1>{fullName}</h1>
              {profile?.display_name && profile.display_name !== fullName && (
                <p style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.88rem' }}>
                  @{profile.display_name}
                </p>
              )}
              <div className="ia-profile-sub-meta">
                {profile?.career && (
                  <span>
                    <GraduationCapIcon size={16} color="#2563eb" />
                    <strong>{profile.career}</strong>
                  </span>
                )}
                {profile?.institution && (
                  <span>• {profile.institution}</span>
                )}
                {profile?.location && (
                  <span>
                    <MapPinIcon size={15} color="#64748b" /> {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="ia-profile-actions">
            <Link to="/profile/edit" className="ia-btn-primary">
              <EditIcon size={16} />
              Editar perfil
            </Link>
          </div>
        </div>
      </section>

      {/* Grilla de Contenido del Perfil */}
      <div className="ia-content-grid">
        {/* Columna Izquierda: Sobre Mí + Materias */}
        <div>
          {/* Sección Sobre Mí */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '12px' }}>
              Sobre mí
            </h2>
            {profile?.bio ? (
              <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                {profile.bio}
              </p>
            ) : (
              <div className="ia-empty-box" style={{ padding: '24px' }}>
                <p className="ia-empty-desc" style={{ margin: '0 0 12px 0' }}>
                  Aún no has agregado una descripción personal.
                </p>
                <Link to="/profile/edit" className="ia-btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                  Agregar descripción
                </Link>
              </div>
            )}
          </div>

          {/* Sección Puedo Enseñar */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <BookOpenIcon size={20} color="#2563eb" /> Puedo enseñar ({offeredSubjects.length})
              </h2>
              <Link to="/profile/edit" className="ia-card-action">
                Gestionar
              </Link>
            </div>

            {offeredSubjects.length > 0 ? (
              <div className="ia-catalog-list">
                {offeredSubjects.map((item) => (
                  <div key={item.subject_id} className="ia-catalog-item">
                    <div className="ia-catalog-item-info">
                      <div>
                        <div className="ia-catalog-item-title">
                          {item.subject?.name || 'Materia'}
                        </div>
                        {item.description && (
                          <p className="ia-catalog-item-desc">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="ia-badge ia-badge-blue">
                      {translateLevel(item.level)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ia-empty-box">
                <div className="ia-empty-icon">
                  <BookOpenIcon size={26} color="#94a3b8" />
                </div>
                <h3 className="ia-empty-title">Aún no has indicado materias que puedas enseñar</h3>
                <p className="ia-empty-desc">
                  Comparte tus conocimientos con otros compañeros universitarios y genera impacto académico.
                </p>
                <Link to="/profile/edit" className="ia-btn-primary" style={{ fontSize: '0.85rem' }}>
                  Agregar materias
                </Link>
              </div>
            )}
          </div>

          {/* Sección Quiero Aprender */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h2 className="ia-card-title">
                <UsersIcon size={20} color="#16a34a" /> Quiero aprender ({neededSubjects.length})
              </h2>
              <Link to="/profile/edit" className="ia-card-action">
                Gestionar
              </Link>
            </div>

            {neededSubjects.length > 0 ? (
              <div className="ia-catalog-list">
                {neededSubjects.map((item) => (
                  <div key={item.subject_id} className="ia-catalog-item">
                    <div className="ia-catalog-item-info">
                      <div>
                        <div className="ia-catalog-item-title">
                          {item.subject?.name || 'Materia'}
                        </div>
                        {item.notes && (
                          <p className="ia-catalog-item-desc">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    {item.current_level && (
                      <span className="ia-badge ia-badge-amber">
                        Nivel actual: {translateLevel(item.current_level)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ia-empty-box">
                <div className="ia-empty-icon">
                  <UsersIcon size={26} color="#94a3b8" />
                </div>
                <h3 className="ia-empty-title">Aún no has indicado materias en las que necesites apoyo</h3>
                <p className="ia-empty-desc">
                  Indica qué asignaturas te representan un desafío para que tutores pares puedan encontrarte.
                </p>
                <Link to="/profile/edit" className="ia-btn-secondary" style={{ fontSize: '0.85rem' }}>
                  Solicitar apoyo
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Proyectos, Habilidades, Intereses y Enlaces */}
        <div>
          {/* Proyectos y Colaboración */}
          <div className="ia-card">
            <div className="ia-card-header" style={{ marginBottom: '14px' }}>
              <h2 className="ia-card-title">
                <BriefcaseIcon size={20} color="#2563eb" /> Proyectos y Colaboración
              </h2>
              <Link to="/profile/edit" className="ia-card-action">
                Editar
              </Link>
            </div>

            {/* Disponibilidad */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Disponibilidad
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#334155' }}>Para tutorías:</span>
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
                  <span style={{ fontSize: '0.85rem', color: '#334155' }}>Para proyectos:</span>
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

            {/* Bio de Proyectos si existe */}
            {profile?.project_bio && (
              <div style={{ marginBottom: '18px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Enfoque en Proyectos
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                  {profile.project_bio}
                </p>
              </div>
            )}

            {/* Habilidades para proyectos */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                <CodeIcon size={14} color="#d97706" /> Habilidades que puedo aportar
              </span>
              {skills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {skills.map((sk) => (
                    <span key={sk.skill_id} className="ia-badge ia-badge-amber">
                      {sk.skill?.name} · {translateLevel(sk.level)}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No has especificado habilidades técnicas aún.
                </p>
              )}
            </div>

            {/* Intereses de proyectos */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                <SparklesIcon size={14} color="#9333ea" /> Me interesan proyectos de
              </span>
              {interests.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {interests.map((int) => (
                    <span key={int.interest_id} className="ia-badge ia-badge-purple">
                      {int.interest?.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No has seleccionado áreas de interés para proyectos.
                </p>
              )}
            </div>

            {/* Enlaces de Portfolio y Redes */}
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Enlaces y Portafolio
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile?.portfolio_url ? (
                  <a
                    href={profile.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ia-card-action"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLinkIcon size={14} /> Sitio web / Portafolio
                  </a>
                ) : null}

                {profile?.github_url ? (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ia-card-action"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLinkIcon size={14} /> Perfil de GitHub
                  </a>
                ) : null}

                {profile?.linkedin_url ? (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ia-card-action"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLinkIcon size={14} /> Perfil de LinkedIn
                  </a>
                ) : null}

                {!profile?.portfolio_url && !profile?.github_url && !profile?.linkedin_url && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    No has agregado enlaces a tus perfiles profesionales.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
