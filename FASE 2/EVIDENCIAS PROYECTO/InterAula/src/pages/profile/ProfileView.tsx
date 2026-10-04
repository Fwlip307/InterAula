import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import type {
  Profile,
  OfferedSubject,
  NeededSubject,
} from '../../types/profile';
import { LEARNING_PREFERENCES } from '../../types/profile';
import {
  EditIcon,
  BookOpenIcon,
  UsersIcon,
  SparklesIcon,
  CheckIcon,
  XIcon,
  ExternalLinkIcon,
  MapPinIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  MailIcon,
  PhoneIcon,
  UploadCloudIcon,
  ClockIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';
import { formatAcademicLevel, getUserDisplayName, getUserInitial } from '../../utils/formatters';
import { tutoringService } from '../../services/tutoring.service';
import { verificationService } from '../../services/verification.service';
import type { TutorStatistics, UserBadge } from '../../types/tutoring';
import type { TutorVerificationRequest } from '../../types/verification';
import TutorStats from '../../components/common/TutorStats';
import BadgeList from '../../components/common/BadgeList';
import CertificateVerificationModal from './components/CertificateVerificationModal';
import TutorValidationBotModal from './components/TutorValidationBotModal';
import { formatTutorLevel } from '../../utils/pdfExtractor';

export default function ProfileView() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [tutorStats, setTutorStats] = useState<TutorStatistics | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<TutorVerificationRequest[]>([]);
  const [selectedSubjectForVerification, setSelectedSubjectForVerification] = useState<{ id: string; name: string } | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);
  const [selectedSubjectForBot, setSelectedSubjectForBot] = useState<{ id: string; name: string } | null>(null);
  const [botSuccessToast, setBotSuccessToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleBotSuccess = (subId: string, subName: string) => {
    setOfferedSubjects((prev) =>
      prev.map((item) =>
        item.subject_id === subId ? { ...item, is_verified: true } : item
      )
    );
    setBotSuccessToast(`Acreditación confirmada: ahora eres Tutor Certificado en ${subName}.`);
    setTimeout(() => setBotSuccessToast(null), 5000);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const [p, offered, needed, stats, uBadges, verifReqs] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
          tutoringService.getTutorStats(user.id),
          tutoringService.getUserBadges(user.id),
          verificationService.getMyVerificationRequests().catch((e) => {
            console.error('[ProfileView] Error al cargar solicitudes de verificación:', e);
            return [];
          }),
        ]);

        if (isMounted) {
          setProfile(p);
          setOfferedSubjects(offered);
          setNeededSubjects(needed);
          setTutorStats(stats);
          setBadges(uBadges);
          setVerificationRequests(verifReqs);
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

  const fullName = getUserDisplayName(profile, user?.user_metadata, user?.email);
  const initial = getUserInitial(fullName);
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div>
      {/* Mensaje de éxito de acreditación */}
      {botSuccessToast && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
            fontWeight: 700,
            boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.15)',
          }}
        >
          <ShieldCheckIcon size={20} color="#059669" />
          <span>{botSuccessToast}</span>
        </div>
      )}

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

          <div className="ia-profile-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {user?.id && (
              <Link to={`/profile/${user.id}`} className="ia-btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                <ExternalLinkIcon size={15} />
                Ver perfil público
              </Link>
            )}
            <Link to="/profile/edit" className="ia-btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
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
              <EmptyState
                style={{ padding: '24px' }}
                description="Aún no has agregado una descripción personal."
                action={
                  <Link to="/profile/edit" className="ia-btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                    Agregar descripción
                  </Link>
                }
              />
            )}
          </div>

          {/* Sección de Preferencias de Aprendizaje y Estilo de Estudio */}
          <div className="ia-card">
            <div className="ia-card-header" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SparklesIcon size={18} color="#2563eb" />
                <h2 className="ia-card-title" style={{ margin: 0 }}>
                  Preferencia de Aprendizaje y Estilo de Estudio
                </h2>
              </div>
              <Link to="/profile/edit" className="ia-card-action">
                Modificar
              </Link>
            </div>

            {profile?.learning_preferences && profile.learning_preferences.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {profile.learning_preferences.map((prefId) => {
                  const match = LEARNING_PREFERENCES.find((p) => p.id === prefId);
                  const isHighlighted = prefId === 'low_stimulus' || prefId === 'active_challenges' || prefId === 'written_support';
                  return (
                    <div
                      key={prefId}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${isHighlighted ? '#bfdbfe' : '#e2e8f0'}`,
                        backgroundColor: isHighlighted ? '#eff6ff' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isHighlighted ? '#1d4ed8' : '#334155' }}>
                        {match?.label || prefId}
                      </span>
                      {match?.description && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {match.description}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
                Aún no has configurado tus preferencias de aprendizaje. Puedes indicar métodos pedagógicos (modo concentración y calma, explicaciones paso a paso o mini-retos) para que los tutores preparen la sesión a tu medida.
              </p>
            )}
          </div>

          {/* TARJETA 1: HABILITACIÓN DE TUTOR COMUNITARIO (DESAFÍO RELÁMPAGO ANTI-IA) */}
          <div
            className="ia-card"
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: '1.5px solid #86efac',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.74rem', background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    Habilitación Rápida Estudiantil
                  </span>
                  <span style={{ fontSize: '0.74rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    10 Preguntas · 10s · Muerte Súbita
                  </span>
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#064e3b', margin: '0 0 6px' }}>
                  Desafío Anti-IA para Tutores Comunitarios
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#166534', margin: 0, lineHeight: 1.5, maxWidth: '560px' }}>
                  Diseñado para estudiantes que quieren enseñar de forma comunitaria. Nuestro Chatbot Evaluador te pondrá a prueba con <strong>10 preguntas técnicas</strong> con un límite estricto de <strong>10 segundos por pregunta</strong> (selección rápida y redacción técnica corta). Si aciertas sigues, pero si fallas o el reloj llega a cero, ¡el reto termina de inmediato!
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectForBot(
                    offeredSubjects[0]
                      ? { id: offeredSubjects[0].subject_id, name: offeredSubjects[0].subject?.name || 'Materia' }
                      : null
                  );
                  setIsBotModalOpen(true);
                }}
                className="ia-btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#047857',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.25)',
                }}
                title="Rendir reto de 10 preguntas en 10s con muerte súbita"
              >
                <ClockIcon size={16} color="#ffffff" />
                <span>Rendir Desafío Anti-IA (10s)</span>
              </button>
            </div>
          </div>

          {/* TARJETA 2: ACREDITACIÓN INSTITUCIONAL OFICIAL DUOC UC (NOTAS O DOCENTE) */}
          <div
            className="ia-card"
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
              border: '1.5px solid #93c5fd',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.74rem', background: '#1d4ed8', color: '#ffffff', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    Sello Oficial Duoc UC
                  </span>
                  <span style={{ fontSize: '0.74rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    Máxima Distinción Académica
                  </span>
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 6px' }}>
                  Certificación Institucional con Concentración de Notas o Docente
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#1e40af', margin: 0, lineHeight: 1.5, maxWidth: '560px' }}>
                  El reconocimiento de mayor confianza para tutores de excelencia. Se valida formalmente cargando tu <strong>Concentración de Notas oficial de Duoc UC</strong> (nota 5.5 o superior) o mediante la aprobación directa de un profesor titular de tu sede. Otorga la insignia institucional destacada en tu perfil público.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectForVerification(
                    offeredSubjects[0]
                      ? { id: offeredSubjects[0].subject_id, name: offeredSubjects[0].subject?.name || 'Materia' }
                      : null
                  );
                  setIsCertModalOpen(true);
                }}
                className="ia-btn-secondary"
                style={{
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  borderColor: '#93c5fd',
                  color: '#1e40af',
                  boxShadow: '0 2px 4px rgba(30, 64, 175, 0.1)',
                }}
                title="Cargar Concentración de Notas oficial emitida por Duoc UC (nota >= 5.5)"
              >
                <UploadCloudIcon size={16} color="#2563eb" />
                <span>Certificación Duoc UC (Notas PDF)</span>
              </button>
            </div>
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
                {offeredSubjects.map((item) => {
                  const vReq = verificationRequests.find((r) => r.subject_id === item.subject_id);
                  const hasGrade = vReq?.matched_grade !== null && vReq?.matched_grade !== undefined;
                  const levelLabel = vReq?.calculated_level
                    ? formatTutorLevel(vReq.calculated_level)
                    : formatAcademicLevel(item.level);

                  const isPdfVerified = Boolean(
                    vReq?.document_filename?.toLowerCase().endsWith('.pdf') ||
                    vReq?.document_path?.toLowerCase().endsWith('.pdf')
                  );

                  return (
                    <div key={item.subject_id} className="ia-catalog-item">
                      <div className="ia-catalog-item-info">
                        <div>
                          <div className="ia-catalog-item-title">
                            {item.subject?.name || 'Materia'}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                            {hasGrade ? `${vReq.matched_grade!.toFixed(1).replace('.', ',')} · ` : ''}
                            {levelLabel}
                          </div>
                          {item.description && (
                            <p className="ia-catalog-item-desc" style={{ marginTop: '4px' }}>{item.description}</p>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {item.is_verified ? (
                          isPdfVerified ? (
                            <span className="ia-badge ia-badge-success" title="Certificado formalmente con Concentración de Notas oficial de Duoc UC">
                              <ShieldCheckIcon size={12} /> Tutor Certificado Duoc UC
                            </span>
                          ) : (
                            <span className="ia-badge ia-badge-blue" title="Habilitado mediante evaluación técnica contrarreloj (Test Anti-IA)">
                              <SparklesIcon size={12} /> Tutor Comunitario Habilitado
                            </span>
                          )
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubjectForBot({
                                  id: item.subject_id,
                                  name: item.subject?.name || 'Materia',
                                });
                                setIsBotModalOpen(true);
                              }}
                              className="ia-btn-primary"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.76rem',
                                background: '#059669',
                                borderColor: '#047857',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 700,
                              }}
                              title="Rendir reto de 10 preguntas en 10s con muerte súbita para habilitar como tutor comunitario"
                            >
                              <ClockIcon size={12} color="#ffffff" />
                              Reto Anti-IA (10s)
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubjectForVerification({
                                  id: item.subject_id,
                                  name: item.subject?.name || 'Materia',
                                });
                                setIsCertModalOpen(true);
                              }}
                              className="ia-btn-secondary"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Subir Concentración de Notas oficial emitida por Duoc UC (nota >= 5.5)"
                            >
                              <UploadCloudIcon size={12} /> Certificado Duoc UC (PDF)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<BookOpenIcon size={26} color="#94a3b8" />}
                title="Aún no has indicado materias que puedas enseñar"
                description="Comparte tus conocimientos con otros compañeros universitarios y genera impacto académico."
                action={
                  <Link to="/profile/edit" className="ia-btn-primary" style={{ fontSize: '0.85rem' }}>
                    Agregar materias
                  </Link>
                }
              />
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
                        Nivel actual: {formatAcademicLevel(item.current_level)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<UsersIcon size={26} color="#94a3b8" />}
                title="Aún no has indicado materias en las que necesites apoyo"
                description="Indica qué asignaturas te representan un desafío para que tutores pares puedan encontrarte."
                action={
                  <Link to="/profile/edit" className="ia-btn-secondary" style={{ fontSize: '0.85rem' }}>
                    Solicitar apoyo
                  </Link>
                }
              />
            )}
          </div>
        </div>

        {/* Columna Derecha: Reputación, Insignias, Proyectos y Enlaces */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Reputación y Estadísticas de Tutor */}
          <TutorStats stats={tutorStats} />

          {/* Insignias Obtenidas */}
          <BadgeList badges={badges} />

          {/* Proyectos y Colaboración */}
          {/* Disponibilidad y Enlaces */}
          <div className="ia-card">
            <div className="ia-card-header" style={{ marginBottom: '14px' }}>
              <h2 className="ia-card-title">
                <ShieldCheckIcon size={20} color="#2563eb" /> Estado de Tutoría y Enlaces
              </h2>
              <Link to="/profile/edit" className="ia-card-action">
                Editar
              </Link>
            </div>

            {/* Disponibilidad para Tutorías */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Disponibilidad
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>Tutorías Comunitarias:</span>
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

          {/* Información de Contacto y Privacidad */}
          <div className="ia-card">
            <div className="ia-card-header" style={{ marginBottom: '12px' }}>
              <h2 className="ia-card-title">
                <MailIcon size={18} color="#2563eb" /> Contacto y Privacidad
              </h2>
              <Link to="/profile/edit" className="ia-card-action">
                Configurar
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MailIcon size={14} color="#64748b" /> Correo electrónico:
                </span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {profile?.email || user?.email}
                  <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: profile?.show_email ? '#16a34a' : '#94a3b8' }}>
                    ({profile?.show_email ? 'Público' : 'Privado'})
                  </span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PhoneIcon size={14} color="#64748b" /> Teléfono:
                </span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {profile?.phone || 'No registrado'}
                  {profile?.phone && (
                    <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: profile?.show_phone ? '#16a34a' : '#94a3b8' }}>
                      ({profile?.show_phone ? 'Público' : 'Privado'})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Verificación con Certificado PDF */}
      {selectedSubjectForVerification && (
        <CertificateVerificationModal
          key={selectedSubjectForVerification.id}
          isOpen={isCertModalOpen}
          onClose={() => {
            setIsCertModalOpen(false);
            setSelectedSubjectForVerification(null);
          }}
          subjectId={selectedSubjectForVerification.id}
          subjectName={selectedSubjectForVerification.name}
          existingRequest={
            verificationRequests.find((r) => r.subject_id === selectedSubjectForVerification.id) || null
          }
          onSuccess={(updated) => {
            setVerificationRequests((prev) => {
              const idx = prev.findIndex((r) => r.id === updated.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [updated, ...prev];
            });
          }}
        />
      )}

      {/* Modal de Mini-Evaluación con Asistente Bot */}
      {isBotModalOpen && (
        <TutorValidationBotModal
          isOpen={isBotModalOpen}
          onClose={() => {
            setIsBotModalOpen(false);
            setSelectedSubjectForBot(null);
          }}
          onSuccess={handleBotSuccess}
          defaultSubjectId={selectedSubjectForBot?.id}
          availableSubjects={
            offeredSubjects.length > 0
              ? offeredSubjects.map((o) => ({ id: o.subject_id, name: o.subject?.name || 'Materia' }))
              : [
                  { id: '1', name: 'Programación de Algoritmos' },
                  { id: '2', name: 'Modelamiento de Base de Datos' },
                  { id: '3', name: 'Consultas de Bases de Datos' },
                  { id: '4', name: 'Programación Web' },
                  { id: '5', name: 'Nivelación Matemática' },
                ]
          }
        />
      )}
    </div>
  );
}

