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
  PlusIcon,
  TrashIcon,
  BookOpenIcon,
  UsersIcon,
  CodeIcon,
  SparklesIcon,
  BriefcaseIcon,
} from '../../components/common/Icons';

export default function ProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Estados del perfil
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

  // Formulario rápido para agregar materia a enseñar
  const [newOfferedSubjectId, setNewOfferedSubjectId] = useState('');
  const [newOfferedLevel, setNewOfferedLevel] = useState<AcademicLevel>('intermediate');
  const [newOfferedDesc, setNewOfferedDesc] = useState('');

  // Formulario rápido para agregar materia que necesita aprender
  const [newNeededSubjectId, setNewNeededSubjectId] = useState('');
  const [newNeededLevel, setNewNeededLevel] = useState<AcademicLevel>('basic');
  const [newNeededNotes, setNewNeededNotes] = useState('');

  // Formulario rápido para agregar habilidad técnica
  const [newSkillId, setNewSkillId] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<AcademicLevel>('intermediate');

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

  // Validar URL opcional
  const isValidUrl = (url: string) => {
    if (!url.trim()) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Guardar información del formulario general
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validar URLs
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

    // Requisito 18: Verificar si el perfil está completo
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
  const handleAddOfferedSubject = async () => {
    if (!newOfferedSubjectId) return;
    try {
      setErrorMessage(null);
      const added = await profileService.addOfferedSubject(
        newOfferedSubjectId,
        newOfferedLevel,
        newOfferedDesc.trim()
      );
      setOfferedSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
      setNewOfferedSubjectId('');
      setNewOfferedDesc('');
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar materia ofrecida:', err);
      setErrorMessage('No se pudo agregar la materia ofrecida.');
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
    }
  };

  // 15. Agregar materia que quiero aprender
  const handleAddNeededSubject = async () => {
    if (!newNeededSubjectId) return;
    try {
      setErrorMessage(null);
      const added = await profileService.addNeededSubject(
        newNeededSubjectId,
        newNeededLevel,
        newNeededNotes.trim()
      );
      setNeededSubjects((prev) => [...prev.filter((i) => i.subject_id !== added.subject_id), added]);
      setNewNeededSubjectId('');
      setNewNeededNotes('');
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar materia necesaria:', err);
      setErrorMessage('No se pudo agregar la materia solicitada.');
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
    }
  };

  // 16. Agregar habilidad de proyecto
  const handleAddSkill = async () => {
    if (!newSkillId) return;
    try {
      setErrorMessage(null);
      const added = await profileService.addProfileSkill(newSkillId, newSkillLevel);
      setUserSkills((prev) => [...prev.filter((s) => s.skill_id !== added.skill_id), added]);
      setNewSkillId('');
    } catch (err) {
      console.error('[ProfileEdit] Error al agregar habilidad:', err);
      setErrorMessage('No se pudo agregar la habilidad.');
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
    }
  };

  if (loading) {
    return (
      <div className="ia-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b', fontSize: '1.05rem' }}>Cargando formulario de edición...</p>
      </div>
    );
  }

  // Materias aún no agregadas a ofrecidas
  const availableCatalogOffered = catalogSubjects.filter(
    (s) => !offeredSubjects.some((o) => o.subject_id === s.id)
  );

  // Materias aún no agregadas a necesitadas
  const availableCatalogNeeded = catalogSubjects.filter(
    (s) => !neededSubjects.some((n) => n.subject_id === s.id)
  );

  // Habilidades aún no agregadas
  const availableCatalogSkills = catalogSkills.filter(
    (s) => !userSkills.some((u) => u.skill_id === s.id)
  );

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

      {/* 14. Gestionar Materias que Puedo Enseñar */}
      <div className="ia-form-section" id="offered-subjects">
        <h2 className="ia-form-section-title">
          <BookOpenIcon size={20} color="#2563eb" /> Materias que Puedo Enseñar ({offeredSubjects.length})
        </h2>
        <p className="ia-form-section-desc">
          Selecciona materias del catálogo en las que tengas buen dominio y desees compartir con compañeros.
        </p>

        {/* Formulario para añadir */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Materia</label>
            <select
              className="ia-select"
              value={newOfferedSubjectId}
              onChange={(e) => setNewOfferedSubjectId(e.target.value)}
            >
              <option value="">-- Selecciona una materia --</option>
              {availableCatalogOffered.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.category ? `(${s.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '140px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Nivel de Dominio</label>
            <select
              className="ia-select"
              value={newOfferedLevel}
              onChange={(e) => setNewOfferedLevel(e.target.value as AcademicLevel)}
            >
              <option value="basic">Básico</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>

          <div style={{ flex: '2', minWidth: '200px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Descripción / Enfoque (opcional)</label>
            <input
              type="text"
              className="ia-input"
              value={newOfferedDesc}
              onChange={(e) => setNewOfferedDesc(e.target.value)}
              placeholder="Ej. Apoyo en ejercicios y preparación de certámenes"
            />
          </div>

          <button
            type="button"
            className="ia-btn-primary"
            onClick={handleAddOfferedSubject}
            disabled={!newOfferedSubjectId}
            style={{ height: '42px' }}
          >
            <PlusIcon size={16} /> Agregar
          </button>
        </div>

        {/* Listado de materias a enseñar */}
        {offeredSubjects.length > 0 ? (
          <div className="ia-catalog-list">
            {offeredSubjects.map((item) => (
              <div key={item.subject_id} className="ia-catalog-item">
                <div className="ia-catalog-item-info">
                  <div>
                    <span className="ia-catalog-item-title">{item.subject?.name}</span>
                    {item.description && (
                      <p className="ia-catalog-item-desc">{item.description}</p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="ia-badge ia-badge-blue">
                    {item.level === 'basic' ? 'Básico' : item.level === 'intermediate' ? 'Intermedio' : 'Avanzado'}
                  </span>
                  <button
                    type="button"
                    className="ia-btn-icon-danger"
                    onClick={() => handleRemoveOfferedSubject(item.subject_id)}
                    title="Eliminar materia"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Aún no has agregado materias que puedas enseñar.
          </p>
        )}
      </div>

      {/* 15. Gestionar Materias que Quiero Aprender */}
      <div className="ia-form-section" id="needed-subjects">
        <h2 className="ia-form-section-title">
          <UsersIcon size={20} color="#16a34a" /> Materias en las que Necesito Ayuda ({neededSubjects.length})
        </h2>
        <p className="ia-form-section-desc">
          Indica asignaturas donde requieras reforzamiento, tutorías pares o resolución de dudas.
        </p>

        {/* Formulario para añadir */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Materia</label>
            <select
              className="ia-select"
              value={newNeededSubjectId}
              onChange={(e) => setNewNeededSubjectId(e.target.value)}
            >
              <option value="">-- Selecciona una materia --</option>
              {availableCatalogNeeded.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.category ? `(${s.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '140px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Nivel Actual</label>
            <select
              className="ia-select"
              value={newNeededLevel}
              onChange={(e) => setNewNeededLevel(e.target.value as AcademicLevel)}
            >
              <option value="basic">Básico</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>

          <div style={{ flex: '2', minWidth: '200px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Nota / Dificultad (opcional)</label>
            <input
              type="text"
              className="ia-input"
              value={newNeededNotes}
              onChange={(e) => setNewNeededNotes(e.target.value)}
              placeholder="Ej. Me cuesta la unidad de integrales triples"
            />
          </div>

          <button
            type="button"
            className="ia-btn-primary"
            onClick={handleAddNeededSubject}
            disabled={!newNeededSubjectId}
            style={{ height: '42px' }}
          >
            <PlusIcon size={16} /> Solicitar
          </button>
        </div>

        {/* Listado de materias a aprender */}
        {neededSubjects.length > 0 ? (
          <div className="ia-catalog-list">
            {neededSubjects.map((item) => (
              <div key={item.subject_id} className="ia-catalog-item">
                <div className="ia-catalog-item-info">
                  <div>
                    <span className="ia-catalog-item-title">{item.subject?.name}</span>
                    {item.notes && (
                      <p className="ia-catalog-item-desc">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.current_level && (
                    <span className="ia-badge ia-badge-amber">
                      {item.current_level === 'basic' ? 'Básico' : item.current_level === 'intermediate' ? 'Intermedio' : 'Avanzado'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ia-btn-icon-danger"
                    onClick={() => handleRemoveNeededSubject(item.subject_id)}
                    title="Eliminar materia"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Aún no has indicado materias en las que necesites apoyo.
          </p>
        )}
      </div>

      {/* 16. Habilidades para el Hub de Proyectos */}
      <div className="ia-form-section">
        <h2 className="ia-form-section-title">
          <CodeIcon size={20} color="#d97706" /> Habilidades para Proyectos ({userSkills.length})
        </h2>
        <p className="ia-form-section-desc">
          Registra tus conocimientos técnicos o habilidades prácticas para aportar en equipos colaborativos.
        </p>

        {/* Formulario para añadir habilidad */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Habilidad</label>
            <select
              className="ia-select"
              value={newSkillId}
              onChange={(e) => setNewSkillId(e.target.value)}
            >
              <option value="">-- Selecciona una habilidad --</option>
              {availableCatalogSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.category ? `(${s.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '140px' }}>
            <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Nivel</label>
            <select
              className="ia-select"
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(e.target.value as AcademicLevel)}
            >
              <option value="basic">Básico</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>

          <button
            type="button"
            className="ia-btn-primary"
            onClick={handleAddSkill}
            disabled={!newSkillId}
            style={{ height: '42px' }}
          >
            <PlusIcon size={16} /> Agregar Habilidad
          </button>
        </div>

        {/* Listado de habilidades */}
        {userSkills.length > 0 ? (
          <div className="ia-catalog-list">
            {userSkills.map((item) => (
              <div key={item.skill_id} className="ia-catalog-item">
                <span className="ia-catalog-item-title">{item.skill?.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="ia-badge ia-badge-amber">
                    {item.level === 'basic' ? 'Básico' : item.level === 'intermediate' ? 'Intermedio' : 'Avanzado'}
                  </span>
                  <button
                    type="button"
                    className="ia-btn-icon-danger"
                    onClick={() => handleRemoveSkill(item.skill_id)}
                    title="Eliminar habilidad"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
            No has agregado habilidades técnicas aún.
          </p>
        )}
      </div>

      {/* 17. Intereses para Proyectos (Chips seleccionables) */}
      <div className="ia-form-section">
        <h2 className="ia-form-section-title">
          <SparklesIcon size={20} color="#9333ea" /> Áreas de Proyectos que me Interesan ({userInterests.length})
        </h2>
        <p className="ia-form-section-desc">
          Haz clic en las temáticas en las que te gustaría participar o crear proyectos:
        </p>

        <div className="ia-chips-grid">
          {catalogInterests.map((int) => {
            const isSelected = userInterests.some((u) => u.interest_id === int.id);
            return (
              <button
                key={int.id}
                type="button"
                className={`ia-chip-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleToggleInterest(int.id)}
              >
                {isSelected && <CheckIcon size={14} color="#ffffff" />}
                {int.name}
              </button>
            );
          })}
        </div>
      </div>

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
