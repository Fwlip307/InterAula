import { useState } from 'react';
import type { ProfileSkill, Skill, AcademicLevel } from '../../../types/profile';
import { CodeIcon, PlusIcon, TrashIcon } from '../../../components/common/Icons';
import { formatAcademicLevel } from '../../../utils/formatters';

interface SkillsSectionProps {
  userSkills: ProfileSkill[];
  catalogSkills: Skill[];
  onAdd: (skillId: string, level: AcademicLevel) => Promise<void>;
  onRemove: (skillId: string) => Promise<void>;
}

export default function SkillsSection({
  userSkills,
  catalogSkills,
  onAdd,
  onRemove,
}: SkillsSectionProps) {
  const [newSkillId, setNewSkillId] = useState('');
  const [newLevel, setNewLevel] = useState<AcademicLevel>('intermediate');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar habilidades del catálogo que aún no han sido añadidas
  const availableCatalog = catalogSkills.filter(
    (s) => !userSkills.some((u) => u.skill_id === s.id)
  );

  const handleAdd = async () => {
    if (!newSkillId || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAdd(newSkillId, newLevel);
      setNewSkillId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ia-form-section" id="skills-section">
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
            {availableCatalog.map((s) => (
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
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as AcademicLevel)}
          >
            <option value="basic">Básico</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        <button
          type="button"
          className="ia-btn-primary"
          onClick={handleAdd}
          disabled={!newSkillId || isSubmitting}
          style={{ height: '42px' }}
        >
          <PlusIcon size={16} /> {isSubmitting ? 'Agregando...' : 'Agregar Habilidad'}
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
                  {formatAcademicLevel(item.level)}
                </span>
                <button
                  type="button"
                  className="ia-btn-icon-danger"
                  onClick={() => onRemove(item.skill_id)}
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
  );
}
