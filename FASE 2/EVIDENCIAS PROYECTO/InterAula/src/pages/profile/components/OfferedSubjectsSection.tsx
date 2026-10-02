import { useState, useMemo } from 'react';
import type { OfferedSubject, Subject, AcademicLevel } from '../../../types/profile';
import { BookOpenIcon, PlusIcon, TrashIcon, TargetIcon } from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface OfferedSubjectsSectionProps {
  offeredSubjects: OfferedSubject[];
  catalogSubjects: Subject[];
  onAdd: (subjectId: string, level: AcademicLevel, description: string) => Promise<void>;
  onRemove: (subjectId: string) => Promise<void>;
}

// Asignaturas críticas de alta demanda en los primeros semestres de Informática
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

export default function OfferedSubjectsSection({
  offeredSubjects,
  catalogSubjects,
  onAdd,
  onRemove,
}: OfferedSubjectsSectionProps) {
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newLevel, setNewLevel] = useState<AcademicLevel>('intermediate');
  const [newDesc, setNewDesc] = useState('');
  const [filterCategory, setFilterCategory] = useState<'hurdles' | 'all' | 'programming' | 'db' | 'math'>('hurdles');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar materias del catálogo no agregadas aún
  const availableCatalog = useMemo(() => {
    return catalogSubjects.filter(
      (s) => !offeredSubjects.some((o) => o.subject_id === s.id)
    );
  }, [catalogSubjects, offeredSubjects]);

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
      await onAdd(newSubjectId, newLevel, newDesc.trim());
      setNewSubjectId('');
      setNewDesc('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ia-form-section" id="offered-subjects">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <h2 className="ia-form-section-title" style={{ margin: 0 }}>
          <BookOpenIcon size={20} color="#2563eb" /> Materias que Puedo Enseñar ({offeredSubjects.length})
        </h2>
        <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
          Enfocado en Informática
        </span>
      </div>
      <p className="ia-form-section-desc" style={{ marginBottom: '12px' }}>
        Elige materias clave que domines para apoyar a compañeros de cursos inferiores.
      </p>

      {/* Chips de filtro rápido para concentrar las materias */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setFilterCategory('hurdles')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'hurdles' ? '#2563eb' : '#e2e8f0'}`,
            background: filterCategory === 'hurdles' ? '#eff6ff' : '#ffffff',
            color: filterCategory === 'hurdles' ? '#1d4ed8' : '#64748b',
            fontWeight: filterCategory === 'hurdles' ? 700 : 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <TargetIcon size={12} color={filterCategory === 'hurdles' ? '#1d4ed8' : '#64748b'} />
          Ramos Clave de Inicio
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('programming')}
          style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: '20px',
            border: `1px solid ${filterCategory === 'programming' ? '#2563eb' : '#e2e8f0'}`,
            background: filterCategory === 'programming' ? '#eff6ff' : '#ffffff',
            color: filterCategory === 'programming' ? '#1d4ed8' : '#64748b',
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
            border: `1px solid ${filterCategory === 'db' ? '#2563eb' : '#e2e8f0'}`,
            background: filterCategory === 'db' ? '#eff6ff' : '#ffffff',
            color: filterCategory === 'db' ? '#1d4ed8' : '#64748b',
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
            border: `1px solid ${filterCategory === 'math' ? '#2563eb' : '#e2e8f0'}`,
            background: filterCategory === 'math' ? '#eff6ff' : '#ffffff',
            color: filterCategory === 'math' ? '#1d4ed8' : '#64748b',
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
            border: `1px solid ${filterCategory === 'all' ? '#2563eb' : '#e2e8f0'}`,
            background: filterCategory === 'all' ? '#eff6ff' : '#ffffff',
            color: filterCategory === 'all' ? '#1d4ed8' : '#64748b',
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
          <label className="ia-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>Materia a enseñar</label>
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
          <label className="ia-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>Nivel de Dominio</label>
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
          <label className="ia-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>Enfoque (Opcional)</label>
          <input
            type="text"
            className="ia-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Ej. Ejercicios prácticos de certamen"
            style={{ fontSize: '0.84rem', padding: '6px 10px' }}
          />
        </div>

        <button
          type="button"
          className="ia-btn-primary"
          onClick={handleAdd}
          disabled={!newSubjectId || isSubmitting}
          style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
        >
          <PlusIcon size={14} /> {isSubmitting ? '...' : 'Agregar'}
        </button>
      </div>

      {/* Listado de materias añadidas */}
      {offeredSubjects.length > 0 ? (
        <div className="ia-catalog-list">
          {offeredSubjects.map((item) => (
            <div key={item.subject_id} className="ia-catalog-item" style={{ padding: '8px 12px' }}>
              <div className="ia-catalog-item-info">
                <div>
                  <span className="ia-catalog-item-title" style={{ fontSize: '0.86rem' }}>{item.subject?.name}</span>
                  {item.description && (
                    <p className="ia-catalog-item-desc" style={{ fontSize: '0.76rem' }}>{item.description}</p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ia-badge ia-badge-blue" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  {formatAcademicLevel(item.level)}
                </span>
                <button
                  type="button"
                  className="ia-btn-icon-danger"
                  onClick={() => onRemove(item.subject_id)}
                  title="Eliminar materia"
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
          Aún no has agregado materias que puedas enseñar.
        </p>
      )}
    </div>
  );
}
