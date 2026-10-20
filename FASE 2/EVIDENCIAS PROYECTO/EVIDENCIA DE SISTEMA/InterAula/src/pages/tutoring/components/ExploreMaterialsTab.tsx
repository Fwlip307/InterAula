import { BookOpenIcon, StarIcon, DownloadIcon } from '../../../components/common/Icons';
import { STUDY_RESOURCES } from '../../learning/data/studyBank';
import type { Subject } from '../../../types/profile';

interface ExploreMaterialsTabProps {
  searchTerm: string;
  selectedSubjectId: string;
  subjects: Subject[];
  onDownload: (title: string) => void;
}

export default function ExploreMaterialsTab({
  searchTerm,
  selectedSubjectId,
  subjects,
  onDownload,
}: ExploreMaterialsTabProps) {
  const filtered = STUDY_RESOURCES.filter((res) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      term === '' ||
      res.title.toLowerCase().includes(term) ||
      res.subject.toLowerCase().includes(term) ||
      res.description.toLowerCase().includes(term) ||
      res.topics.some((t) => t.toLowerCase().includes(term));
    const selectedSubjectObj = subjects.find((s) => s.id === selectedSubjectId);
    const matchesSubject =
      selectedSubjectId === 'all' ||
      (selectedSubjectObj && res.subject.toLowerCase().includes(selectedSubjectObj.name.toLowerCase()));
    return matchesSearch && matchesSubject;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpenIcon size={20} color="#16a34a" />
            Banco de Apuntes y Recursos de Estudio
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Materiales, resúmenes de certámenes, guías con ejercicios resueltos y formularios compartidos por tutores y estudiantes.
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {filtered.map((res) => (
          <div
            key={res.id}
            className="ia-card"
            style={{
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              transition: 'all 0.18s ease',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background:
                      res.category === 'Resumen'
                        ? '#eff6ff'
                        : res.category === 'Guia de Ejercicios'
                        ? '#f0fdf4'
                        : res.category === 'Cheatsheet'
                        ? '#faf5ff'
                        : '#fffbeb',
                    color:
                      res.category === 'Resumen'
                        ? '#1d4ed8'
                        : res.category === 'Guia de Ejercicios'
                        ? '#15803d'
                        : res.category === 'Cheatsheet'
                        ? '#7c3aed'
                        : '#b45309',
                  }}
                >
                  {res.category}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  {res.semester}
                </span>
              </div>

              <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.35 }}>
                {res.title}
              </h3>

              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginBottom: '8px' }}>
                {res.subject}
              </div>

              <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                {res.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {res.topics.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: '0.72rem',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      color: '#475569',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Por <strong>{res.author}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#d97706' }}>
                  <StarIcon size={14} color="#f59e0b" style={{ fill: '#f59e0b' }} />
                  <span>{res.rating}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>({res.downloadsCount} descargas)</span>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '0.8rem',
                  color: '#475569',
                  marginBottom: '12px',
                }}
              >
                <strong>Contenido clave:</strong> {res.contentSummary}
              </div>

              <button
                type="button"
                onClick={() => onDownload(res.title)}
                className="ia-btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '9px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#16a34a',
                  borderColor: '#15803d',
                }}
              >
                <DownloadIcon size={16} color="#ffffff" />
                <span>Descargar Apunte / Guía</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
