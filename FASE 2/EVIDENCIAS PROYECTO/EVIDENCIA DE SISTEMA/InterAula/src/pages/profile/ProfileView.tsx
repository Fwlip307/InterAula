import { useState, useEffect, useMemo } from 'react';
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
import type { TutorStatistics, UserBadge } from '../../types/tutoring';
import type { TutorVerificationRequest } from '../../types/verification';
import {
  UserIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  MapPinIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  MailIcon,
  UploadCloudIcon,
  ClockIcon,
  AwardIcon,
  EditIcon,
  LockIcon,
  CheckIcon,
} from '../../components/common/Icons';
import { getUserDisplayName, getUserInitial } from '../../utils/formatters';
import { isValidUrl } from '../../utils/validators';
import TutorStats from '../../components/common/TutorStats';
import BadgeList from '../../components/common/BadgeList';
import CertificateVerificationModal from './components/CertificateVerificationModal';
import TutorValidationBotModal from './components/TutorValidationBotModal';
import TeacherEndorsementModal from './components/TeacherEndorsementModal';
import OfferedSubjectsSection from './components/OfferedSubjectsSection';
import ProfilePersonalInfoTab, { type PersonalInfoFormData } from './components/ProfilePersonalInfoTab';
import ProfileLearningTab from './components/ProfileLearningTab';
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

  // Estados para Apartado 1: Información Personal y Académica
  const [isEditingPersonal, setIsEditingPersonal] = useState(searchParams.get('edit') === 'true');
  const [selectedInstitution, setSelectedInstitution] = useState('Duoc UC');
  const [selectedCareer, setSelectedCareer] = useState('Ingeniería en Informática');
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
  const availableCareers = selectedInstitution ? getCareersForInstitution(selectedInstitution) : [];
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
            setSelectedInstitution(p.institution || 'Duoc UC');
            setSelectedCareer(p.career || 'Ingeniería en Informática');
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
  const handleSavePersonal = async (data: PersonalInfoFormData) => {
    setPersonalSuccessMsg(null);
    setPersonalErrorMsg(null);

    if (data.githubUrl && !isValidUrl(data.githubUrl)) {
      setPersonalErrorMsg('La URL de GitHub no es válida (ej: https://github.com/usuario).');
      return;
    }
    if (data.linkedinUrl && !isValidUrl(data.linkedinUrl)) {
      setPersonalErrorMsg('La URL de LinkedIn no es válida (ej: https://linkedin.com/in/usuario).');
      return;
    }

    try {
      setSavingPersonal(true);
      const updated = await profileService.updateMyProfile({
        first_name: data.firstName.trim() || null,
        last_name: data.lastName.trim() || null,
        institution: data.institution.trim() || null,
        career: data.career.trim() || null,
        location: data.location.trim() || null,
        bio: data.bio.trim() || null,
        phone: data.phone.trim() || null,
        show_phone: data.showPhone,
        github_url: data.githubUrl.trim() || null,
        linkedin_url: data.linkedinUrl.trim() || null,
      });

      if (updated) {
        setProfile(updated);
        setSelectedInstitution(updated.institution || data.institution);
        setSelectedCareer(updated.career || data.career);
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
  const handleAddOfferedSubject = async (
    subjectId: string,
    level: AcademicLevel,
    description?: string
  ) => {
    const added = await profileService.addOfferedSubject(subjectId, level, description);
    setOfferedSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
    if (!availableForTutoring) {
      setAvailableForTutoring(true);
      await profileService.updateMyProfile({ available_for_tutoring: true });
    }
  };

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
        <ProfilePersonalInfoTab
          profile={profile}
          userEmail={user?.email}
          fullName={fullName}
          isEditing={isEditingPersonal}
          onStartEdit={handleStartEditPersonal}
          onCancelEdit={handleCancelEditPersonal}
          onSave={handleSavePersonal}
          saving={savingPersonal}
          successMsg={personalSuccessMsg}
          errorMsg={personalErrorMsg}
          institutionOptions={institutionOptions}
          careerOptions={careerOptions}
          sedeOptions={sedeOptions}
          allInstitutionsCount={allInstitutions.length}
          availableCareersCount={availableCareers.length}
          availableSedesCount={availableSedes.length}
          selectedInstitution={selectedInstitution}
          selectedCareer={selectedCareer}
          onInstitutionChange={handleInstitutionSelect}
          onCareerChange={setSelectedCareer}
        />
      )}

      {/* ========================================================================= */}
      {/* APARTADO 2: MIS TUTORÍAS Y ENSEÑANZA (Lo que puedo impartir)              */}
      {/* ========================================================================= */}
      {activeTab === 'tutoring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* GUÍA PASO A PASO PARA CERTIFICARSE COMO TUTOR */}
          <div
            className="ia-card"
            style={{
              padding: '24px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #bbf7d0',
              borderRadius: '16px',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#15803d',
                  }}
                >
                  <ShieldCheckIcon size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    ¿Cómo Certificarme como Tutor en InterAula?
                  </h2>
                  <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '2px 0 0' }}>
                    Guía oficial paso a paso para acreditar tus conocimientos y ser reconocido en la comunidad universitaria.
                  </p>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  backgroundColor: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                }}
              >
                Proceso Oficial en 4 Pasos
              </span>
            </div>

            {/* Grilla de los 4 pasos */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              {/* Paso 1 */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    1
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Identificación Académica</strong>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Configura tu <strong>Institución</strong> (ej: Duoc UC) y tu <strong>Carrera</strong> en tus datos personales para desbloquear la habilitación.
                </p>
              </div>

              {/* Paso 2 */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    2
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Selecciona tu Materia</strong>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Elige una o más materias de tu malla curricular que hayas cursado y aprobado con buen rendimiento para impartir.
                </p>
              </div>

              {/* Paso 3 */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#d97706',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    3
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Certificado de Notas (PDF)</strong>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Sube tu <strong>Certificado Académico oficial en PDF</strong> para que el sistema extraiga y valide curricularmente tu aprobación.
                </p>
              </div>

              {/* Paso 4 */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    4
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Evaluación IA o Docente</strong>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Rinde la prueba técnica interactiva con el <strong>Asistente IA</strong> en tiempo real o solicita el respaldo directo de tu profesor.
                </p>
              </div>
            </div>

            {/* Beneficios obtenidos */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#166534', fontWeight: 600 }}>
                <CheckIcon size={16} color="#16a34a" />
                <span>
                  Al certificarte obtienes la <strong>Insignia de Tutor Verificado</strong>, apareces en el catálogo para recibir alumnos y puedes crear talleres grupales.
                </span>
              </div>
            </div>
          </div>
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
            onAddSubject={handleAddOfferedSubject}
            catalogSubjects={availableForEvaluation.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category || 'General',
              is_pilot: s.isBoosted || false,
              created_at: new Date().toISOString(),
            }))}
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
        <ProfileLearningTab
          preferencesSuccessMsg={preferencesSuccessMsg}
          neededSubjects={neededSubjects}
          catalogSubjects={catalogSubjects}
          onAddNeededSubject={handleAddNeededSubject}
          onRemoveNeededSubject={handleRemoveNeededSubject}
          learningPreferences={learningPreferences}
          onTogglePreference={handleTogglePreference}
        />
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
