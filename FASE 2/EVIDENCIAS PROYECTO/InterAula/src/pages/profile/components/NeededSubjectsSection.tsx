import { useState, useMemo } from 'react';
import type { NeededSubject, Subject, AcademicLevel } from '../../../types/profile';
import { UsersIcon, PlusIcon, TrashIcon, TargetIcon } from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface NeededSubjectsSectionProps {
  neededSubjects: NeededSubject[];
  catalogSubjects: Subject[];
  onAdd: (subjectId: string, level: AcademicLevel, notes: string) => Promise<void>;
  onRemove: (subjectId: string) => Promise<void>;
}

// Asignaturas críticas de alta reprobación/dificultad en los primeros semestres de Informática
const CORE_INFORMATICS_HURDLES = [
  'Programación de Algoritmos',
  'Nivelación Matemática',
  'Modelamiento de Base de Datos',
  'Consultas de Bases de Datos',
  'Programación Web',
  'Desarrollo de Software de Escritorio',
  'Matemática Aplicada',
  'Programación de Base de Datos',
  'Arquitectura',
];

export default function NeededSubjectsSection({
  neededSubjects,
  catalogSubjects,
  onAdd,
  onRemove,
}: NeededSubjectsSectionProps) {
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newLevel, setNewLevel] = useState<AcademicLevel>('basic');
  const [newNotes, setNewNotes] = useState('');
  const [filterCategory, setFilterCategory] = useState<'hurdles' | 'all' | 'programming' | 'db' | 'math'>('hurdles');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar materias no solicitadas aún
  const availableCatalog = useMemo(() => {
    return catalogSubjects.filter(
      (s) => !neededSubjects.some((n) => n.subject_id === s.id)
    );
  }, [catalogSubjects, neededSubjects]);

  // Clasificación para el selector y filtros
  const hurdleSubjects = useMemo(() => {
    return availableCatalog.filter((s) => CORE_INFORMATICS_HURDLES.includes(s.name) || s.is_pilot);
  }, [availableCatalog]);

  const displayedCatalog = useMemo(() => {
    switch (filterCategory) {
      case 'hurdles':
        return hurdleSubjects;
      case 'programming':
        return availableCatalog.filter(
          (s) => s.category === 'Tecnología e Informática' && !s.name.toLowerCase().includes('base de datos')
        );
      case 'db':
        return availableCatalog.filter((s) => s.name.toLowerCase().includes('base de datos'));
      case 'math':
        return availableCatalog.filter((s) => s.category === 'Ciencias Básicas');
      default:
        return availableCatalog;
    }
  }, [availableCatalog, hurdleSubjects, filterCategory]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <h2 className="ia-form-section-title" style={{ margin: 0 }}>
          <UsersIcon size={20} color="#16a34a" /> Materias en las que Necesito Ayuda ({neededSubjects.length})
        </h2>
        <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
          Reforzamiento y Tutoría
        </span>
      </div>
      <p className="ia-form-section-desc" style={{ marginBottom: '12px' }}>
        Indica los ramos donde te cuesta avanzar para que compañeros tutores puedan ayudarte a preparar pruebas o proyectos.
      </p>

      {/* Chips de filtro rápido */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setFilterCategory('hurdles')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'hurdles' ? '#16a34a' : '#e2e8f0'}`,
            background: filterCategory === 'hurdles' ? '#f0fdf4' : '#ffffff',
            color: filterCategory === 'hurdles' ? '#15803d' : '#64748b',
            fontWeight: filterCategory === 'hurdles' ? 700 : 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <TargetIcon size={12} color={filterCategory === 'hurdles' ? '#15803d' : '#64748b'} />
          Ramos Clave de Inicio
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('programming')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'programming' ? '#16a34a' : '#e2e8f0'}`,
            background: filterCategory === 'programming' ? '#f0fdf4' : '#ffffff',
            color: filterCategory === 'programming' ? '#15803d' : '#64748b',
            fontWeight: filterCategory === 'programming' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          Programación
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('db')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'db' ? '#16a34a' : '#e2e8f0'}`,
            background: filterCategory === 'db' ? '#f0fdf4' : '#ffffff',
            color: filterCategory === 'db' ? '#15803d' : '#64748b',
            fontWeight: filterCategory === 'db' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          Bases de Datos
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('math')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'math' ? '#16a34a' : '#e2e8f0'}`,
            background: filterCategory === 'math' ? '#f0fdf4' : '#ffffff',
            color: filterCategory === 'math' ? '#15803d' : '#64748b',
            fontWeight: filterCategory === 'math' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          Matemáticas
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('all')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'all' ? '#16a34a' : '#e2e8f0'}`,
            background: filterCategory === 'all' ? '#f0fdf4' : '#ffffff',
            color: filterCategory === 'all' ? '#15803d' : '#64748b',
            fontWeight: filterCategory === 'all' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          Todas ({availableCatalog.length})
        </button>
      </div>

      {/* Formulario compacto para añadir */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 2.5fr) minmax(130px, 1.2fr) minmax(180px, 2fr) auto',
          gap: '8px',
          alignItems: 'end',
          marginBottom: '14px',
          background: '#f8fafc',
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <label className="ia-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>Materia a reforzar</label>
          <select
            className="ia-select"
            value={newSubjectId}
            onChange={(e) => setNewSubjectId(e.target.value)}
            style={{ fontSize: '0.84rem', padding: '6px 10px' }}
          >
            <option value="">-- Selecciona asignatura --</option>
            {displayedCatalog.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.category ? `(${s.category})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ia-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>Mi Nivel Actual</label>
          <select
            className="ia-select"
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as AcademicLevel)}
            style={{ fontSize: '0.84rem', padding: '6px 10px' }}
          >
            <option value="basic">Básico</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        <div>
          <label className="ia-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>Duda o Unidad difícil (Opcional)</label>
          <input
            type="text"
            className="ia-input"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Ej. Me cuesta la lógica de bucles / SQL Joins"
            style={{ fontSize: '0.84rem', padding: '6px 10px' }}
          />
        </div>

        <button
          type="button"
          className="ia-btn-primary"
          onClick={handleAdd}
          disabled={!newSubjectId || isSubmitting}
          style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem', background: '#16a34a', borderColor: '#15803d' }}
        >
          <PlusIcon size={14} /> {isSubmitting ? '...' : 'Solicitar'}
        </button>
      </div>

      {/* Listado de materias solicitadas */}
      {neededSubjects.length > 0 ? (
        <div className="ia-catalog-list">
          {neededSubjects.map((item) => (
            <div key={item.subject_id} className="ia-catalog-item" style={{ padding: '8px 12px' }}>
              <div className="ia-catalog-item-info">
                <div>
                  <span className="ia-catalog-item-title" style={{ fontSize: '0.86rem' }}>{item.subject?.name}</span>
                  {item.notes && (
                    <p className="ia-catalog-item-desc" style={{ fontSize: '0.76rem' }}>{item.notes}</p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ia-badge ia-badge-amber" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  Nivel: {formatAcademicLevel(item.current_level)}
                </span>
                <button
                  type="button"
                  className="ia-btn-icon-danger"
                  onClick={() => onRemove(item.subject_id)}
                  title="Eliminar solicitud de materia"
                  style={{ width: '28px', height: '28px' }}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
          Aún no has indicado materias en las que necesites apoyo.
        </p>
      )}
    </div>
  );
}
