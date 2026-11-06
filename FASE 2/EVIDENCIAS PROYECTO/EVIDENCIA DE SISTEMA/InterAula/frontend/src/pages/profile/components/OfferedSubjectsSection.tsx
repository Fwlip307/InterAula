import React, { useState } from 'react';
import type { OfferedSubject, Subject, AcademicLevel } from '../../../types/profile';
import {
  BookOpenIcon,
  ShieldCheckIcon,
  ClockIcon,
  AwardIcon,
  CheckIcon,
  TrashIcon,
  PlusIcon,
  XIcon,
  AlertCircleIcon,
} from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface OfferedSubjectsSectionProps {
  offeredSubjects: OfferedSubject[];
  onRemove: (subjectId: string) => Promise<void>;
  onAddSubject?: (subjectId: string, level: AcademicLevel, description?: string) => Promise<void>;
  catalogSubjects?: Subject[];
  onStartEvaluation?: () => void;
  onRequestEndorsement?: () => void;
}

export default function OfferedSubjectsSection({
  offeredSubjects,
  onRemove,
  onAddSubject,
  catalogSubjects = [],
  onStartEvaluation,
  onRequestEndorsement,
}: OfferedSubjectsSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>('advanced');
  const [customDescription, setCustomDescription] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Lista de materias disponibles para agregar (que no estén ya agregadas)
  const availableToAdd = catalogSubjects.filter(
    (cs) => !offeredSubjects.some((os) => os.subject_id === cs.id || os.subject?.name?.toLowerCase() === cs.name.toLowerCase())
  );

  const activeSubjectId = selectedSubjectId || availableToAdd[0]?.id || '';

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddSubject) return;
    setFormError('');

    if (!activeSubjectId) {
      setFormError('Por favor selecciona una materia de la lista.');
      return;
    }

    try {
      setAddingLoading(true);
      await onAddSubject(
        activeSubjectId,
        selectedLevel,
        customDescription.trim() || undefined
      );
      setShowAddForm(false);
      setSelectedSubjectId('');
      setCustomDescription('');
    } catch (err: any) {
      console.error('[OfferedSubjectsSection] Error:', err);
      setFormError(err.message || 'No fue posible agregar la materia.');
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <div className="ia-form-section" id="offered-subjects">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpenIcon size={20} color="#2563eb" />
          <h2 className="ia-form-section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            Materias Habilitadas para Impartir ({offeredSubjects.length})
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onAddSubject && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="ia-btn-primary"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
              }}
            >
              <PlusIcon size={14} color="#ffffff" />
              <span>Agregar Materia</span>
            </button>
          )}

          <span
            style={{
              fontSize: '0.72rem',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '3px 9px',
              borderRadius: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheckIcon size={13} color="#059669" />
            Tutor Certificado
          </span>
        </div>
      </div>

      <p className="ia-form-section-desc" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
        Listado de asignaturas donde estás habilitado para ofrecer ayudantías y clases en vivo. Puedes añadir materias que dominas, rendir la evaluación diagnóstica de preguntas o presentar respaldo docente.
      </p>

      {/* Formulario Inline para Agregar Materia */}
      {showAddForm && (
        <div
          className="ia-card"
          style={{
            backgroundColor: '#f8fafc',
            border: '1.5px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px 18px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PlusIcon size={16} color="#2563eb" />
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Agregar Materia a mi Perfil de Tutor</strong>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="ia-btn-icon-back"
              style={{ width: '28px', height: '28px' }}
              title="Cerrar formulario"
            >
              <XIcon size={14} />
            </button>
          </div>

          {formError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '12px',
              }}
            >
              <AlertCircleIcon size={15} color="#dc2626" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem' }}>
                  Seleccionar Materia / Asignatura *
                </label>
                <select
                  className="ia-select"
                  value={activeSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  style={{ width: '100%', fontSize: '0.86rem' }}
                  required
                >
                  {availableToAdd.length > 0 ? (
                    availableToAdd.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.category ? `(${s.category})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No hay materias pendientes por agregar</option>
                  )}
                </select>
              </div>

              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem' }}>
                  Nivel de Dominio
                </label>
                <select
                  className="ia-select"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value as AcademicLevel)}
                  style={{ width: '100%', fontSize: '0.86rem' }}
                >
                  <option value="advanced">Avanzado (Dominio total para certámenes y proyectos)</option>
                  <option value="intermediate">Intermedio (Ejercicios prácticos y materia troncal)</option>
                  <option value="basic">Básico (Conceptos fundamentales e inducción)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem' }}>
                Descripción o Enfoque de tu Ayudantía (Opcional)
              </label>
              <input
                type="text"
                className="ia-input"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Ej: Preparación intensiva de pruebas, ejercicios prácticos y dudas puntuales."
                style={{ width: '100%', fontSize: '0.84rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="ia-btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                disabled={addingLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ia-btn-primary"
                style={{ fontSize: '0.82rem', padding: '6px 16px', fontWeight: 700 }}
                disabled={addingLoading || !activeSubjectId}
              >
                {addingLoading ? 'Guardando...' : 'Habilitar y Acreditar Materia'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listado de materias habilitadas */}
      {offeredSubjects.length > 0 ? (
        <div>
          <div className="ia-catalog-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {offeredSubjects.map((item) => (
              <div
                key={item.subject_id}
                className="ia-catalog-item"
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.96rem', color: '#0f172a' }}>
                      {item.subject?.name || 'Asignatura'}
                    </strong>
                    {item.subject?.category && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        {item.subject.category}
                      </span>
                    )}
                    {item.is_verified ? (
                      <span
                        className="ia-badge ia-badge-success"
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                        }}
                      >
                        <ShieldCheckIcon size={12} color="#16a34a" />
                        Acreditada para Enseñar
                      </span>
                    ) : (
                      <span
                        className="ia-badge ia-badge-blue"
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                        }}
                      >
                        <CheckIcon size={12} />
                        Habilitada
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      fontWeight: 700,
                    }}
                  >
                    Nivel {formatAcademicLevel(item.level)}
                  </span>

                  <button
                    type="button"
                    className="ia-btn-icon-danger"
                    onClick={() => onRemove(item.subject_id)}
                    title="Eliminar esta materia de mis tutorías"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {onAddSubject && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="ia-btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  padding: '7px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
              >
                <PlusIcon size={14} color="#2563eb" />
                <span>Agregar otra materia</span>
              </button>
            )}

            {onStartEvaluation && (
              <button
                type="button"
                onClick={onStartEvaluation}
                className="ia-btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  padding: '7px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ClockIcon size={14} color="#2563eb" />
                <span>Rendir Evaluación con Asistente</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ESTADO INICIAL CUANDO AÚN NO HA AGREGADO MATERIAS */
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1.5px dashed #cbd5e1',
            borderRadius: '14px',
            padding: '24px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}
          >
            <ShieldCheckIcon size={24} />
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', marginBottom: '4px' }}>
              Aún no tienes materias agregadas para impartir
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', maxWidth: '580px', lineHeight: 1.5 }}>
              Agrega las materias en las que deseas impartir tutorías o clases en vivo para que aparezcan en tu perfil y puedas programar talleres grupales.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
            {onAddSubject && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="ia-btn-primary"
                style={{
                  fontSize: '0.84rem',
                  padding: '9px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                <PlusIcon size={15} color="#ffffff" />
                <span>Agregar Materia a Impartir</span>
              </button>
            )}

            {onStartEvaluation && (
              <button
                type="button"
                onClick={onStartEvaluation}
                className="ia-btn-secondary"
                style={{
                  fontSize: '0.84rem',
                  padding: '9px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                <ClockIcon size={15} color="#2563eb" />
                <span>Rendir Evaluación de 10 Preguntas</span>
              </button>
            )}

            {onRequestEndorsement && (
              <button
                type="button"
                onClick={onRequestEndorsement}
                className="ia-btn-secondary"
                style={{
                  fontSize: '0.84rem',
                  padding: '9px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                <AwardIcon size={15} color="#2563eb" />
                <span>Solicitar Respaldo Docente</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
