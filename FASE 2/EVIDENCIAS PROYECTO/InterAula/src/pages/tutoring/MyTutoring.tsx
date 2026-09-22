import { Link } from 'react-router-dom';
import {
  CalendarIcon,
  BookOpenIcon,
  UsersIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';

export default function MyTutoring() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/dashboard" className="ia-btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeftIcon size={16} /> Volver
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Mis Tutorías
          </h1>
        </div>
      </div>

      <div className="ia-card">
        <EmptyState
          style={{ padding: '48px 20px' }}
          icon={<CalendarIcon size={30} color="#2563eb" />}
          title="Aún no tienes sesiones agendadas"
          description="El módulo de agendamiento y salas de encuentro se activará en el Sprint correspondiente. Mientras tanto, mantén actualizado tu catálogo de materias en tu perfil."
          action={
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/tutoring" className="ia-btn-primary">
                <BookOpenIcon size={16} /> Explorar materias
              </Link>
              <Link to="/profile/edit" className="ia-btn-secondary">
                <UsersIcon size={16} /> Configurar mis materias
              </Link>
            </div>
          }
        />
      </div>

      <div className="ia-card" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <SparklesIcon size={18} color="#2563eb" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Cómo funciona el intercambio en InterAula
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
          InterAula promueve el aprendizaje colaborativo horizontal entre pares universitarios. Puedes solicitar acompañamiento en asignaturas complejas y brindar apoyo en aquellas materias donde poseas mayor dominio.
        </p>
      </div>
    </div>
  );
}
