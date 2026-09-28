import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import { tutoringService, type AvailableTutor } from '../../services/tutoring.service';
import type { Subject } from '../../types/profile';
import {
  getUserDisplayName,
  getUserInitial,
  formatAcademicLevel,
} from '../../utils/formatters';
import {
  SearchIcon,
  FilterIcon,
  StarIcon,
  AwardIcon,
  UsersIcon,
  GraduationCapIcon,
  AlertCircleIcon,
  CheckIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';
import RequestTutoringModal from './components/RequestTutoringModal';

export default function TutoringExplore() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState<AvailableTutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Tutor seleccionado para el modal de solicitud
  const [selectedTutorForModal, setSelectedTutorForModal] = useState<AvailableTutor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Cargar catálogo de materias (reutilizando profileService) y lista de tutores
  useEffect(() => {
    async function loadCatalog() {
      try {
        const subs = await profileService.getSubjects();
        setSubjects(subs);
      } catch (err) {
        console.error('[TutoringExplore] Error al cargar catálogo de materias:', err);
      }
    }
    loadCatalog();
  }, []);

  const fetchTutors = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await tutoringService.getAvailableTutors({
        subjectId: selectedSubjectId,
        search: searchTerm,
      });
      setTutors(data);
    } catch (err: any) {
      console.error('[TutoringExplore] Error al cargar tutores:', err);
      setErrorMsg('No fue posible cargar la lista de tutores disponibles.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, searchTerm]);

  useEffect(() => {
    fetchTutors();
  }, [fetchTutors]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTutors();
  };

  const handleOpenRequest = (tutor: AvailableTutor) => {
    setSelectedTutorForModal(tutor);
    setIsModalOpen(true);
  };

  const handleSuccessRequest = () => {
    setSuccessMsg('¡Solicitud de tutoría enviada con éxito! Puedes consultar su estado en "Mis Tutorías".');
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  return (
    <div>
      {/* Banner Superior Universitario */}
      <section className="ia-hero-banner" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}>
        <div className="ia-hero-text">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
            <GraduationCapIcon size={14} color="#fde047" /> Red de Apoyo Académico Entre Pares
          </div>
          <h1>Explorar Tutores Disponibles</h1>
          <p>
            Encuentra compañeros con dominio comprobado en tus asignaturas y solicita sesiones de tutoría personalizadas.
          </p>
        </div>
      </section>

      {/* Alerta de éxito si se agendó una tutoría */}
      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckIcon size={20} color="#15803d" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{successMsg}</span>
          </div>
          <Link
            to="/my-tutoring"
            className="ia-btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.82rem', background: '#16a34a', borderColor: '#15803d' }}
          >
            Ir a Mis Tutorías
          </Link>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="ia-card" style={{ marginBottom: '24px', padding: '18px 20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Campo de búsqueda por texto */}
          <div style={{ position: 'relative', flex: 2, minWidth: '240px' }}>
            <input
              type="text"
              className="ia-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por tutor o materia (ej: Programación, Cálculo)..."
              style={{ paddingLeft: '40px', width: '100%' }}
            />
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <SearchIcon size={18} />
            </div>
          </div>

          {/* Filtro por catálogo de materias */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1.5, minWidth: '220px' }}>
            <FilterIcon size={18} color="#2563eb" />
            <select
              className="ia-input"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="all">Todas las materias ({subjects.length})</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}{sub.category ? ` (${sub.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Buscar */}
          <button type="submit" className="ia-btn-primary" style={{ padding: '9px 18px' }}>
            <SearchIcon size={16} /> Buscar
          </button>
        </form>
      </div>

      {/* Contenido Principal: Grilla de Tutores */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsersIcon size={20} color="#2563eb" />
            Tutores Disponibles ({tutors.length})
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Estudiantes activos con disponibilidad para enseñar
          </span>
        </div>

        {errorMsg && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '14px',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircleIcon size={20} color="#b91c1c" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="ia-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Cargando tutores disponibles...</p>
          </div>
        ) : tutors.length === 0 ? (
          <div className="ia-card">
            <EmptyState
              style={{ padding: '48px 20px' }}
              icon={<UsersIcon size={32} color="#2563eb" />}
              title="No se encontraron tutores disponibles"
              description={
                selectedSubjectId !== 'all' || searchTerm
                  ? 'No hay tutores disponibles que coincidan con los criterios seleccionados. Prueba buscando otra materia o quitando los filtros.'
                  : 'Aún no hay estudiantes con disponibilidad activa y materias ofrecidas en la plataforma.'
              }
              action={
                selectedSubjectId !== 'all' || searchTerm ? (
                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => {
                      setSelectedSubjectId('all');
                      setSearchTerm('');
                    }}
                  >
                    Restablecer filtros
                  </button>
                ) : (
                  <Link to="/profile/edit" className="ia-btn-primary">
                    Ofrecer mis materias en mi perfil
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '20px',
            }}
          >
            {tutors.map((tutor) => {
              const p = tutor.profile;
              const name = getUserDisplayName(p);
              const initial = getUserInitial(name);
              const isCurrentUser = user?.id === p.id;
              const hasReviews = Boolean(tutor.statistics && tutor.statistics.total_reviews_received > 0);

              return (
                <div
                  key={p.id}
                  className="ia-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px',
                    transition: 'box-shadow 0.15s ease',
                  }}
                >
                  <div>
                    {/* Cabecera del tutor */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={name}
                          style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '14px',
                            objectFit: 'cover',
                            border: '2px solid #e2e8f0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1.25rem',
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                      )}

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link
                            to={`/profile/${p.id}`}
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 800,
                              color: '#0f172a',
                              textDecoration: 'none',
                            }}
                          >
                            {name}
                          </Link>
                          {isCurrentUser && (
                            <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                              Tú
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                          {p.career || 'Carrera no especificada'}
                          {p.institution ? ` • ${p.institution}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Resumen de Reputación */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '14px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StarIcon size={16} color={hasReviews ? '#eab308' : '#94a3b8'} />
                        <span style={{ fontWeight: 700, color: hasReviews ? '#0f172a' : '#64748b' }}>
                          {hasReviews && tutor.statistics
                            ? `${Number(tutor.statistics.overall_rating).toFixed(1)} / 10`
                            : 'Aún sin evaluaciones'}
                        </span>
                        {hasReviews && tutor.statistics && (
                          <span style={{ color: '#64748b', fontSize: '0.76rem' }}>
                            ({tutor.statistics.total_reviews_received} {tutor.statistics.total_reviews_received === 1 ? 'evaluación' : 'evaluaciones'})
                          </span>
                        )}
                      </div>

                      {tutor.badges.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontWeight: 600 }}>
                          <AwardIcon size={14} color="#2563eb" />
                          <span>{tutor.badges.length} {tutor.badges.length === 1 ? 'insignia' : 'insignias'}</span>
                        </div>
                      )}
                    </div>

                    {/* Materias que Enseña */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                        Materias que ofrece:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {tutor.offeredSubjects.map((item) => (
                          <div
                            key={item.subject_id}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.78rem',
                              color: '#1e40af',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <strong>{item.subject?.name}</strong>
                            <span style={{ color: '#3b82f6', fontSize: '0.72rem' }}>
                              ({formatAcademicLevel(item.level)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Descripción o enfoque si existe */}
                    {p.bio && (
                      <p
                        style={{
                          fontSize: '0.82rem',
                          color: '#475569',
                          margin: '0 0 16px 0',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {p.bio}
                      </p>
                    )}
                  </div>

                  {/* Botón de acción */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '10px' }}>
                    {isCurrentUser ? (
                      <span
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          fontSize: '0.84rem',
                          color: '#64748b',
                          background: '#f8fafc',
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}
                      >
                        No puedes solicitarte tutorías a ti mismo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenRequest(tutor)}
                        className="ia-btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Solicitar Tutoría
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Solicitud de Tutoría */}
      <RequestTutoringModal
        tutor={selectedTutorForModal}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccessRequest}
      />
    </div>
  );
}
