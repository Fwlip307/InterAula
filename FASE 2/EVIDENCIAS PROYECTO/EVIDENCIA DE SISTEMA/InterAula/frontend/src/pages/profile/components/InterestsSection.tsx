import type { ProfileProjectInterest, ProjectInterest } from '../../../types/profile';
import { SparklesIcon, CheckIcon } from '../../../components/common/Icons';

interface InterestsSectionProps {
  userInterests: ProfileProjectInterest[];
  catalogInterests: ProjectInterest[];
  onToggle: (interestId: string) => Promise<void>;
}

export default function InterestsSection({
  userInterests,
  catalogInterests,
  onToggle,
}: InterestsSectionProps) {
  return (
    <div className="ia-form-section" id="interests-section">
      <h2 className="ia-form-section-title">
        <SparklesIcon size={20} color="#9333ea" /> Áreas de Proyectos que me Interesan ({userInterests.length})
      </h2>
      <p className="ia-form-section-desc">
        Haz clic en las temáticas en las que te gustaría participar o crear proyectos:
      </p>

      <div className="ia-chips-grid">
        {catalogInterests.map((int) => {
          const isSelected = userInterests.some((u) => u.interest_id === int.id);
          return (
            <button
              key={int.id}
              type="button"
              className={`ia-chip-btn ${isSelected ? 'active' : ''}`}
              onClick={() => onToggle(int.id)}
            >
              {isSelected && <CheckIcon size={14} color="#ffffff" />}
              {int.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
