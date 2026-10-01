import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { profileService } from '../../services/profile.service';
import type {
  Profile,
  OfferedSubject,
  NeededSubject,
  ProfileSkill,
  ProfileProjectInterest,
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
  ShieldCheckIcon,
  MailIcon,
  PhoneIcon,
  LockIcon,
  ArrowLeftIcon,
} from '../../components/common/Icons';
import { formatAcademicLevel, getUserDisplayName, getUserInitial } from '../../utils/formatters';
import { tutoringService } from '../../services/tutoring.service';
import type { TutorStatistics, UserBadge } from '../../types/tutoring';
import TutorStats from '../../components/common/TutorStats';
import BadgeList from '../../components/common/BadgeList';

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [interests, setInterests] = useState<ProfileProjectInterest[]>([]);
  const [tutorStats, setTutorStats] = useState<TutorStatistics | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicData() {
      if (!id) return;
      try {
        setLoading(true);
        setNotFound(false);

        const [p, offered, needed, sk, int, stats, uBadges] = await Promise.all([
          profileService.getProfileById(id),
          profileService.getOfferedSubjects(id),
          profileService.getNeededSubjects(id),
          profileService.getProfileSkills(id),
          profileService.getProfileProjectInterests(id),
          tutoringService.getTutorStats(id),
          tutoringService.getUserBadges(id),
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
            setTutorStats(stats);
            setBadges(uBadges);
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
        <p style={{ color: '#64748b', fontSize: '1.05rem', margin: 0 }}>Cargando perfil de usuario...</p>
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
        <Link to="/tutoring" className="ia-btn-primary">
          <ArrowLeftIcon size={16} /> Volver a explorar tutores
        </Link>
      </div>
    );
  }

  const fullName = getUserDisplayName(profile);
  const initial = getUserInitial(fullName);
  const hasContactInfo = Boolean(profile.email || profile.phone);

  return (
    <div>
      {/* Botón Volver */}
      <div style={{ marginBottom: '18px' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ia-btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeftIcon size={14} /> Volver
        </button>
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
                <CheckIcon size={12} /> Tutor disponible
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

          {/* Materias que puede enseñar */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <BookOpenIcon size={20} color="#2563eb" /> Materias que puede enseñar ({offeredSubjects.length})
            </h2>

            {offeredSubjects.length > 0 ? (
              <div className="ia-catalog-list">
                {offeredSubjects.map((item) => (
                  <div key={item.subject_id} className="ia-catalog-item">
                    <div className="ia-catalog-item-info">
                      <div>
                        <div className="ia-catalog-item-title">{item.subject?.name || 'Materia'}</div>
                        {item.description && (
                          <p className="ia-catalog-item-desc">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {item.is_verified ? (
                        <span
                          className="ia-badge"
                          style={{
                            background: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700,
                          }}
                        >
                          <ShieldCheckIcon size={13} color="#059669" /> Tutor verificado
                        </span>
                      ) : (
                        <span
                          className="ia-badge ia-badge-blue"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <BookOpenIcon size={12} /> Tutor comunitario
                        </span>
                      )}
                      <span className="ia-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                        {formatAcademicLevel(item.level)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                No ofrece materias de tutoría en este momento.
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
                    <div className="ia-catalog-item-info">
                      <div>
                        <div className="ia-catalog-item-title">{item.subject?.name || 'Materia'}</div>
                        {item.notes && <p className="ia-catalog-item-desc">{item.notes}</p>}
                      </div>
                    </div>
                    {item.current_level && (
                      <span className="ia-badge ia-badge-amber">
                        Nivel actual: {formatAcademicLevel(item.current_level)}
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

        {/* Columna Derecha: Reputación, Insignias, Proyectos, Habilidades y Contacto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Reputación y Estadísticas de Tutor (Reutiliza TutorStats real) */}
          <TutorStats stats={tutorStats} />

          {/* Insignias Obtenidas (Reutiliza BadgeList) */}
          <BadgeList badges={badges} />

          {/* Contacto Público */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <MailIcon size={18} color="#2563eb" /> Contacto
            </h2>

            {hasContactInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {profile.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                    <MailIcon size={16} color="#2563eb" />
                    <a
                      href={`mailto:${profile.email}`}
                      style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {profile.email}
                    </a>
                  </div>
                )}
                {profile.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                    <PhoneIcon size={16} color="#16a34a" />
                    <a
                      href={`tel:${profile.phone}`}
                      style={{ color: '#334155', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {profile.phone}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                <LockIcon size={15} color="#94a3b8" />
                <span>Este estudiante mantiene sus datos de contacto en modo privado.</span>
              </div>
            )}
          </div>

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
                      {sk.skill?.name} · {formatAcademicLevel(sk.level)}
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
                    Sin enlaces externos registrados.
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
