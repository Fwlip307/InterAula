import { useState } from 'react';
import type { OfferedSubject, Subject, AcademicLevel } from '../../../types/profile';
import { BookOpenIcon, PlusIcon, TrashIcon } from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface OfferedSubjectsSectionProps {
  offeredSubjects: OfferedSubject[];
  catalogSubjects: Subject[];
  onAdd: (subjectId: string, level: AcademicLevel, description: string) => Promise<void>;
  onRemove: (subjectId: string) => Promise<void>;
}

export default function OfferedSubjectsSection({
  offeredSubjects,
  catalogSubjects,
  onAdd,
  onRemove,
}: OfferedSubjectsSectionProps) {
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newLevel, setNewLevel] = useState<AcademicLevel>('intermediate');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar materias del catálogo que aún no han sido añadidas
  const availableCatalog = catalogSubjects.filter(
    (s) => !offeredSubjects.some((o) => o.subject_id === s.id)
  );

  const handleAdd = async () => {
    if (!newSubjectId || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAdd(newSubjectId, newLevel, newDesc.trim());
      setNewSubjectId('');
      setNewDesc('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Nivel de Dominio</label>
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
          <label className="ia-label" style={{ marginBottom: '4px', display: 'block' }}>Descripción / Enfoque (opcional)</label>
          <input
            type="text"
            className="ia-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Ej. Apoyo en ejercicios y preparación de certámenes"
          />
        </div>

        <button
          type="button"
          className="ia-btn-primary"
          onClick={handleAdd}
          disabled={!newSubjectId || isSubmitting}
          style={{ height: '42px' }}
        >
          <PlusIcon size={16} /> {isSubmitting ? 'Agregando...' : 'Agregar'}
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
                  {formatAcademicLevel(item.level)}
                </span>
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
          Aún no has agregado materias que puedas enseñar.
        </p>
      )}
    </div>
  );
}
