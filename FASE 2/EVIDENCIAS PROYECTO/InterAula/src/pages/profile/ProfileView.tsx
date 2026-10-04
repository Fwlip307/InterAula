import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import { tutoringService } from '../../services/tutoring.service';
import { verificationService } from '../../services/verification.service';
import type {
  Profile,
  Subject,
  OfferedSubject,
  NeededSubject,
  AcademicLevel,
  LearningPreference,
} from '../../types/profile';
import { LEARNING_PREFERENCES } from '../../types/profile';
import type { TutorStatistics, UserBadge } from '../../types/tutoring';
import type { TutorVerificationRequest } from '../../types/verification';
import {
  UserIcon,
  BookOpenIcon,
  SparklesIcon,
  ExternalLinkIcon,
  MapPinIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  MailIcon,
  PhoneIcon,
  UploadCloudIcon,
  ClockIcon,
  AwardIcon,
  EditIcon,
  LockIcon,
  CheckIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';
import { getUserDisplayName, getUserInitial } from '../../utils/formatters';
import { isValidUrl } from '../../utils/validators';
import TutorStats from '../../components/common/TutorStats';
import BadgeList from '../../components/common/BadgeList';
import CertificateVerificationModal from './components/CertificateVerificationModal';
import TutorValidationBotModal from './components/TutorValidationBotModal';
import TeacherEndorsementModal from './components/TeacherEndorsementModal';
import OfferedSubjectsSection from './components/OfferedSubjectsSection';
import NeededSubjectsSection from './components/NeededSubjectsSection';
import SearchableCombobox from '../../components/common/SearchableCombobox';
import {
  getAllInstitutions,
  getCareersForInstitution,
  getSedesForInstitution,
  findInstitutionByName,
} from '../../data/institutionsAndCareers';
import { getSuggestedSubjectsForCareer } from '../../services/catalogResolver';

export default function ProfileView() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const initialTab: 'personal' | 'tutoring' | 'learning' =
    tabParam === 'tutoring' || tabParam === 'learning' || tabParam === 'personal'
      ? tabParam
      : 'personal';

  // Apartado activo ('personal' | 'tutoring' | 'learning')
  const [activeTab, setActiveTab] = useState<'personal' | 'tutoring' | 'learning'>(initialTab);

  // Datos del perfil y listas
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [tutorStats, setTutorStats] = useState<TutorStatistics | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [_verificationRequests, setVerificationRequests] = useState<TutorVerificationRequest[]>([]);

  // Estados de edición para Apartado 1: Información Personal y Académica
  const [isEditingPersonal, setIsEditingPersonal] = useState(searchParams.get('edit') === 'true');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('Duoc UC');
  const [selectedCareer, setSelectedCareer] = useState('Ingeniería en Informática');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [availableForTutoring, setAvailableForTutoring] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSuccessMsg, setPersonalSuccessMsg] = useState<string | null>(null);
  const [personalErrorMsg, setPersonalErrorMsg] = useState<string | null>(null);

  // Estados de Apartado 3: Preferencias de Aprendizaje
  const [learningPreferences, setLearningPreferences] = useState<LearningPreference[]>([]);
  const [preferencesSuccessMsg, setPreferencesSuccessMsg] = useState<string | null>(null);

  // Modales de Acreditación (Apartado 2)
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [selectedSubjectForVerification, setSelectedSubjectForVerification] = useState<{ id: string; name: string } | null>(null);
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);
  const [selectedSubjectForBot, setSelectedSubjectForBot] = useState<{ id: string; name: string } | null>(null);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [botSuccessToast, setBotSuccessToast] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // Catálogos memoizados para el SearchableCombobox
  const allInstitutions = getAllInstitutions();
  const availableCareers = selectedInstitution ? getCareersForInstitution(selectedInstitution, location) : [];
  const availableSedes = selectedInstitution ? getSedesForInstitution(selectedInstitution) : [];

  const institutionOptions = useMemo(() => {
    return allInstitutions.map((i) => ({
      value: i.name,
      label: i.name,
      group: i.type,
      subLabel: `${i.careersCount || i.careers.length} carreras registradas`,
    }));
  }, [allInstitutions]);

  const careerOptions = useMemo(() => {
    return availableCareers.map((c) => ({
      value: c,
      label: c,
    }));
  }, [availableCareers]);

  const sedeOptions = useMemo(() => {
    return availableSedes.map((s) => ({
      value: `${s.name} (${s.comuna})`,
      label: `${s.name} — ${s.comuna}`,
      subLabel: s.region,
    }));
  }, [availableSedes]);

  const isProfileInstitutionComplete = Boolean(
    profile?.institution && profile.institution.trim() !== '' &&
    profile?.career && profile.career.trim() !== ''
  );

  const availableForEvaluation = useMemo(() => {
    // 1. Obtener materias sugeridas para la carrera del perfil desde el nuevo catálogo JSON chileno
    const currentCareer = profile?.career || selectedCareer;
    const currentInstitution = profile?.institution || selectedInstitution;
    const suggested = getSuggestedSubjectsForCareer(currentCareer, currentInstitution, 50);

    const resolvedList: { id: string; name: string; category?: string; isBoosted?: boolean }[] = suggested
      .filter((s) => !offeredSubjects.some((o) => o.subject?.name?.toLowerCase() === s.name.toLowerCase() && o.is_verified))
      .map((s) => ({
        id: s.id,
        name: s.name,
        category: s.areaName,
        isBoosted: s.isBoosted,
      }));

    // 2. Agregar materias existentes del piloto en la BD que no se hayan acreditado aún
    for (const catSub of catalogSubjects) {
      if (
        !resolvedList.some((r) => r.name.toLowerCase() === catSub.name.toLowerCase()) &&
        !offeredSubjects.some((o) => o.subject_id === catSub.id && o.is_verified)
      ) {
        resolvedList.push({
          id: catSub.id,
          name: catSub.name,
          category: catSub.category || undefined,
        });
      }
    }

    return resolvedList;
  }, [profile?.career, selectedCareer, catalogSubjects, offeredSubjects]);

  // Cargar todos los datos del usuario
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const [p, subs, offered, needed, stats, uBadges, verifReqs] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getSubjects(),
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
          setCatalogSubjects(subs);
          setOfferedSubjects(offered);
          setNeededSubjects(needed);
          setTutorStats(stats);
          setBadges(uBadges);
          setVerificationRequests(verifReqs);

          if (p) {
            setFirstName(p.first_name || '');
            setLastName(p.last_name || '');
            setSelectedInstitution(p.institution || 'Duoc UC');
            setSelectedCareer(p.career || 'Ingeniería en Informática');
            setLocation(p.location || '');
            setBio(p.bio || '');
            setPhone(p.phone || '');
            setShowPhone(Boolean(p.show_phone));
            setGithubUrl(p.github_url || '');
            setLinkedinUrl(p.linkedin_url || '');
            setAvailableForTutoring(offered.length > 0 ? (p.available_for_tutoring ?? true) : false);
            setLearningPreferences(p.learning_preferences || []);
          }
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

  // Sincronizar estado cuando los parámetros de la URL cambien
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'tutoring' || t === 'learning' || t === 'personal') {
      setActiveTab(t);
    }
    if (searchParams.get('edit') === 'true') {
      setActiveTab('personal');
      setIsEditingPersonal(true);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: 'personal' | 'tutoring' | 'learning') => {
    setActiveTab(newTab);
    const params: Record<string, string> = { tab: newTab };
    if (newTab === 'personal' && isEditingPersonal) {
      params.edit = 'true';
    }
    setSearchParams(params);
  };

  const handleStartEditPersonal = () => {
    setActiveTab('personal');
    setIsEditingPersonal(true);
    setSearchParams({ tab: 'personal', edit: 'true' });
  };

  const handleCancelEditPersonal = () => {
    setIsEditingPersonal(false);
    setSearchParams({ tab: 'personal' });
  };

  // Manejador del cambio de institución
  const handleInstitutionSelect = (val: string) => {
    const matched = findInstitutionByName(val);
    if (matched) {
      setSelectedInstitution(matched.name);
      const careers = getCareersForInstitution(matched.name);
      if (careers.length > 0 && !careers.includes(selectedCareer)) {
        setSelectedCareer(careers[0]);
      }
    } else {
      setSelectedInstitution(val);
    }
  };

  // Guardar datos del Apartado 1: Personal y Académico
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalSuccessMsg(null);
    setPersonalErrorMsg(null);

    if (githubUrl && !isValidUrl(githubUrl)) {
      setPersonalErrorMsg('La URL de GitHub no es válida (ej: https://github.com/usuario).');
      return;
    }
    if (linkedinUrl && !isValidUrl(linkedinUrl)) {
      setPersonalErrorMsg('La URL de LinkedIn no es válida (ej: https://linkedin.com/in/usuario).');
      return;
    }

    try {
      setSavingPersonal(true);
      const updated = await profileService.updateMyProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        institution: selectedInstitution.trim() || null,
        career: selectedCareer.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        show_phone: showPhone,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
      });

      if (updated) {
        setProfile(updated);
        setIsEditingPersonal(false);
        setSearchParams({ tab: 'personal' });
        setPersonalSuccessMsg('Información personal y académica guardada con éxito.');
        setTimeout(() => setPersonalSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('[ProfileView] Error al guardar datos personales:', err);
      setPersonalErrorMsg('Ocurrió un error al guardar los cambios.');
    } finally {
      setSavingPersonal(false);
    }
  };

  // Alternar disponibilidad para tutorías (Apartado 2)
  const handleToggleTutoringAvailability = async () => {
    const newVal = !availableForTutoring;
    setAvailableForTutoring(newVal);
    try {
      const updated = await profileService.updateMyProfile({
        available_for_tutoring: newVal,
      });
      if (updated) setProfile(updated);
    } catch (err) {
      console.error('Error al actualizar disponibilidad:', err);
      setAvailableForTutoring(!newVal);
    }
  };

  // Gestión de materias habilitadas para impartir (Apartado 2)
  const handleRemoveOfferedSubject = async (subjectId: string) => {
    await profileService.removeOfferedSubject(subjectId);
    setOfferedSubjects((prev) => prev.filter((i) => i.subject_id !== subjectId));
  };

  // Gestión de materias que necesito aprender (Apartado 3)
  const handleAddNeededSubject = async (
    subjectId: string,
    level: AcademicLevel,
    notes: string
  ) => {
    const added = await profileService.addNeededSubject(subjectId, level, notes);
    setNeededSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
  };

  const handleRemoveNeededSubject = async (subjectId: string) => {
    await profileService.removeNeededSubject(subjectId);
    setNeededSubjects((prev) => prev.filter((i) => i.subject_id !== subjectId));
  };

  // Alternar preferencias pedagógicas (Apartado 3)
  const handleTogglePreference = async (prefId: LearningPreference) => {
    const updatedPrefs = learningPreferences.includes(prefId)
      ? learningPreferences.filter((p) => p !== prefId)
      : [...learningPreferences, prefId];

    setLearningPreferences(updatedPrefs);
    try {
      const updated = await profileService.updateMyProfile({
        learning_preferences: updatedPrefs,
      });
      if (updated) {
        setProfile(updated);
        setPreferencesSuccessMsg('Preferencia pedagógica guardada para el Aula Virtual.');
        setTimeout(() => setPreferencesSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error al guardar preferencia:', err);
    }
  };

  const handleBotSuccess = async (subId: string, subName: string, level?: AcademicLevel) => {
    const accreditedLevel = level || 'intermediate';
    const levelLabelMap: Record<AcademicLevel, string> = {
      basic: 'Tutor Inicial (Básico)',
      intermediate: 'Tutor Comunitario (Intermedio)',
      advanced: 'Tutor Senior (Avanzado)',
    };

    try {
      if (user) {
        const fresh = await profileService.getOfferedSubjects(user.id);
        if (fresh && fresh.length > 0) {
          setOfferedSubjects(fresh);
        } else {
          throw new Error('Fallback to local state');
        }
      }
    } catch {
      setOfferedSubjects((prev) => {
        const exists = prev.some((item) => item.subject_id === subId);
        if (exists) {
          return prev.map((item) =>
            item.subject_id === subId ? { ...item, level: accreditedLevel, is_verified: true } : item
          );
        }
        const catalogSub = catalogSubjects.find((s) => s.id === subId);
        return [
          ...prev,
          {
            profile_id: user?.id || '',
            subject_id: subId,
            level: accreditedLevel,
            description: `Tutor Habilitado (${levelLabelMap[accreditedLevel]}) mediante Evaluación Técnica de Contenidos`,
            is_verified: true,
            verified_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            subject: catalogSub,
          },
        ];
      });
    }
    setAvailableForTutoring(true);
    setBotSuccessToast(`Acreditación confirmada: ahora eres ${levelLabelMap[accreditedLevel]} en ${subName}.`);
    setTimeout(() => setBotSuccessToast(null), 5000);
  };

  if (loading) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600 }}>Cargando tu perfil...</p>
      </div>
    );
  }

  const fullName = getUserDisplayName(profile, user?.user_metadata, user?.email);
  const initial = getUserInitial(fullName);
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Toast de Acreditación exitosa */}
      {botSuccessToast && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
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

      {/* Cabecera Principal del Perfil */}
      <section className="ia-profile-header-card" style={{ marginBottom: '20px' }}>
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
                <p style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.88rem', margin: '2px 0 6px' }}>
                  @{profile.display_name}
                </p>
              )}
              <div className="ia-profile-sub-meta" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                {profile?.career && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <GraduationCapIcon size={16} color="#2563eb" />
                    <strong>{profile.career}</strong>
                  </span>
                )}
                {profile?.institution && (
                  <span>• {profile.institution}</span>
                )}
                {profile?.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MapPinIcon size={14} color="#64748b" /> {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="ia-profile-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {user?.id && (
              <Link to={`/profile/${user.id}`} className="ia-btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                <ExternalLinkIcon size={15} />
                Ver perfil público
              </Link>
            )}
            <button
              type="button"
              onClick={handleStartEditPersonal}
              className="ia-btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <EditIcon size={16} />
              Editar mis datos
            </button>
          </div>
        </div>
      </section>

      {/* Navegación por Apartados / Pestañas */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '2px',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('personal')}
          style={{
            padding: '12px 18px',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeTab === 'personal' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'personal' ? '#ffffff' : 'transparent',
            color: activeTab === 'personal' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <UserIcon size={18} color={activeTab === 'personal' ? '#2563eb' : '#64748b'} />
          <span>Información Personal y Académica</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('tutoring')}
          style={{
            padding: '12px 18px',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeTab === 'tutoring' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'tutoring' ? '#ffffff' : 'transparent',
            color: activeTab === 'tutoring' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <AwardIcon size={18} color={activeTab === 'tutoring' ? '#2563eb' : '#64748b'} />
          <span>{offeredSubjects.length > 0 ? 'Tutorías y Conocimientos' : 'Habilitarme como Tutor'}</span>
          {offeredSubjects.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'tutoring' ? '#dbeafe' : '#f1f5f9',
                color: activeTab === 'tutoring' ? '#1e40af' : '#64748b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 800,
              }}
            >
              {offeredSubjects.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('learning')}
          style={{
            padding: '12px 18px',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeTab === 'learning' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'learning' ? '#ffffff' : 'transparent',
            color: activeTab === 'learning' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <BookOpenIcon size={18} color={activeTab === 'learning' ? '#2563eb' : '#64748b'} />
          <span>Lo que Quiero Aprender</span>
          {neededSubjects.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'learning' ? '#dbeafe' : '#f1f5f9',
                color: activeTab === 'learning' ? '#1e40af' : '#64748b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 800,
              }}
            >
              {neededSubjects.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* APARTADO 1: INFORMACIÓN PERSONAL Y ACADÉMICA (Todo en mi perfil)          */}
      {/* ========================================================================= */}
      {activeTab === 'personal' && (
        <div>
          {personalSuccessMsg && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              {personalSuccessMsg}
            </div>
          )}

          {personalErrorMsg && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              {personalErrorMsg}
            </div>
          )}

          {isEditingPersonal ? (
            /* MODO EDICIÓN EN EL MISMO LUGAR */
            <form onSubmit={handleSavePersonal}>
              <div className="ia-card" style={{ padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h2 className="ia-card-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                    Editar Información Personal y Académica
                  </h2>
                  <button
                    type="button"
                    onClick={handleCancelEditPersonal}
                    className="ia-btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    Cancelar
                  </button>
                </div>

                <div className="ia-form-grid" style={{ gap: '16px' }}>
                  {/* Nombres y Apellidos */}
                  <div className="ia-form-group">
                    <label className="ia-label" htmlFor="firstName">Nombres</label>
                    <input
                      id="firstName"
                      type="text"
                      className="ia-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                    />
                  </div>

                  <div className="ia-form-group">
                    <label className="ia-label" htmlFor="lastName">Apellidos</label>
                    <input
                      id="lastName"
                      type="text"
                      className="ia-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Tus apellidos"
                      required
                    />
                  </div>

                  {/* Institución Educativa con Combobox de búsqueda en vivo */}
                  <div className="ia-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="ia-label" htmlFor="institution" style={{ marginBottom: 0 }}>
                        Institución Educativa
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {allInstitutions.length} planteles (Escribe para buscar)
                      </span>
                    </div>
                    <SearchableCombobox
                      id="institution"
                      options={institutionOptions}
                      value={selectedInstitution}
                      onChange={handleInstitutionSelect}
                      placeholder="Escribe el nombre de tu universidad o instituto..."
                      required
                    />
                  </div>

                  {/* Carrera con Combobox vinculada a la institución */}
                  <div className="ia-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="ia-label" htmlFor="career" style={{ marginBottom: 0 }}>
                        Carrera
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {availableCareers.length} carreras en {selectedInstitution || 'tu institución'}
                      </span>
                    </div>
                    <SearchableCombobox
                      id="career"
                      options={careerOptions}
                      value={selectedCareer}
                      onChange={setSelectedCareer}
                      placeholder={selectedInstitution ? "Escribe para filtrar tu carrera..." : "Selecciona primero tu institución"}
                      disabled={!selectedInstitution}
                      required
                    />
                  </div>

                  {/* Sede / Campus con Combobox vinculada */}
                  <div className="ia-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="ia-label" htmlFor="location" style={{ marginBottom: 0 }}>
                        Sede / Campus (Opcional)
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {availableSedes.length > 0 ? `${availableSedes.length} sedes registradas` : 'Ubicación libre'}
                      </span>
                    </div>
                    {availableSedes.length > 0 ? (
                      <SearchableCombobox
                        id="location"
                        options={sedeOptions}
                        value={location}
                        onChange={setLocation}
                        placeholder="Escribe o selecciona tu sede o campus..."
                        allowCustom={true}
                      />
                    ) : (
                      <input
                        id="location"
                        type="text"
                        className="ia-input"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ej: Campus San Joaquín, Santiago"
                      />
                    )}
                  </div>

                  {/* Teléfono / WhatsApp */}
                  <div className="ia-form-group">
                    <label className="ia-label" htmlFor="phone">Teléfono / WhatsApp (Opcional)</label>
                    <input
                      id="phone"
                      type="tel"
                      className="ia-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+56 9 1234 5678"
                    />
                  </div>

                  {/* Checkbox Visibilidad Teléfono */}
                  <div className="ia-form-group" style={{ justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155', cursor: 'pointer', marginTop: '14px' }}>
                      <input
                        type="checkbox"
                        checked={showPhone}
                        onChange={(e) => setShowPhone(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                      />
                      <span>Permitir que estudiantes vean mi número para coordinar tutorías</span>
                    </label>
                  </div>

                  {/* GitHub y LinkedIn */}
                  <div className="ia-form-group">
                    <label className="ia-label" htmlFor="githubUrl">GitHub (Opcional)</label>
                    <input
                      id="githubUrl"
                      type="url"
                      className="ia-input"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/tu-usuario"
                    />
                  </div>

                  <div className="ia-form-group">
                    <label className="ia-label" htmlFor="linkedinUrl">LinkedIn (Opcional)</label>
                    <input
                      id="linkedinUrl"
                      type="url"
                      className="ia-input"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/tu-usuario"
                    />
                  </div>

                  {/* Sobre mí */}
                  <div className="ia-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="ia-label" htmlFor="bio">Sobre mí (Breve presentación)</label>
                    <textarea
                      id="bio"
                      className="ia-input"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Cuéntale a tus compañeros tus áreas de interés, ramos que más te apasionan o tu método de estudio..."
                    />
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleCancelEditPersonal}
                    className="ia-btn-secondary"
                    style={{ padding: '9px 18px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="ia-btn-primary"
                    disabled={savingPersonal}
                    style={{ padding: '9px 22px' }}
                  >
                    {savingPersonal ? 'Guardando...' : 'Guardar Información'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* MODO VISTA DE INFORMACIÓN */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              {/* Tarjeta Identidad y Casa de Estudios */}
              <div className="ia-card" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCapIcon size={20} color="#2563eb" />
                    <h2 className="ia-card-title" style={{ margin: 0 }}>Identidad y Casa de Estudios</h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartEditPersonal}
                    className="ia-card-action"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <EditIcon size={14} /> Editar
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nombre completo</span>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>{fullName}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Institución Educativa</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>
                      {profile?.institution || 'No especificada'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Carrera</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                      {profile?.career || 'No especificada'}
                    </div>
                  </div>

                  {profile?.location && (
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Sede / Campus</span>
                      <div style={{ fontSize: '0.92rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPinIcon size={14} color="#64748b" /> {profile.location}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta Contacto y Enlaces */}
              <div className="ia-card" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PhoneIcon size={20} color="#2563eb" />
                    <h2 className="ia-card-title" style={{ margin: 0 }}>Contacto y Redes</h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartEditPersonal}
                    className="ia-card-action"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <EditIcon size={14} /> Editar
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Correo de cuenta</span>
                    <div style={{ fontSize: '0.92rem', color: '#0f172a' }}>{user?.email}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Teléfono / WhatsApp</span>
                    <div style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                      {profile?.phone || 'No registrado'}
                      {profile?.phone && (
                        <span style={{ fontSize: '0.72rem', color: profile.show_phone ? '#16a34a' : '#64748b', marginLeft: '8px', fontWeight: 600 }}>
                          ({profile.show_phone ? 'Visible para estudiantes' : 'Privado'})
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Enlaces Profesionales</span>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {profile?.github_url ? (
                        <a href={profile.github_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          GitHub <ExternalLinkIcon size={13} />
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Sin GitHub</span>
                      )}

                      {profile?.linkedin_url ? (
                        <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          LinkedIn <ExternalLinkIcon size={13} />
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Sin LinkedIn</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta Sobre Mí (Ancho completo) */}
              <div className="ia-card" style={{ gridColumn: '1 / -1', padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 className="ia-card-title" style={{ margin: 0 }}>Sobre mí (Presentación)</h2>
                  <button
                    type="button"
                    onClick={handleStartEditPersonal}
                    className="ia-card-action"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <EditIcon size={14} /> Editar
                  </button>
                </div>
                {profile?.bio ? (
                  <p style={{ color: '#334155', fontSize: '0.94rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {profile.bio}
                  </p>
                ) : (
                  <EmptyState
                    style={{ padding: '16px' }}
                    description="Aún no has agregado una presentación personal. Cuéntale a tus compañeros en qué áreas te desempeñas."
                    action={
                      <button
                        type="button"
                        onClick={handleStartEditPersonal}
                        className="ia-btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                      >
                        Agregar presentación
                      </button>
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* APARTADO 2: MIS TUTORÍAS Y ENSEÑANZA (Lo que puedo impartir)              */}
      {/* ========================================================================= */}
      {activeTab === 'tutoring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tarjeta de Disponibilidad para Tutorías (Solo visible si ya tiene materias acreditadas) */}
          {offeredSubjects.length > 0 && (
            <div
              className="ia-card"
              style={{
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                backgroundColor: availableForTutoring ? '#f0fdf4' : '#f8fafc',
                border: `1.5px solid ${availableForTutoring ? '#bbf7d0' : '#e2e8f0'}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: availableForTutoring ? '#16a34a' : '#94a3b8',
                      display: 'inline-block',
                    }}
                  />
                  <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>
                    {availableForTutoring ? 'Disponible para realizar tutorías' : 'Tutorías pausadas'}
                  </strong>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  {availableForTutoring
                    ? 'Tu perfil aparece en el catálogo de tutores y tus compañeros pueden solicitarte sesiones en tus materias habilitadas.'
                    : 'Tu perfil está oculto del catálogo de tutores; no recibirás nuevas solicitudes.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleTutoringAvailability}
                className={availableForTutoring ? 'ia-btn-secondary' : 'ia-btn-primary'}
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                {availableForTutoring ? 'Pausar disponibilidad' : 'Activar como Tutor'}
              </button>
            </div>
          )}

          {/* BANNER DE IDENTIFICACIÓN INSTITUCIONAL */}
          {!isProfileInstitutionComplete ? (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '16px',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '680px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#d97706',
                    flexShrink: 0,
                  }}
                >
                  <LockIcon size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#92400e', marginBottom: '2px' }}>
                    Identificación Académica Requerida para Habilitarte como Tutor
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#b45309', lineHeight: 1.45 }}>
                    Para rendir la evaluación del Asistente o tramitar respaldo docente oficial en InterAula, es necesario que indiques previamente tu <strong>Institución de Educación Superior</strong> y tu <strong>Carrera</strong> en tu perfil personal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('personal');
                  setIsEditingPersonal(true);
                }}
                className="ia-btn-primary"
                style={{
                  padding: '9px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  background: '#d97706',
                  borderColor: '#b45309',
                }}
              >
                Completar mi Institución y Carrera
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '14px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#16a34a',
                    flexShrink: 0,
                  }}
                >
                  <CheckIcon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Estudiante Acreditado
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                    {profile?.institution} · {profile?.career}
                  </div>
                </div>
              </div>
              <span
                style={{
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  border: '1px solid #86efac',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                Habilitación Desbloqueada
              </span>
            </div>
          )}

          {/* Subcomponente: Materias habilitadas para impartir */}
          <OfferedSubjectsSection
            offeredSubjects={offeredSubjects}
            onRemove={handleRemoveOfferedSubject}
            onStartEvaluation={() => {
              if (!isProfileInstitutionComplete) {
                setActiveTab('personal');
                setIsEditingPersonal(true);
                return;
              }
              setSelectedSubjectForBot(availableForEvaluation[0] || null);
              setIsBotModalOpen(true);
            }}
            onRequestEndorsement={() => {
              if (!isProfileInstitutionComplete) {
                setActiveTab('personal');
                setIsEditingPersonal(true);
                return;
              }
              setIsTeacherModalOpen(true);
            }}
          />

          {/* Acreditación y Habilitación: Tarjeta 1 (Habilitación Técnica Comunitaria) */}
          <div
            className="ia-card"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '12px' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.72rem',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    letterSpacing: '0.02em',
                  }}
                >
                  VÍA RÁPIDA · ACCESO COMUNITARIO
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ClockIcon size={22} color="#2563eb" />
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Habilitación Técnica de Tutores
                  </h2>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', margin: '0 0 18px', lineHeight: 1.6, maxWidth: '780px' }}>
              Rinde una evaluación práctica e interactiva de 10 preguntas con el Asistente Evaluador (15 segundos para alternativas y 45 segundos para desarrollo). Al aprobarla, quedas habilitado de inmediato como <strong>Tutor Comunitario</strong> para recibir solicitudes de apoyo.
            </p>

            <button
              type="button"
              onClick={() => {
                if (!isProfileInstitutionComplete) {
                  setActiveTab('personal');
                  setIsEditingPersonal(true);
                  return;
                }
                setSelectedSubjectForBot(availableForEvaluation[0] || null);
                setIsBotModalOpen(true);
              }}
              className="ia-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '0.88rem',
                fontWeight: 700,
                opacity: isProfileInstitutionComplete ? 1 : 0.8,
              }}
            >
              {!isProfileInstitutionComplete ? (
                <>
                  <LockIcon size={16} color="#ffffff" />
                  <span>Requiere Institución y Carrera</span>
                </>
              ) : (
                <>
                  <ClockIcon size={16} color="#ffffff" />
                  <span>Rendir Evaluación con el Asistente</span>
                </>
              )}
            </button>
          </div>

          {/* Acreditación y Habilitación: Tarjeta 2 (Certificación Institucional) */}
          <div
            className="ia-card"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '12px' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.72rem',
                    backgroundColor: '#eff6ff',
                    color: '#1e40af',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    letterSpacing: '0.02em',
                  }}
                >
                  DISTINCIÓN ACADÉMICA INSTITUCIONAL
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AwardIcon size={22} color="#2563eb" />
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Certificación con Respaldo Docente o Notas Oficiales
                  </h2>
                </div>
              </div>

              {/* Indicador de Casa de Estudios */}
              <div>
                {profile?.institution && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      color: '#0f172a',
                      fontWeight: 700,
                    }}
                  >
                    <GraduationCapIcon size={15} color="#2563eb" />
                    <span>{profile.institution}</span>
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', margin: '0 0 18px', lineHeight: 1.6, maxWidth: '780px' }}>
              Obtén el sello de distinción respaldado por {profile?.institution || 'tu casa de estudios'}. Puedes solicitar la recomendación formal por correo institucional a tu docente titular o adjuntar tu Concentración de Notas oficial (promedio de aprobación 5.5 o superior).
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (!isProfileInstitutionComplete) {
                    setActiveTab('personal');
                    setIsEditingPersonal(true);
                    return;
                  }
                  setIsTeacherModalOpen(true);
                }}
                className="ia-btn-primary"
                style={{
                  padding: '10px 18px',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#0f172a',
                  borderColor: '#0f172a',
                  opacity: isProfileInstitutionComplete ? 1 : 0.8,
                }}
              >
                {!isProfileInstitutionComplete ? (
                  <>
                    <LockIcon size={15} color="#ffffff" />
                    <span>Requiere Institución</span>
                  </>
                ) : (
                  <>
                    <MailIcon size={15} color="#ffffff" />
                    <span>Respaldo de Profesor</span>
                  </>
                )}
              </button>

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
                  padding: '10px 18px',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <UploadCloudIcon size={15} color="#2563eb" />
                <span>Notas Oficiales (PDF)</span>
              </button>
            </div>
          </div>

          {/* Estadísticas de Tutor y Reconocimientos (Solo para tutores habilitados) */}
          {offeredSubjects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              <TutorStats stats={tutorStats} />
              <BadgeList badges={badges} />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* APARTADO 3: MI APRENDIZAJE Y NECESIDADES (Lo que quiero aprender)        */}
      {/* ========================================================================= */}
      {activeTab === 'learning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {preferencesSuccessMsg && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              {preferencesSuccessMsg}
            </div>
          )}

          {/* Subcomponente: Materias que necesito aprender */}
          <NeededSubjectsSection
            neededSubjects={neededSubjects}
            catalogSubjects={catalogSubjects}
            onAdd={handleAddNeededSubject}
            onRemove={handleRemoveNeededSubject}
          />

          {/* Preferencias Pedagógicas y Estilo de Estudio para el Aula Virtual */}
          <div className="ia-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <SparklesIcon size={20} color="#2563eb" />
                  <h2 className="ia-card-title" style={{ margin: 0 }}>
                    Preferencias de Aprendizaje y Estilo de Estudio
                  </h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, maxWidth: '780px' }}>
                  Selecciona cómo te acomoda aprender mejor. En el <strong>Aula Virtual</strong>, los tutores verán estas pautas para modular el ritmo de la explicación, ofrecer pausas de asimilación o estructurar ejercicios prácticos paso a paso.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.74rem',
                  backgroundColor: '#eff6ff',
                  color: '#1e40af',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                Adaptación Aula Virtual
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '16px' }}>
              {LEARNING_PREFERENCES.map((pref) => {
                const isSelected = learningPreferences.includes(pref.id);
                return (
                  <label
                    key={pref.id}
                    onClick={() => handleTogglePreference(pref.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // gestionado por el label
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? '#1e40af' : '#0f172a' }}>
                        {pref.label}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                        {pref.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modales Compartidos */}
      <CertificateVerificationModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        subjectId={selectedSubjectForVerification?.id || availableForEvaluation[0]?.id || catalogSubjects[0]?.id || ''}
        subjectName={selectedSubjectForVerification?.name || availableForEvaluation[0]?.name || catalogSubjects[0]?.name || 'Materia'}
        onSuccess={async () => {
          setIsCertModalOpen(false);
          if (user) {
            const fresh = await profileService.getOfferedSubjects(user.id);
            setOfferedSubjects(fresh);
            if (fresh.length > 0) {
              setAvailableForTutoring(true);
            }
          }
          setBotSuccessToast('Certificado enviado a revisión exitosamente.');
          setTimeout(() => setBotSuccessToast(null), 5000);
        }}
      />

      <TutorValidationBotModal
        isOpen={isBotModalOpen}
        onClose={() => setIsBotModalOpen(false)}
        availableSubjects={availableForEvaluation.length > 0 ? availableForEvaluation : catalogSubjects.map((s) => ({ id: s.id, name: s.name }))}
        defaultSubjectId={selectedSubjectForBot?.id || availableForEvaluation[0]?.id || catalogSubjects[0]?.id}
        userInstitution={profile?.institution || ''}
        userCareer={profile?.career || ''}
        onSuccess={handleBotSuccess}
      />

      <TeacherEndorsementModal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        availableSubjects={availableForEvaluation.length > 0 ? availableForEvaluation : catalogSubjects.map((s) => ({ id: s.id, name: s.name }))}
        defaultSubjectId={availableForEvaluation[0]?.id || catalogSubjects[0]?.id}
        userInstitution={profile?.institution || ''}
        userName={fullName}
        onSuccess={async (data) => {
          setIsTeacherModalOpen(false);
          if (user) {
            const fresh = await profileService.getOfferedSubjects(user.id);
            setOfferedSubjects(fresh);
            if (fresh.length > 0) {
              setAvailableForTutoring(true);
            }
          }
          setBotSuccessToast(`Solicitud enviada al profesor ${data.professorName} para ${data.subjectName}.`);
          setTimeout(() => setBotSuccessToast(null), 5000);
        }}
      />
    </div>
  );
}
