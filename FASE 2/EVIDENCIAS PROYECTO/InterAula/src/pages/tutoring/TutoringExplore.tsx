import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { profileService } from '../../services/profile.service';
import type { Subject } from '../../types/profile';
import {
  BookOpenIcon,
  SearchIcon,
  TargetIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '../../components/common/Icons';

export default function TutoringExplore() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const data = await profileService.getSubjects();
        setSubjects(data);
      } catch (err) {
        console.error('[TutoringExplore] Error al cargar materias:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSubjects();
  }, []);

  const filteredSubjects = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      {/* Banner */}
      <section className="ia-hero-banner" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}>
        <div className="ia-hero-text">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
            <SparklesIcon size={14} color="#fde047" /> Catálogo Académico
          </div>
          <h1>Explorar Tutorías Universitarias</h1>
          <p>
            Descubre materias oficiales, conecta con compañeros que pueden orientarte o comparte tus asignaturas dominadas.
          </p>
        </div>
      </section>

      {/* Buscador de Asignaturas */}
      <div className="ia-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="ia-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar materia o área académica (ej: Programación, Cálculo, Física)..."
              style={{ paddingLeft: '40px' }}
            />
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <SearchIcon size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Materias del Catálogo */}
      <div className="ia-card">
        <div className="ia-card-header">
          <h2 className="ia-card-title">
            <TargetIcon size={20} color="#2563eb" /> Catálogo de Materias ({filteredSubjects.length})
          </h2>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Datos oficiales de InterAula</span>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>Cargando catálogo...</p>
        ) : filteredSubjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {filteredSubjects.map((sub) => (
              <div
                key={sub.id}
                style={{
                  padding: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                    {sub.name}
                  </h3>
                  {sub.category && (
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{sub.category}</span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span className="ia-badge ia-badge-blue">
                    <BookOpenIcon size={12} /> Materia oficial
                  </span>
                  <Link to="/profile/edit" className="ia-card-action" style={{ fontSize: '0.82rem' }}>
                    Enseñar / Aprender
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ia-empty-box">
            <p className="ia-empty-desc">No se encontraron materias que coincidan con "{searchTerm}".</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <Link to="/dashboard" className="ia-btn-secondary">
          <ArrowLeftIcon size={16} /> Volver al panel principal
        </Link>
      </div>
    </div>
  );
}
