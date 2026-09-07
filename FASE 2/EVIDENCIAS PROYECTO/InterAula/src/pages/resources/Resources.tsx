import { Link } from 'react-router-dom';
import {
  BookOpenIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '../../components/common/Icons';

export default function Resources() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/dashboard" className="ia-btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeftIcon size={16} /> Volver
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Recursos y Apuntes
          </h1>
        </div>
      </div>

      <div className="ia-card">
        <div className="ia-empty-box" style={{ padding: '50px 20px' }}>
          <div className="ia-empty-icon" style={{ width: '60px', height: '60px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <BookOpenIcon size={30} />
          </div>
          <h2 className="ia-empty-title" style={{ fontSize: '1.25rem' }}>
            Repositorio Académico en Desarrollo
          </h2>
          <p className="ia-empty-desc" style={{ maxWidth: '480px' }}>
            Próximamente podrás subir, compartir y descargar guías de estudio, apuntes de clases y resúmenes validados por tutores pares de tu misma universidad.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#eff6ff', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginTop: '12px' }}>
            <SparklesIcon size={14} color="#2563eb" /> Módulo planificado para futuros Sprints
          </div>
        </div>
      </div>
    </div>
  );
}
