import type { OfferedSubject } from '../../../types/profile';
import {
  BookOpenIcon,
  ShieldCheckIcon,
  ClockIcon,
  AwardIcon,
  CheckIcon,
  TrashIcon,
} from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface OfferedSubjectsSectionProps {
  offeredSubjects: OfferedSubject[];
  onRemove: (subjectId: string) => Promise<void>;
  onStartEvaluation?: () => void;
  onRequestEndorsement?: () => void;
}

export default function OfferedSubjectsSection({
  offeredSubjects,
  onRemove,
  onStartEvaluation,
  onRequestEndorsement,
}: OfferedSubjectsSectionProps) {
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
          Acreditación Requerida
        </span>
      </div>

      <p className="ia-form-section-desc" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
        Listado de asignaturas donde has validado tus conocimientos. En InterAula las materias no se agregan manualmente: se desbloquean automáticamente al aprobar la evaluación de 10 preguntas o presentar respaldo docente oficial.
      </p>

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
                    title="Dar de baja esta materia de mis tutorías"
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

          {onStartEvaluation && (
            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
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
                <span>Habilitar otra materia con el Asistente</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ESTADO INICIAL CUANDO AÚN NO HA RENDIDO EXÁMENES */
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
              Aún no tienes materias habilitadas para impartir
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', maxWidth: '580px', lineHeight: 1.5 }}>
              Para asegurar la calidad pedagógica en InterAula, debes acreditar tus conocimientos mediante la evaluación de preguntas o presentando respaldo institucional antes de recibir solicitudes de estudiantes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
            {onStartEvaluation && (
              <button
                type="button"
                onClick={onStartEvaluation}
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
                <ClockIcon size={15} color="#ffffff" />
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
                <span>Solicitar Respaldo de Profesor</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
