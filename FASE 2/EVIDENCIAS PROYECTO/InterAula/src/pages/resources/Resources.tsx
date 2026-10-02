import { Link } from 'react-router-dom';
import {
  BookOpenIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';

export default function Resources() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/dashboard" className="ia-btn-icon-back" aria-label="Volver al panel" title="Volver al panel">
            <ArrowLeftIcon size={18} />
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Recursos y Apuntes
          </h1>
        </div>
      </div>

      <div className="ia-card">
        <EmptyState
          style={{ padding: '50px 20px' }}
          icon={<BookOpenIcon size={30} color="#16a34a" />}
          title="Repositorio Académico en Desarrollo"
          description="Próximamente podrás subir, compartir y descargar guías de estudio, apuntes de clases y resúmenes validados por tutores pares de tu misma universidad."
          action={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#eff6ff', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginTop: '12px' }}>
              <SparklesIcon size={14} color="#2563eb" /> Módulo planificado para futuros Sprints
            </div>
          }
        />
      </div>
    </div>
  );
}
