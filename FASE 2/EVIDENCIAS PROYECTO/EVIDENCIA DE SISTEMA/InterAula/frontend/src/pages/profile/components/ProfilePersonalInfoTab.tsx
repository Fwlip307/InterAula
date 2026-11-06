import React, { useState, useEffect } from 'react';
import type { Profile } from '../../../types/profile';
import {
  GraduationCapIcon,
  MapPinIcon,
  PhoneIcon,
  ExternalLinkIcon,
  EditIcon,
} from '../../../components/common/Icons';
import EmptyState from '../../../components/common/EmptyState';
import SearchableCombobox from '../../../components/common/SearchableCombobox';

export interface PersonalInfoFormData {
  firstName: string;
  lastName: string;
  institution: string;
  career: string;
  location: string;
  phone: string;
  showPhone: boolean;
  githubUrl: string;
  linkedinUrl: string;
  bio: string;
}

interface ProfilePersonalInfoTabProps {
  profile: Profile | null;
  userEmail?: string;
  fullName: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: PersonalInfoFormData) => Promise<void>;
  saving: boolean;
  successMsg: string | null;
  errorMsg: string | null;
  institutionOptions: { value: string; label: string; group?: string; subLabel?: string }[];
  careerOptions: { value: string; label: string }[];
  sedeOptions: { value: string; label: string; subLabel?: string }[];
  allInstitutionsCount: number;
  availableCareersCount: number;
  availableSedesCount: number;
  selectedInstitution: string;
  selectedCareer: string;
  onInstitutionChange: (institution: string) => void;
  onCareerChange: (career: string) => void;
}

export default function ProfilePersonalInfoTab({
  profile,
  userEmail,
  fullName,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  saving,
  successMsg,
  errorMsg,
  institutionOptions,
  careerOptions,
  sedeOptions,
  allInstitutionsCount,
  availableCareersCount,
  availableSedesCount,
  selectedInstitution,
  selectedCareer,
  onInstitutionChange,
  onCareerChange,
}: ProfilePersonalInfoTabProps) {
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [showPhone, setShowPhone] = useState(Boolean(profile?.show_phone));
  const [githubUrl, setGithubUrl] = useState(profile?.github_url || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url || '');

  // Sincronizar estado local al cambiar el perfil
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setLocation(profile.location || '');
      setBio(profile.bio || '');
      setPhone(profile.phone || '');
      setShowPhone(Boolean(profile.show_phone));
      setGithubUrl(profile.github_url || '');
      setLinkedinUrl(profile.linkedin_url || '');
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      firstName,
      lastName,
      institution: selectedInstitution,
      career: selectedCareer,
      location,
      phone,
      showPhone,
      githubUrl,
      linkedinUrl,
      bio,
    });
  };

  return (
    <div>
      {successMsg && (
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
          {successMsg}
        </div>
      )}

      {errorMsg && (
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
          {errorMsg}
        </div>
      )}

      {isEditing ? (
        /* MODO EDICIÓN EN EL MISMO LUGAR */
        <form onSubmit={handleSubmit}>
          <div className="ia-card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 className="ia-card-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                Editar Información Personal y Académica
              </h2>
              <button
                type="button"
                onClick={onCancelEdit}
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
                    {allInstitutionsCount} planteles (Escribe para buscar)
                  </span>
                </div>
                <SearchableCombobox
                  id="institution"
                  options={institutionOptions}
                  value={selectedInstitution}
                  onChange={onInstitutionChange}
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
                    {availableCareersCount} carreras en {selectedInstitution || 'tu institución'}
                  </span>
                </div>
                <SearchableCombobox
                  id="career"
                  options={careerOptions}
                  value={selectedCareer}
                  onChange={onCareerChange}
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
                    {availableSedesCount > 0 ? `${availableSedesCount} sedes registradas` : 'Ubicación libre'}
                  </span>
                </div>
                {availableSedesCount > 0 ? (
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
                onClick={onCancelEdit}
                className="ia-btn-secondary"
                style={{ padding: '9px 18px' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ia-btn-primary"
                disabled={saving}
                style={{ padding: '9px 22px' }}
              >
                {saving ? 'Guardando...' : 'Guardar Información'}
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
                onClick={onStartEdit}
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
                onClick={onStartEdit}
                className="ia-card-action"
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <EditIcon size={14} /> Editar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Correo de cuenta</span>
                <div style={{ fontSize: '0.92rem', color: '#0f172a' }}>{userEmail}</div>
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
                onClick={onStartEdit}
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
                    onClick={onStartEdit}
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
  );
}
