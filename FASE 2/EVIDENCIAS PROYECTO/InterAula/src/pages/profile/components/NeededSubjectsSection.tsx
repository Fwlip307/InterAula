import { useState } from 'react';
import type { NeededSubject, Subject, AcademicLevel } from '../../../types/profile';
import { UsersIcon, PlusIcon, TrashIcon } from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface NeededSubjectsSectionProps {
  neededSubjects: NeededSubject[];
  catalogSubjects: Subject[];
  onAdd: (subjectId: string, level: AcademicLevel, notes: string) => Promise<void>;
  onRemove: (subjectId: string) => Promise<void>;
}

export default function NeededSubjectsSection({
  neededSubjects,
  catalogSubjects,
  onAdd,
  onRemove,
}: NeededSubjectsSectionProps) {
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newLevel, setNewLevel] = useState<AcademicLevel>('basic');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar materias del catálogo que aún no han sido agregadas a necesitadas
  const availableCatalog = catalogSubjects.filter(
    (s) => !neededSubjects.some((n) => n.subject_id === s.id)
  );

  const handleAdd = async () => {
    if (!newSubjectId || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAdd(newSubjectId, newLevel, newNotes.trim());
      setNewSubjectId('');
      setNewNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
            value={newSubjectId}
            onChange={(e) => setNewSubjectId(e.target.value)}
          >
            <option value="">-- Selecciona una materia --</option>
            {availableCatalog.map((s) => (
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
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as AcademicLevel)}
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
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Ej. Me cuesta la unidad de integrales triples"
          />
        </div>

        <button
          type="button"
          className="ia-btn-primary"
          onClick={handleAdd}
          disabled={!newSubjectId || isSubmitting}
          style={{ height: '42px' }}
        >
          <PlusIcon size={16} /> {isSubmitting ? 'Solicitando...' : 'Solicitar'}
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
                    {formatAcademicLevel(item.current_level)}
                  </span>
                )}
                <button
                  type="button"
                  className="ia-btn-icon-danger"
                  onClick={() => onRemove(item.subject_id)}
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
  );
}
