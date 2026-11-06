import type { NeededSubject, Subject, AcademicLevel, LearningPreference } from '../../../types/profile';
import { LEARNING_PREFERENCES } from '../../../types/profile';
import { SparklesIcon } from '../../../components/common/Icons';
import NeededSubjectsSection from './NeededSubjectsSection';

interface ProfileLearningTabProps {
  preferencesSuccessMsg: string | null;
  neededSubjects: NeededSubject[];
  catalogSubjects: Subject[];
  onAddNeededSubject: (subjectId: string, level: AcademicLevel, notes: string) => Promise<void>;
  onRemoveNeededSubject: (id: string) => Promise<void>;
  learningPreferences: LearningPreference[];
  onTogglePreference: (prefId: LearningPreference) => void;
}

export default function ProfileLearningTab({
  preferencesSuccessMsg,
  neededSubjects,
  catalogSubjects,
  onAddNeededSubject,
  onRemoveNeededSubject,
  learningPreferences,
  onTogglePreference,
}: ProfileLearningTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {preferencesSuccessMsg && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          {preferencesSuccessMsg}
        </div>
      )}

      {/* Subcomponente: Materias que necesito aprender */}
      <NeededSubjectsSection
        neededSubjects={neededSubjects}
        catalogSubjects={catalogSubjects}
        onAdd={onAddNeededSubject}
        onRemove={onRemoveNeededSubject}
      />

      {/* Preferencias Pedagógicas y Estilo de Estudio para el Aula Virtual */}
      <div className="ia-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <SparklesIcon size={20} color="#2563eb" />
              <h2 className="ia-card-title" style={{ margin: 0 }}>
                Preferencias de Aprendizaje y Estilo de Estudio
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, maxWidth: '780px' }}>
              Selecciona cómo te acomoda aprender mejor. En el <strong>Aula Virtual</strong>, los tutores verán estas pautas para modular el ritmo de la explicación, ofrecer pausas de asimilación o estructurar ejercicios prácticos paso a paso.
            </p>
          </div>
          <span
            style={{
              fontSize: '0.74rem',
              backgroundColor: '#eff6ff',
              color: '#1e40af',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '6px',
            }}
          >
            Adaptación Aula Virtual
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {LEARNING_PREFERENCES.map((pref) => {
            const isSelected = learningPreferences.includes(pref.id);
            return (
              <label
                key={pref.id}
                onClick={() => onTogglePreference(pref.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                  backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // gestionado por el label
                  style={{ width: '18px', height: '18px', accentColor: '#2563eb', marginTop: '2px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? '#1e40af' : '#0f172a' }}>
                    {pref.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                    {pref.description}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
