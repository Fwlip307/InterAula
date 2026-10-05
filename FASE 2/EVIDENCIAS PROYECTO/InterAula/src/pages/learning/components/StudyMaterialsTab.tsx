import { useState } from 'react';
import { STUDY_RESOURCES } from '../data/studyBank';
import type { StudyResource } from '../data/studyBank';
import {
  BookOpenIcon,
  StarIcon,
  SearchIcon,
  DownloadIcon,
} from '../../../components/common/Icons';

export default function StudyMaterialsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const subjects = Array.from(new Set(STUDY_RESOURCES.map((r) => r.subject)));

  const filteredResources = STUDY_RESOURCES.filter((r) => {
    const matchesSearch =
      searchTerm === '' ||
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.topics.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSubject = selectedSubject === 'all' || r.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon
            key={i}
            size={13}
            color={i < full ? '#f59e0b' : '#cbd5e1'}
            style={i < full ? { fill: '#f59e0b' } : undefined}
          />
        ))}
        <span style={{ fontSize: '0.76rem', color: '#475569', marginLeft: '4px', fontWeight: 700 }}>
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra de busqueda y filtro */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <SearchIcon
            size={16}
            color="#94a3b8"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="ia-input"
            placeholder="Buscar por titulo, tema o palabra clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', width: '100%' }}
          />
        </div>
        <select
          className="ia-input"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          style={{ width: 'auto', minWidth: '220px' }}
        >
          <option value="all">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Grid de recursos */}
      {filteredResources.length === 0 ? (
        <div className="ia-card" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
          <BookOpenIcon size={32} color="#cbd5e1" />
          <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>
            No se encontraron materiales con ese criterio de busqueda.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} renderStars={renderStars} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceCard({
  resource,
  renderStars,
}: {
  resource: StudyResource;
  renderStars: (rating: number) => JSX.Element;
}) {
  const categoryColors: Record<string, { bg: string; color: string; border: string }> = {
    Resumen: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    'Guia de Ejercicios': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    Cheatsheet: { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
    Formulario: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  };
  const cat = categoryColors[resource.category] || categoryColors.Resumen;

  return (
    <div
      className="ia-card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderTop: `3px solid ${cat.color}`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              background: cat.bg,
              color: cat.color,
              border: `1px solid ${cat.border}`,
              marginBottom: '6px',
            }}
          >
            {resource.category}
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', lineHeight: 1.3 }}>
            {resource.title}
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {resource.subject} - {resource.semester}
          </span>
        </div>
      </div>

      {/* Descripcion */}
      <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
        {resource.description}
      </p>

      {/* Temas cubiertos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {resource.topics.map((topic) => (
          <span
            key={topic}
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
            }}
          >
            {topic}
          </span>
        ))}
      </div>

      {/* Contenido resumido */}
      <div
        style={{
          fontSize: '0.8rem',
          color: '#64748b',
          background: '#f8fafc',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          lineHeight: 1.4,
        }}
      >
        {resource.contentSummary}
      </div>

      {/* Footer: autor, rating, descargas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #f1f5f9',
          paddingTop: '10px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Por: <strong style={{ color: '#334155' }}>{resource.author}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {renderStars(resource.rating)}
          <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <DownloadIcon size={12} /> {resource.downloadsCount}
          </span>
        </div>
      </div>

      {/* Boton principal */}
      <button
        type="button"
        className="ia-btn-secondary"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px',
          fontWeight: 700,
          fontSize: '0.88rem',
        }}
      >
        <DownloadIcon size={16} />
        <span>Descargar Material</span>
      </button>
    </div>
  );
}
