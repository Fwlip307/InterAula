import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import type {
  Profile,
  Subject,
  OfferedSubject,
  NeededSubject,
  Skill,
  ProfileSkill,
  ProjectInterest,
  ProfileProjectInterest,
  AcademicLevel,
} from '../../types/profile';
import {
  ArrowLeftIcon,
  CheckIcon,
  AlertCircleIcon,
  BriefcaseIcon,
} from '../../components/common/Icons';
import { isValidUrl } from '../../utils/validators';

// Subcomponentes modulares de catálogos
import OfferedSubjectsSection from './components/OfferedSubjectsSection';
import NeededSubjectsSection from './components/NeededSubjectsSection';
import SkillsSection from './components/SkillsSection';
import InterestsSection from './components/InterestsSection';

export default function ProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Estados del perfil principal
  const [_profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [institution, setInstitution] = useState('');
  const [career, setCareer] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [availableForTutoring, setAvailableForTutoring] = useState(true);
  const [availableForProjects, setAvailableForProjects] = useState(true);
  const [projectBio, setProjectBio] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Catálogos generales de la base de datos
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);
  const [catalogSkills, setCatalogSkills] = useState<Skill[]>([]);
  const [catalogInterests, setCatalogInterests] = useState<ProjectInterest[]>([]);

  // Listas asociadas al perfil del usuario
  const [offeredSubjects, setOfferedSubjects] = useState<OfferedSubject[]>([]);
  const [neededSubjects, setNeededSubjects] = useState<NeededSubject[]>([]);
  const [userSkills, setUserSkills] = useState<ProfileSkill[]>([]);
  const [userInterests, setUserInterests] = useState<ProfileProjectInterest[]>([]);

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
        const [
          p,
          subs,
          skls,
          ints,
          offered,
          needed,
          uSkills,
          uInterests,
        ] = await Promise.all([
          profileService.getMyProfile(),
          profileService.getSubjects(),
          profileService.getSkills(),
          profileService.getProjectInterests(),
          profileService.getOfferedSubjects(user.id),
          profileService.getNeededSubjects(user.id),
          profileService.getProfileSkills(user.id),
          profileService.getProfileProjectInterests(user.id),
        ]);

        if (isMounted) {
          if (p) {
            setProfile(p);
            setFirstName(p.first_name || '');
            setLastName(p.last_name || '');
            setDisplayName(p.display_name || '');
            setInstitution(p.institution || '');
            setCareer(p.career || '');
            setLocation(p.location || '');
            setBio(p.bio || '');
            setAvailableForTutoring(p.available_for_tutoring);
            setAvailableForProjects(p.available_for_projects);
            setProjectBio(p.project_bio || '');
            setPortfolioUrl(p.portfolio_url || '');
            setGithubUrl(p.github_url || '');
            setLinkedinUrl(p.linkedin_url || '');
          }
          setCatalogSubjects(subs);
          setCatalogSkills(skls);
          setCatalogInterests(ints);
          setOfferedSubjects(offered);
          setNeededSubjects(needed);
          setUserSkills(uSkills);
          setUserInterests(uInterests);
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

  // Guardar información del formulario general
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validación de URLs con el validador compartido
    if (!isValidUrl(portfolioUrl)) {
      setErrorMessage('La URL del sitio web o portafolio no es válida (ej: https://ejemplo.com).');
      return;
    }
    if (!isValidUrl(githubUrl)) {
      setErrorMessage('La URL de GitHub no es válida (ej: https://github.com/usuario).');
      return;
    }
    if (!isValidUrl(linkedinUrl)) {
      setErrorMessage('La URL de LinkedIn no es válida (ej: https://linkedin.com/in/usuario).');
      return;
    }

    // Verificar si los campos requeridos para considerar completo el perfil están presentes
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
        display_name: displayName.trim() || null,
        institution: institution.trim() || null,
        career: career.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        available_for_tutoring: availableForTutoring,
        available_for_projects: availableForProjects,
        project_bio: projectBio.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        profile_completed: isCompleted,
      });

      if (updated) {
        setProfile(updated);
        setSuccessMessage('¡Perfil actualizado con éxito!');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error('[ProfileEdit] Error al guardar perfil:', err);
      setErrorMessage('Ocurrió un error al guardar los cambios en Supabase.');
    } finally {
      setSaving(false);
    }
  };

  // 14. Agregar materia que puedo enseñar
  const handleAddOfferedSubject = async (subjectId: string, level: AcademicLevel, description: string) => {
    try {
      setErrorMessage(null);
      const added = await profileService.addOfferedSubject(subjectId, level, description);
      setOfferedSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar materia ofrecida:', err);
      setErrorMessage('No se pudo agregar la materia ofrecida.');
      throw err;
    }
  };

  // Eliminar materia que puedo enseñar
  const handleRemoveOfferedSubject = async (subjectId: string) => {
    try {
      setErrorMessage(null);
      await profileService.removeOfferedSubject(subjectId);
      setOfferedSubjects((prev) => prev.filter((i) => i.subject_id !== subjectId));
    } catch (err) {
      console.error('[ProfileEdit] Error al eliminar materia:', err);
      setErrorMessage('No se pudo eliminar la materia.');
      throw err;
    }
  };

  // 15. Agregar materia que quiero aprender
  const handleAddNeededSubject = async (subjectId: string, level: AcademicLevel, notes: string) => {
    try {
      setErrorMessage(null);
      const added = await profileService.addNeededSubject(subjectId, level, notes);
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

  // 16. Agregar habilidad de proyecto
  const handleAddSkill = async (skillId: string, level: AcademicLevel) => {
    try {
      setErrorMessage(null);
      const added = await profileService.addProfileSkill(skillId, level);
      setUserSkills((prev) => [...prev.filter((s) => s.skill_id !== added.skill_id), added]);
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar habilidad:', err);
      setErrorMessage('No se pudo agregar la habilidad.');
      throw err;
    }
  };

  // Eliminar habilidad de proyecto
  const handleRemoveSkill = async (skillId: string) => {
    try {
      setErrorMessage(null);
      await profileService.removeProfileSkill(skillId);
      setUserSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
    } catch (err) {
      console.error('[ProfileEdit] Error al eliminar habilidad:', err);
      setErrorMessage('No se pudo eliminar la habilidad.');
      throw err;
    }
  };

  // 17. Alternar interés de proyectos (Toggle Chip)
  const handleToggleInterest = async (interestId: string) => {
    const isSelected = userInterests.some((i) => i.interest_id === interestId);
    try {
      setErrorMessage(null);
      if (isSelected) {
        await profileService.removeProjectInterest(interestId);
        setUserInterests((prev) => prev.filter((i) => i.interest_id !== interestId));
      } else {
        const added = await profileService.addProjectInterest(interestId);
        setUserInterests((prev) => [...prev, added]);
      }
    } catch (err) {
      console.error('[ProfileEdit] Error al alternar interés:', err);
      setErrorMessage('No se pudo actualizar el área de interés.');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b', fontSize: '1.05rem' }}>Cargando formulario de edición...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Botón Volver y Encabezado de Página */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/profile" className="ia-btn-secondary" style={{ padding: '8px 12px' }} title="Volver a mi perfil">
            <ArrowLeftIcon size={16} />
            Volver
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Editar Mi Perfil
          </h1>
        </div>
      </div>

      {/* Alertas de Éxito / Error */}
      {successMessage && (
        <div className="ia-banner-alert" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a', marginBottom: '20px' }}>
          <div className="ia-banner-alert-content">
            <CheckIcon size={20} color="#16a34a" />
            <span style={{ fontWeight: 600 }}>{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="ia-banner-alert" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', marginBottom: '20px' }}>
          <div className="ia-banner-alert-content">
            <AlertCircleIcon size={20} color="#dc2626" />
            <span style={{ fontWeight: 600 }}>{errorMessage}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveGeneral}>
        {/* 13. Información personal y académica */}
        <div className="ia-form-section">
          <h2 className="ia-form-section-title">Información Personal y Académica</h2>
          <p className="ia-form-section-desc">
            Datos básicos para que compañeros de tu institución puedan reconocerte y colaborar contigo.
          </p>

          <div className="ia-form-grid">
            <div className="ia-form-group">
              <label className="ia-label" htmlFor="firstName">
                Nombres <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="firstName"
                type="text"
                className="ia-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej. Felipe"
                required
              />
            </div>

            <div className="ia-form-group">
              <label className="ia-label" htmlFor="lastName">
                Apellidos <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="lastName"
                type="text"
                className="ia-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej. Aravena"
                required
              />
            </div>

            <div className="ia-form-group">
              <label className="ia-label" htmlFor="displayName">
                Nombre de usuario o alias
              </label>
              <input
                id="displayName"
                type="text"
                className="ia-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej. felipe.dev"
              />
            </div>

            <div className="ia-form-group">
              <label className="ia-label" htmlFor="email">
                Correo institucional / de registro
              </label>
              <input
                id="email"
                type="email"
                className="ia-input"
                value={user?.email || ''}
                disabled
                title="El correo de autenticación no se modifica desde aquí"
              />
              <span className="ia-label-hint">El correo principal no es editable directamente.</span>
            </div>

            <div className="ia-form-group">
              <label className="ia-label" htmlFor="institution">
                Universidad o Instituto <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="institution"
                type="text"
                className="ia-input"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ej. Universidad de Chile, INACAP, etc."
                required
              />
            </div>

            <div className="ia-form-group">
              <label className="ia-label" htmlFor="career">
                Carrera académica <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="career"
                type="text"
                className="ia-input"
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                placeholder="Ej. Ingeniería Civil en Informática"
                required
              />
            </div>

            <div className="ia-form-group full">
              <label className="ia-label" htmlFor="location">
                Ciudad / Región
              </label>
              <input
                id="location"
                type="text"
                className="ia-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Santiago, Chile"
              />
            </div>

            <div className="ia-form-group full">
              <label className="ia-label" htmlFor="bio">
                Sobre mí (Breve descripción)
              </label>
              <textarea
                id="bio"
                rows={3}
                className="ia-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Cuéntanos sobre tus intereses académicos, métodos de estudio o qué te motiva a aprender y enseñar..."
              />
            </div>
          </div>
        </div>

        {/* 13. Disponibilidad */}
        <div className="ia-form-section">
          <h2 className="ia-form-section-title">Disponibilidad de Participación</h2>
          <p className="ia-form-section-desc">
            Configura cómo deseas que otros estudiantes interactúen contigo en la plataforma.
          </p>

          <div className="ia-switch-card">
            <div className="ia-switch-info">
              <h4>Disponible para ofrecer tutorías</h4>
              <p>Permite que otros estudiantes te encuentren y soliciten apoyo en las materias que dominas.</p>
            </div>
            <label className="ia-switch">
              <input
                type="checkbox"
                checked={availableForTutoring}
                onChange={(e) => setAvailableForTutoring(e.target.checked)}
              />
              <span className="ia-slider" />
            </label>
          </div>

          <div className="ia-switch-card">
            <div className="ia-switch-info">
              <h4>Disponible para participar en proyectos</h4>
              <p>Aparece como colaborador activo en el Hub de Proyectos para formar equipos multidisciplinarios.</p>
            </div>
            <label className="ia-switch">
              <input
                type="checkbox"
                checked={availableForProjects}
                onChange={(e) => setAvailableForProjects(e.target.checked)}
              />
              <span className="ia-slider" />
            </label>
          </div>
        </div>

        {/* 13. Perfil para proyectos y enlaces */}
        <div className="ia-form-section">
          <h2 className="ia-form-section-title">
            <BriefcaseIcon size={20} color="#2563eb" /> Perfil para el Hub de Proyectos
          </h2>
          <p className="ia-form-section-desc">
            Comparte tus enlaces profesionales para que líderes de proyectos puedan evaluar tu experiencia y portafolio.
          </p>

          <div className="ia-form-grid">
            <div className="ia-form-group full">
              <label className="ia-label" htmlFor="projectBio">
                Enfoque en Proyectos
              </label>
              <textarea
                id="projectBio"
                rows={2}
                className="ia-textarea"
                value={projectBio}
                onChange={(e) => setProjectBio(e.target.value)}
                placeholder="Describe tu rol preferido en proyectos (ej. Desarrollo Backend con Python, Diseño UI en Figma, etc.)..."
              />
            </div>

            <div className="ia-form-group">
              <label className="ia-label" htmlFor="githubUrl">
                Enlace a GitHub
              </label>
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
              <label className="ia-label" htmlFor="linkedinUrl">
                Enlace a LinkedIn
              </label>
              <input
                id="linkedinUrl"
                type="url"
                className="ia-input"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/tu-usuario"
              />
            </div>

            <div className="ia-form-group full">
              <label className="ia-label" htmlFor="portfolioUrl">
                Sitio Web o Portafolio
              </label>
              <input
                id="portfolioUrl"
                type="url"
                className="ia-input"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://tuportafolio.com"
              />
            </div>
          </div>
        </div>

        {/* Botón Guardar Datos Generales */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <button type="submit" className="ia-btn-primary" disabled={saving}>
            {saving ? 'Guardando cambios...' : 'Guardar Información Principal'}
          </button>
        </div>
      </form>

      {/* 14. Gestionar Materias que Puedo Enseñar (Subcomponente modular) */}
      <OfferedSubjectsSection
        offeredSubjects={offeredSubjects}
        catalogSubjects={catalogSubjects}
        onAdd={handleAddOfferedSubject}
        onRemove={handleRemoveOfferedSubject}
      />

      {/* 15. Gestionar Materias que Quiero Aprender (Subcomponente modular) */}
      <NeededSubjectsSection
        neededSubjects={neededSubjects}
        catalogSubjects={catalogSubjects}
        onAdd={handleAddNeededSubject}
        onRemove={handleRemoveNeededSubject}
      />

      {/* 16. Habilidades para el Hub de Proyectos (Subcomponente modular) */}
      <SkillsSection
        userSkills={userSkills}
        catalogSkills={catalogSkills}
        onAdd={handleAddSkill}
        onRemove={handleRemoveSkill}
      />

      {/* 17. Intereses para Proyectos (Subcomponente modular) */}
      <InterestsSection
        userInterests={userInterests}
        catalogInterests={catalogInterests}
        onToggle={handleToggleInterest}
      />

      {/* Acciones de pie de página */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <Link to="/profile" className="ia-btn-secondary">
          Volver a Mi Perfil
        </Link>
        <button
          type="button"
          className="ia-btn-primary"
          onClick={() => navigate('/profile')}
        >
          Finalizar y Ver Perfil
        </button>
      </div>
    </div>
  );
}
