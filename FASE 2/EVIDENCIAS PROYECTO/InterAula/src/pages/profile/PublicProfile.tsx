import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  BookOpenIcon,
  UsersIcon,
  BriefcaseIcon,
  CodeIcon,
  SparklesIcon,
  CheckIcon,
  ExternalLinkIcon,
  MapPinIcon,
  GraduationCapIcon,
  StarIcon,
  AwardIcon,
  ArrowLeftIcon,
} from '../../components/common/Icons';

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

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [interests, setInterests] = useState<ProfileProjectInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicData() {
      if (!id) return;
      try {
        setLoading(true);
        setNotFound(false);

        const [p, offered, needed, sk, int] = await Promise.all([
          profileService.getProfileById(id),
          profileService.getOfferedSubjects(id),
          profileService.getNeededSubjects(id),
          profileService.getProfileSkills(id),
          profileService.getProfileProjectInterests(id),
        ]);

        if (isMounted) {
          if (!p) {
            setNotFound(true);
          } else {
            setProfile(p);
            setOfferedSubjects(offered);
            setNeededSubjects(needed);
            setSkills(sk);
            setInterests(int);
          }
        }
      } catch (err) {
        console.error('[PublicProfile] Error al cargar perfil público:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPublicData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b', fontSize: '1.05rem' }}>Cargando perfil público...</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '50px 20px' }}>
        <h2 style={{ color: '#0f172a', marginBottom: '8px' }}>Perfil no encontrado</h2>
        <p style={{ color: '#64748b', marginBottom: '20px' }}>
          El usuario solicitado no existe o no tiene un perfil disponible en InterAula.
        </p>
        <Link to="/dashboard" className="ia-btn-primary">
          <ArrowLeftIcon size={16} /> Volver al panel
        </Link>
      </div>
    );
  }

  const fullName = profile.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile.display_name || 'Estudiante InterAula';

  const initial = (fullName[0] || 'U').toUpperCase();

  return (
    <div>
      {/* Botón Volver */}
      <div style={{ marginBottom: '18px' }}>
        <Link to="/dashboard" className="ia-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          <ArrowLeftIcon size={14} /> Volver
        </Link>
      </div>

      {/* Cabecera del Perfil Público */}
      <section className="ia-profile-header-card">
        <div className="ia-profile-cover" />
        <div className="ia-profile-header-body">
          <div className="ia-profile-avatar-container">
            <div className="ia-profile-avatar-xl">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
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
              {profile.display_name && profile.display_name !== fullName && (
                <p style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.88rem' }}>
                  @{profile.display_name}
                </p>
              )}
              <div className="ia-profile-sub-meta">
                {profile.career && (
                  <span>
                    <GraduationCapIcon size={16} color="#2563eb" />
                    <strong>{profile.career}</strong>
                  </span>
                )}
                {profile.institution && <span>• {profile.institution}</span>}
                {profile.location && (
                  <span>
                    <MapPinIcon size={15} color="#64748b" /> {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="ia-profile-actions">
            {profile.available_for_tutoring && (
              <span className="ia-badge ia-badge-success">
                <CheckIcon size={12} /> Tutorías disponibles
              </span>
            )}
            {profile.available_for_projects && (
              <span className="ia-badge ia-badge-blue">
                <CheckIcon size={12} /> Para proyectos
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Contenido del Perfil Público */}
      <div className="ia-content-grid">
        {/* Columna Izquierda: Bio y Materias */}
        <div>
          {/* Sobre el estudiante */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '12px' }}>
              Sobre este estudiante
            </h2>
            {profile.bio ? (
              <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                {profile.bio}
              </p>
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                Sin descripción personal proporcionada.
              </p>
            )}
          </div>

          {/* Materias que enseña */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <BookOpenIcon size={20} color="#2563eb" /> Materias que puede enseñar ({offeredSubjects.length})
            </h2>

            {offeredSubjects.length > 0 ? (
              <div className="ia-catalog-list">
                {offeredSubjects.map((item) => (
                  <div key={item.subject_id} className="ia-catalog-item">
                    <div>
                      <div className="ia-catalog-item-title">{item.subject?.name}</div>
                      {item.description && (
                        <p className="ia-catalog-item-desc">{item.description}</p>
                      )}
                    </div>
                    <span className="ia-badge ia-badge-blue">
                      {translateLevel(item.level)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                No ha especificado materias para enseñar en este momento.
              </p>
            )}
          </div>

          {/* Materias en las que busca apoyo */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <UsersIcon size={20} color="#16a34a" /> Materias en las que busca apoyo ({neededSubjects.length})
            </h2>

            {neededSubjects.length > 0 ? (
              <div className="ia-catalog-list">
                {neededSubjects.map((item) => (
                  <div key={item.subject_id} className="ia-catalog-item">
                    <div>
                      <div className="ia-catalog-item-title">{item.subject?.name}</div>
                      {item.notes && <p className="ia-catalog-item-desc">{item.notes}</p>}
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
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                No tiene requerimientos de apoyo académico registrados.
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Proyectos, Habilidades, Enlaces y Módulos Futuros */}
        <div>
          {/* Proyectos y Habilidades */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <BriefcaseIcon size={20} color="#2563eb" /> Proyectos y Habilidades
            </h2>

            {profile.project_bio && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Enfoque en Proyectos
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                  {profile.project_bio}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                <CodeIcon size={14} color="#d97706" /> Habilidades técnicas
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
                  Sin habilidades registradas.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                <SparklesIcon size={14} color="#9333ea" /> Áreas de interés
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
                  Sin intereses especificados.
                </p>
              )}
            </div>

            {/* Enlaces externos */}
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Portafolio y Redes
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.portfolio_url && (
                  <a
                    href={profile.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ia-card-action"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLinkIcon size={14} /> Sitio web / Portafolio
                  </a>
                )}
                {profile.github_url && (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ia-card-action"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLinkIcon size={14} /> GitHub
                  </a>
                )}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ia-card-action"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLinkIcon size={14} /> LinkedIn
                  </a>
                )}
                {!profile.portfolio_url && !profile.github_url && !profile.linkedin_url && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    Sin enlaces externos.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 20. Reputación e Insignias (Preparado sin datos ficticios) */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <StarIcon size={18} color="#d97706" /> Reputación e Historial
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>
                  Valoraciones académicas
                </span>
                <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
                  Aún sin valoraciones
                </span>
              </div>

              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>
                  <AwardIcon size={14} color="#2563eb" /> Insignias institucionales
                </span>
                <span style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  Próximamente
                </span>
              </div>

              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '2px' }}>
                  Tutorías realizadas
                </span>
                <span style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  Próximamente
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
