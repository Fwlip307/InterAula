import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import { tutoringService, type AvailableTutor } from '../../services/tutoring.service';
import type { Subject } from '../../types/profile';
import type { TutoringWorkshop } from '../../types/tutoring';
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
  AlertCircleIcon,
  CheckIcon,
  VideoIcon,
  ShieldCheckIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';
import RequestTutoringModal from './components/RequestTutoringModal';
import CreateWorkshopModal from './components/CreateWorkshopModal';
import WorkshopCard from './components/WorkshopCard';

// 6 Materias Críticas de Inicio en Informática (Foco Vertical Duoc UC)
const CRITICAL_INFORMATICS_SUBJECTS = [
  'Programación de Algoritmos',
  'Programación Web',
  'Modelamiento de Base de Datos',
  'Consultas de Bases de Datos',
  'Nivelación Matemática',
  'Programación Orientada a Objetos',
];

export default function TutoringExplore() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tutors' | 'workshops'>('tutors');

  // Tutores 1 a 1
  const [tutors, setTutors] = useState<AvailableTutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [onlyCertified, setOnlyCertified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Tutor seleccionado para el modal de solicitud 1 a 1
  const [selectedTutorForModal, setSelectedTutorForModal] = useState<AvailableTutor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Talleres y Clases Grupales
  const [workshops, setWorkshops] = useState<TutoringWorkshop[]>([]);
  const [workshopsLoading, setWorkshopsLoading] = useState<boolean>(false);
  const [isCreateWorkshopModalOpen, setIsCreateWorkshopModalOpen] = useState<boolean>(false);
  const [workshopActionLoading, setWorkshopActionLoading] = useState<boolean>(false);

  // Cargar catálogo de materias
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
        onlyVerified: onlyCertified,
      });
      setTutors(data);
    } catch (err: any) {
      console.error('[TutoringExplore] Error al cargar tutores:', err);
      setErrorMsg('No fue posible cargar la lista de tutores disponibles.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, searchTerm, onlyCertified]);

  const fetchWorkshops = React.useCallback(async () => {
    setWorkshopsLoading(true);
    try {
      const data = await tutoringService.getUpcomingWorkshops(selectedSubjectId);
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        setWorkshops(
          data.filter(
            (w) =>
              w.title.toLowerCase().includes(term) ||
              (w.description && w.description.toLowerCase().includes(term)) ||
              (w.tutor && getUserDisplayName(w.tutor).toLowerCase().includes(term))
          )
        );
      } else {
        setWorkshops(data);
      }
    } catch (err: any) {
      console.error('[TutoringExplore] Error al cargar talleres:', err);
    } finally {
      setWorkshopsLoading(false);
    }
  }, [selectedSubjectId, searchTerm]);

  useEffect(() => {
    fetchTutors();
    fetchWorkshops();
  }, [fetchTutors, fetchWorkshops]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTutors();
    fetchWorkshops();
  };

  const handleOpenRequest = (tutor: AvailableTutor) => {
    setSelectedTutorForModal(tutor);
    setIsModalOpen(true);
  };

  const handleSuccessRequest = () => {
    setSuccessMsg('¡Solicitud de tutoría enviada con éxito! Puedes consultar su estado en "Mis Tutorías".');
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleEnroll = async (workshopId: string) => {
    setWorkshopActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.enrollInWorkshop(workshopId);
      setSuccessMsg('¡Inscripción confirmada! Tu cupo en el taller grupal está asegurado.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await fetchWorkshops();
    } catch (err: any) {
      console.error('[TutoringExplore] Error al inscribirse en taller:', err);
      setErrorMsg(err.message || 'No fue posible completar tu inscripción.');
    } finally {
      setWorkshopActionLoading(false);
    }
  };

  const handleUnenroll = async (workshopId: string) => {
    setWorkshopActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.unenrollFromWorkshop(workshopId);
      setSuccessMsg('Has cancelado tu reserva en el taller.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await fetchWorkshops();
    } catch (err: any) {
      console.error('[TutoringExplore] Error al cancelar reserva:', err);
      setErrorMsg(err.message || 'No fue posible cancelar la reserva.');
    } finally {
      setWorkshopActionLoading(false);
    }
  };

  const handleCancelWorkshop = async (workshopId: string) => {
    setWorkshopActionLoading(true);
    setErrorMsg('');
    try {
      await tutoringService.updateWorkshopStatus(workshopId, 'cancelled');
      setSuccessMsg('El taller ha sido cancelado.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await fetchWorkshops();
    } catch (err: any) {
      console.error('[TutoringExplore] Error al cancelar taller:', err);
      setErrorMsg(err.message || 'No fue posible cancelar el taller.');
    } finally {
      setWorkshopActionLoading(false);
    }
  };

  const handleCreateWorkshopSuccess = async () => {
    setSuccessMsg('¡Taller grupal en vivo programado exitosamente! Tus compañeros ya pueden inscribirse.');
    setTimeout(() => setSuccessMsg(''), 6000);
    setActiveTab('workshops');
    await fetchWorkshops();
  };

  return (
    <div>
      {/* Cabecera Académica con botón de acción */}
      <div className="ia-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="ia-page-title">Explorar Tutores y Talleres en Vivo</h1>
          <p className="ia-page-subtitle">
            Encuentra apoyo académico personalizado 1 a 1 o participa en clases grupales con Aula Virtual integrada.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/profile"
            className="ia-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              fontSize: '0.88rem',
              fontWeight: 700,
              backgroundColor: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#065f46',
              textDecoration: 'none',
            }}
          >
            <ShieldCheckIcon size={16} color="#059669" />
            <span>¿Cómo Certificarme como Tutor?</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsCreateWorkshopModalOpen(true)}
            className="ia-btn-primary"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              borderColor: '#7c3aed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '0.88rem',
              fontWeight: 700,
              boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.25)',
            }}
          >
            <VideoIcon size={16} color="#ffffff" />
            <span>+ Programar Taller en Vivo</span>
          </button>
        </div>
      </div>

      {/* Banner de Invitación a la Certificación Docente */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%)',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheckIcon size={24} color="#059669" style={{ flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#064e3b', display: 'block' }}>
              Modelo de Calidad Duoc UC: Tutores Validados
            </span>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>
              Demuestra tu conocimiento en ramos troncales de Informática mediante la Mini-Evaluación con Bot o tu Concentración de Notas oficial.
            </span>
          </div>
        </div>
        <Link
          to="/profile"
          className="ia-btn-primary"
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            background: '#059669',
            borderColor: '#047857',
            textDecoration: 'none',
          }}
        >
          Iniciar Certificación en mi Perfil
        </Link>
      </div>

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

      {/* Pestañas de Navegación: Tutores 1 a 1 vs Talleres Grupales */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('tutors')}
          style={{
            padding: '10px 18px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'tutors' ? '#2563eb' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tutors' ? '3px solid #2563eb' : '3px solid transparent',
            marginBottom: '-4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <UsersIcon size={18} color={activeTab === 'tutors' ? '#2563eb' : '#64748b'} />
          <span>Tutores Individuales 1 a 1 ({tutors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workshops')}
          style={{
            padding: '10px 18px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'workshops' ? '#7c3aed' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'workshops' ? '3px solid #7c3aed' : '3px solid transparent',
            marginBottom: '-4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <VideoIcon size={18} color={activeTab === 'workshops' ? '#7c3aed' : '#64748b'} />
          <span>Talleres y Clases en Vivo ({workshops.length})</span>
          {workshops.length > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                backgroundColor: '#f3e8ff',
                color: '#7c3aed',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              En directo
            </span>
          )}
        </button>
      </div>

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
              <optgroup label="Ramos Criticos de Informatica (Prioritarios)">
                {subjects
                  .filter((s) => s.is_pilot || [
                    'Programación de Algoritmos',
                    'Nivelación Matemática',
                    'Modelamiento de Base de Datos',
                    'Consultas de Bases de Datos',
                    'Programación Web',
                    'Desarrollo de Software de Escritorio',
                    'Matemática Aplicada',
                    'Programación de Base de Datos',
                    'Arquitectura',
                  ].includes(s.name))
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Botón Buscar */}
          <button type="submit" className="ia-btn-primary" style={{ padding: '9px 18px' }}>
            <SearchIcon size={16} /> Buscar
          </button>
        </form>

        {/* Filtro de Calidad Académica y Asignaturas Críticas de Informática */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setOnlyCertified(!onlyCertified)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: `1px solid ${onlyCertified ? '#2563eb' : '#cbd5e1'}`,
                backgroundColor: onlyCertified ? '#eff6ff' : '#ffffff',
                color: onlyCertified ? '#1d4ed8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheckIcon size={16} color={onlyCertified ? '#2563eb' : '#94a3b8'} />
              <span>Solo Tutores Certificados</span>
              {onlyCertified && <CheckIcon size={14} color="#2563eb" />}
            </button>

            <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
              Foco Piloto: Asignaturas Filtro de Informática
            </span>
          </div>

          {/* Pastillas de Selección Rápida */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Ramos Troncales:</span>
            {CRITICAL_INFORMATICS_SUBJECTS.map((subName) => {
              const matchedSub = subjects.find((s) => s.name.toLowerCase().includes(subName.toLowerCase()));
              const isSelected = matchedSub && selectedSubjectId === matchedSub.id;

              return (
                <button
                  key={subName}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSubjectId('all');
                    } else if (matchedSub) {
                      setSelectedSubjectId(matchedSub.id);
                    } else {
                      setSearchTerm(subName);
                    }
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '14px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#2563eb' : '#f8fafc',
                    color: isSelected ? '#ffffff' : '#334155',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {subName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido Principal: Grilla de Tutores */}
      {activeTab === 'tutors' && (
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
              const isCertifiedTutor = tutor.offeredSubjects.some((o) => o.is_verified);

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
                    border: isCertifiedTutor ? '1.5px solid #bfdbfe' : undefined,
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
                            border: isCertifiedTutor ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '14px',
                            background: isCertifiedTutor
                              ? 'linear-gradient(135deg, #1d4ed8, #1e40af)'
                              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                          {isCertifiedTutor && (
                            <span
                              style={{
                                fontSize: '0.70rem',
                                backgroundColor: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                                padding: '2px 7px',
                                borderRadius: '9999px',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title="Tutor con validación docente y concentración de notas aprobada"
                            >
                              <ShieldCheckIcon size={12} color="#059669" />
                              Certificado Duoc UC
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
                              background: item.is_verified ? '#f0fdf4' : '#eff6ff',
                              border: `1px solid ${item.is_verified ? '#bbf7d0' : '#bfdbfe'}`,
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.78rem',
                              color: item.is_verified ? '#166534' : '#1e40af',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {item.is_verified && <ShieldCheckIcon size={12} color="#16a34a" />}
                            <strong>{item.subject?.name}</strong>
                            <span style={{ color: item.is_verified ? '#15803d' : '#3b82f6', fontSize: '0.72rem' }}>
                              ({formatAcademicLevel(item.level)})
                            </span>
                            {item.is_verified && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                }}
                              >
                                Aprobado
                              </span>
                            )}
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
      )}

      {/* 2. SECCIÓN: TALLERES Y CLASES EN VIVO */}
      {activeTab === 'workshops' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <VideoIcon size={20} color="#7c3aed" />
                Talleres y Clases Grupales ({workshops.length})
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Sesiones programadas con enlace al Aula Virtual integrado. Inscríbete con anticipación para asegurar tu lugar.
              </span>
            </div>
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

          {workshopsLoading ? (
            <div className="ia-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Cargando talleres y clases grupales en vivo...</p>
            </div>
          ) : workshops.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '48px 20px' }}
                icon={<VideoIcon size={32} color="#7c3aed" />}
                title="No hay talleres programados en este momento"
                description={
                  selectedSubjectId !== 'all' || searchTerm
                    ? 'No encontramos talleres que coincidan con tus filtros. Prueba seleccionando otra asignatura o quitando los filtros de búsqueda.'
                    : 'Aún no hay talleres en vivo programados. Si dominas alguna materia clave, ¡anímate a impartir una clase abierta para tus compañeros!'
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
                    <button
                      type="button"
                      className="ia-btn-primary"
                      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', borderColor: '#7c3aed' }}
                      onClick={() => setIsCreateWorkshopModalOpen(true)}
                    >
                      + Programar el Primer Taller
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '20px',
              }}
            >
              {workshops.map((w) => (
                <WorkshopCard
                  key={w.id}
                  workshop={w}
                  currentUserId={user?.id}
                  onEnroll={handleEnroll}
                  onUnenroll={handleUnenroll}
                  onCancelWorkshop={handleCancelWorkshop}
                  actionLoading={workshopActionLoading}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Solicitud de Tutoría 1 a 1 */}
      <RequestTutoringModal
        tutor={selectedTutorForModal}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccessRequest}
      />

      {/* Modal para Programar Nuevo Taller Grupal */}
      <CreateWorkshopModal
        isOpen={isCreateWorkshopModalOpen}
        onClose={() => setIsCreateWorkshopModalOpen(false)}
        onSuccess={handleCreateWorkshopSuccess}
        availableSubjects={subjects}
      />
    </div>
  );
}
