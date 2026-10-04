import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import type {
  Profile,
  Subject,
  OfferedSubject,
  NeededSubject,
  AcademicLevel,
  LearningPreference,
} from '../../types/profile';
import { LEARNING_PREFERENCES } from '../../types/profile';
import {
  ArrowLeftIcon,
  CheckIcon,
  AlertCircleIcon,
  BookOpenIcon,
  UserIcon,
  SparklesIcon,
} from '../../components/common/Icons';
import { isValidUrl } from '../../utils/validators';

// Subcomponentes modulares de catálogos
import OfferedSubjectsSection from './components/OfferedSubjectsSection';
import NeededSubjectsSection from './components/NeededSubjectsSection';

export default function ProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Pestaña activa ('essential' | 'subjects')
  const [activeTab, setActiveTab] = useState<'essential' | 'subjects'>('essential');

  // Estados del perfil principal (Solo lo esencial para tutorías y estudio)
  const [_profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [institution, setInstitution] = useState('Duoc UC');
  const [career, setCareer] = useState('Ingeniería en Informática');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [availableForTutoring, setAvailableForTutoring] = useState(true);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [learningPreferences, setLearningPreferences] = useState<LearningPreference[]>([]);

  // Catálogo de asignaturas críticas de Informática
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);

  // Listas asociadas al perfil del usuario
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);

  // Estados de carga y mensajes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      if (!user) return;
      try {
        setLoading(true);
        const [p, subs, offered, needed] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getSubjects(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
        ]);

        if (isMounted) {
          if (p) {
            setProfile(p);
            setFirstName(p.first_name || '');
            setLastName(p.last_name || '');
            setInstitution(p.institution || 'Duoc UC');
            setCareer(p.career || 'Ingeniería en Informática');
            setBio(p.bio || '');
            setPhone(p.phone || '');
            setAvailableForTutoring(p.available_for_tutoring ?? true);
            setGithubUrl(p.github_url || '');
            setLinkedinUrl(p.linkedin_url || '');
            setShowPhone(Boolean(p.show_phone));
            setLearningPreferences(p.learning_preferences || []);
          }
          setCatalogSubjects(subs);
          setOfferedSubjects(offered);
          setNeededSubjects(needed);
        }
      } catch (err) {
        console.error('[ProfileEdit] Error al cargar información:', err);
        if (isMounted) {
          setErrorMessage('No se pudieron cargar los datos del perfil.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const togglePreference = (prefId: LearningPreference) => {
    setLearningPreferences((prev) =>
      prev.includes(prefId)
        ? prev.filter((id) => id !== prefId)
        : [...prev, prefId]
    );
  };

  // Guardar datos esenciales
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validación de URLs con el validador compartido
    if (!isValidUrl(githubUrl)) {
      setErrorMessage('La URL de GitHub no es válida (ej: https://github.com/usuario).');
      return;
    }
    if (!isValidUrl(linkedinUrl)) {
      setErrorMessage('La URL de LinkedIn no es válida (ej: https://linkedin.com/in/usuario).');
      return;
    }

    const isCompleted = Boolean(
      firstName.trim() &&
      lastName.trim() &&
      institution.trim() &&
      career.trim()
    );

    try {
      setSaving(true);
      const updated = await profileService.updateMyProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        institution: institution.trim() || 'Duoc UC',
        career: career.trim() || 'Ingeniería en Informática',
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        available_for_tutoring: availableForTutoring,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        show_phone: showPhone,
        learning_preferences: learningPreferences,
        profile_completed: isCompleted,
      });

      if (updated) {
        setProfile(updated);
        setSuccessMessage('Datos guardados correctamente.');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err) {
      console.error('[ProfileEdit] Error al guardar perfil:', err);
      setErrorMessage('Ocurrió un error al guardar los cambios en Supabase.');
    } finally {
      setSaving(false);
    }
  };

  // Agregar materia que puedo enseñar
  const handleAddOfferedSubject = async (
    subjectId: string,
    level: AcademicLevel,
    description?: string
  ) => {
    try {
      setErrorMessage(null);
      const added = await profileService.addOfferedSubject(subjectId, level, description);
      setOfferedSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar materia ofrecida:', err);
      setErrorMessage('No se pudo agregar la materia. Revisa que no esté duplicada.');
      throw err;
    }
  };

  // Eliminar materia ofrecida
  const handleRemoveOfferedSubject = async (subjectId: string) => {
    try {
      setErrorMessage(null);
      await profileService.removeOfferedSubject(subjectId);
      setOfferedSubjects((prev) => prev.filter((i) => i.subject_id !== subjectId));
    } catch (err) {
      console.error('[ProfileEdit] Error al eliminar materia ofrecida:', err);
      setErrorMessage('No se pudo eliminar la materia ofrecida.');
      throw err;
    }
  };

  // Agregar materia que necesito aprender
  const handleAddNeededSubject = async (
    subjectId: string,
    currentLevel?: AcademicLevel,
    notes?: string
  ) => {
    try {
      setErrorMessage(null);
      const added = await profileService.addNeededSubject(subjectId, currentLevel, notes);
      setNeededSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar materia necesaria:', err);
      setErrorMessage('No se pudo agregar la materia solicitada.');
      throw err;
    }
  };

  // Eliminar materia necesaria
  const handleRemoveNeededSubject = async (subjectId: string) => {
    try {
      setErrorMessage(null);
      await profileService.removeNeededSubject(subjectId);
      setNeededSubjects((prev) => prev.filter((i) => i.subject_id !== subjectId));
    } catch (err) {
      console.error('[ProfileEdit] Error al eliminar materia:', err);
      setErrorMessage('No se pudo eliminar la materia solicitada.');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600 }}>Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* Encabezado Compacto */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/profile" className="ia-btn-icon-back" aria-label="Volver a mi perfil" title="Volver a mi perfil">
            <ArrowLeftIcon size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Editar Mi Perfil
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Configuración esencial para tutorías y aprendizaje en Ingeniería en Informática
            </p>
          </div>
        </div>

        <Link to="/profile" className="ia-btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
          Ver Mi Perfil Público
        </Link>
      </div>

      {/* Alertas */}
      {successMessage && (
        <div className="ia-banner-alert" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a', marginBottom: '16px', padding: '10px 14px' }}>
          <div className="ia-banner-alert-content">
            <CheckIcon size={18} color="#16a34a" />
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="ia-banner-alert" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', marginBottom: '16px', padding: '10px 14px' }}>
          <div className="ia-banner-alert-content">
            <AlertCircleIcon size={18} color="#dc2626" />
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* PESTAÑAS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '10px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('essential')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            backgroundColor: activeTab === 'essential' ? '#2563eb' : 'transparent',
            color: activeTab === 'essential' ? '#ffffff' : '#64748b',
          }}
        >
          <UserIcon size={16} /> Datos Esenciales y Preferencias
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('subjects')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            backgroundColor: activeTab === 'subjects' ? '#2563eb' : 'transparent',
            color: activeTab === 'subjects' ? '#ffffff' : '#64748b',
          }}
        >
          <BookOpenIcon size={16} /> Mis Asignaturas ({offeredSubjects.length + neededSubjects.length})
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑA 1: DATOS ESENCIALES */}
      {activeTab === 'essential' && (
        <form onSubmit={handleSaveGeneral}>
          <div className="ia-card" style={{ padding: '20px 24px' }}>
            <h2 className="ia-card-title" style={{ marginBottom: '16px', fontSize: '1.05rem' }}>
              Información Básica y Académica
            </h2>

            <div className="ia-form-grid" style={{ gap: '14px' }}>
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

              {/* Institución y Carrera */}
              <div className="ia-form-group">
                <label className="ia-label" htmlFor="institution">Institución Educativa</label>
                <input
                  id="institution"
                  type="text"
                  className="ia-input"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Duoc UC"
                  required
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="career">Carrera</label>
                <input
                  id="career"
                  type="text"
                  className="ia-input"
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
                  placeholder="Ingeniería en Informática"
                  required
                />
              </div>

              {/* Teléfono / WhatsApp de coordinación */}
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

              {/* Visibilidad del teléfono */}
              <div className="ia-form-group" style={{ justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', marginTop: '16px' }}>
                  <input
                    type="checkbox"
                    checked={showPhone}
                    onChange={(e) => setShowPhone(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                  />
                  <span>Permitir que estudiantes vean mi número para coordinar</span>
                </label>
              </div>

              {/* Enlaces profesionales compactos */}
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

              {/* Breve presentación */}
              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="bio">Sobre mí (Breve presentación)</label>
                <textarea
                  id="bio"
                  rows={2}
                  className="ia-textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cuéntanos brevemente tu motivación para aprender y enseñar en la carrera..."
                />
              </div>
            </div>

            {/* Disponibilidad para Tutorías */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <label className="ia-label" style={{ marginBottom: '8px', display: 'block' }}>
                Disponibilidad en la Plataforma
              </label>
              <div
                onClick={() => setAvailableForTutoring(!availableForTutoring)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `1.5px solid ${availableForTutoring ? '#2563eb' : '#e2e8f0'}`,
                  background: availableForTutoring ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  maxWidth: '380px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: availableForTutoring ? '#1d4ed8' : '#334155' }}>
                    Ofrecer Tutorías
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Aparecer en el catálogo de tutores disponibles
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={availableForTutoring}
                  onChange={() => {}}
                  style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                />
              </div>
            </div>

            {/* Preferencias de Aprendizaje y Estilo de Estudio */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <label className="ia-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SparklesIcon size={16} color="#2563eb" />
                  Preferencias de Aprendizaje y Estilo de Estudio
                </label>
                <span style={{ fontSize: '0.74rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  Adaptación en Aula Virtual
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px 0' }}>
                Selecciona tus métodos pedagógicos preferidos. Los tutores verán estas pautas en la sala de clases para adaptar el ritmo, activar pausas de asimilación o usar retos interactivos.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                {LEARNING_PREFERENCES.map((opt) => {
                  const isSelected = learningPreferences.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => togglePreference(opt.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                          {opt.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                        />
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                        {opt.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón Guardar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="submit" className="ia-btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Información Principal'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* CONTENIDO DE PESTAÑA 2: ASIGNATURAS CONCENTRADAS */}
      {activeTab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Materias que enseño */}
          <OfferedSubjectsSection
            offeredSubjects={offeredSubjects}
            catalogSubjects={catalogSubjects}
            onAdd={handleAddOfferedSubject}
            onRemove={handleRemoveOfferedSubject}
          />

          {/* Materias que necesito aprender */}
          <NeededSubjectsSection
            neededSubjects={neededSubjects}
            catalogSubjects={catalogSubjects}
            onAdd={handleAddNeededSubject}
            onRemove={handleRemoveNeededSubject}
          />
        </div>
      )}

      {/* Acciones de navegación de pie de página */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
        <Link to="/profile" className="ia-btn-secondary" style={{ fontSize: '0.84rem' }}>
          Volver a Mi Perfil
        </Link>
        <button
          type="button"
          className="ia-btn-primary"
          onClick={() => navigate('/profile')}
          style={{ fontSize: '0.84rem' }}
        >
          Finalizar y Ver Perfil Completo
        </button>
      </div>
    </div>
  );
}
