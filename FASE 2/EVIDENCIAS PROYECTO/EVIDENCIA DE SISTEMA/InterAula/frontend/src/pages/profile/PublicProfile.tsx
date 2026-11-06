import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { profileService } from '../../services/profile.service';
import { projectService } from '../../services/project.service';
import { notesService, type AcademicNote } from '../../services/notes.service';
import type {
  Profile,
  OfferedSubject,
  NeededSubject,
} from '../../types/profile';
import type { Project } from '../../types/project';
import {
  BookOpenIcon,
  UsersIcon,
  BriefcaseIcon,
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
  const [tutorStats, setTutorStats] = useState<TutorStatistics | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [sharedNotes, setSharedNotes] = useState<AcademicNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicData() {
      if (!id) return;
      try {
        setLoading(true);
        setNotFound(false);

        const [p, offered, needed, stats, uBadges, allProjects, authorNotes] = await Promise.all([
          profileService.getProfileById(id),
          profileService.getOfferedSubjects(id),
          profileService.getNeededSubjects(id),
          tutoringService.getTutorStats(id),
          tutoringService.getUserBadges(id),
          projectService.getProjects().catch(() => []),
          notesService.getNotes({ author_id: id }).catch(() => []),
        ]);

        if (isMounted) {
          if (!p) {
            setNotFound(true);
          } else {
            setProfile(p);
            setOfferedSubjects(offered);
            setNeededSubjects(needed);
            setTutorStats(stats);
            setBadges(uBadges);

            const relatedProjects = allProjects.filter(
              (proj) =>
                proj.owner_id === id ||
                (proj.members || []).some((m) => m.profile_id === id)
            );
            setUserProjects(relatedProjects);
            setSharedNotes(authorNotes.filter((n) => !n.isDraft && n.visibility !== 'private'));
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
          Volver a explorar tutores
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
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ia-btn-icon-back"
          aria-label="Volver"
          title="Volver"
        >
          <ArrowLeftIcon size={18} />
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
            {profile.available_for_tutoring && offeredSubjects.length > 0 && (
              <span className="ia-badge ia-badge-success">
                <CheckIcon size={12} /> Disponible para Apoyo entre Pares
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Contenido del Perfil Público */}
      <div className="ia-content-grid">
        {/* Columna Izquierda: Bio, Materias, Proyectos y Apuntes */}
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
          {offeredSubjects.length > 0 && (
            <div className="ia-card">
              <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
                <BookOpenIcon size={20} color="#2563eb" /> Materias en las que ofrece apoyo ({offeredSubjects.length})
              </h2>

              <div className="ia-catalog-list">
                {offeredSubjects.map((item) => (
                  <div key={item.subject_id} className="ia-catalog-item">
                    <div className="ia-catalog-item-info">
                      <div>
                        <div className="ia-catalog-item-title">{item.subject?.name || 'Materia'}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                          {formatAcademicLevel(item.level)}
                        </div>
                        {item.description && (
                          <p className="ia-catalog-item-desc" style={{ marginTop: '4px' }}>{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      {item.is_verified ? (
                        <span className="ia-badge ia-badge-success">
                          <ShieldCheckIcon size={12} /> Tutor Par Verificado
                        </span>
                      ) : (
                        <span className="ia-badge ia-badge-blue">
                          Apoyo entre Pares
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Proyectos Interdisciplinarios del Estudiante */}
          <div className="ia-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="ia-card-title" style={{ margin: 0 }}>
                <BriefcaseIcon size={19} color="#7c3aed" /> Proyectos Interdisciplinarios ({userProjects.length})
              </h2>
              <Link to="/projects" className="ia-card-action">
                Ir al Hub de Proyectos →
              </Link>
            </div>

            {userProjects.length > 0 ? (
              <div className="ia-catalog-list">
                {userProjects.map((proj) => {
                  const isOwner = proj.owner_id === id;
                  return (
                    <div key={proj.id} className="ia-catalog-item">
                      <div className="ia-catalog-item-info">
                        <div>
                          <div className="ia-catalog-item-title">{proj.title}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                            {proj.category || 'Desarrollo'} · {proj.career || 'Interdisciplinario'}
                          </div>
                          {proj.short_description && (
                            <p className="ia-catalog-item-desc" style={{ marginTop: '4px' }}>
                              {proj.short_description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`ia-badge ${isOwner ? 'ia-badge-purple' : 'ia-badge-blue'}`}>
                        {isOwner ? 'Creador / Líder' : 'Integrante'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                Aún no registra participación pública en proyectos del Hub.
              </p>
            )}
          </div>

          {/* Apuntes Compartidos por el Estudiante */}
          <div className="ia-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="ia-card-title" style={{ margin: 0 }}>
                <BookOpenIcon size={19} color="#d97706" /> Apuntes y Recursos Compartidos ({sharedNotes.length})
              </h2>
              <Link to="/resources" className="ia-card-action">
                Ver Biblioteca →
              </Link>
            </div>

            {sharedNotes.length > 0 ? (
              <div className="ia-catalog-list">
                {sharedNotes.map((note) => (
                  <div key={note.id} className="ia-catalog-item">
                    <div className="ia-catalog-item-info">
                      <div>
                        <div className="ia-catalog-item-title">{note.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                          {note.subjectName || 'Materia General'} · {note.downloadsCount || 0} descargas
                        </div>
                        {note.summary && (
                          <p className="ia-catalog-item-desc" style={{ marginTop: '4px' }}>
                            {note.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="ia-badge ia-badge-neutral">
                      {(note.fileExtension || '.md').replace('.', '').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                Sin apuntes públicos compartidos por el momento.
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Reputación, Insignias, Habilidades y Contacto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Reputación y Estadísticas de Tutor (Solo para tutores habilitados) */}
          {offeredSubjects.length > 0 && <TutorStats stats={tutorStats} />}

          {/* Insignias Obtenidas (Solo si tiene insignias) */}
          {badges.length > 0 && <BadgeList badges={badges} />}

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

          {/* Enlaces y Portafolio */}
          <div className="ia-card">
            <h2 className="ia-card-title" style={{ marginBottom: '14px' }}>
              <ExternalLinkIcon size={18} color="#2563eb" /> Enlaces y Portafolio
            </h2>

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
  );
}
