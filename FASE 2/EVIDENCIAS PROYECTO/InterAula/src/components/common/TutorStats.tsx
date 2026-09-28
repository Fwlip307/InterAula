import type { TutorStatistics } from '../../types/tutoring';
import { StarIcon, BookOpenIcon, CheckIcon, UsersIcon } from './Icons';

interface TutorStatsProps {
  stats: TutorStatistics | null | undefined;
  title?: string;
  showBreakdown?: boolean;
}

/**
 * Componente reutilizable para visualizar la reputación y estadísticas de un tutor.
 * Muestra métricas reales basadas en tutor_statistics_view.
 * Si no hay evaluaciones aún, muestra un estado elegante en lugar de una calificación negativa ficticia.
 */
export default function TutorStats({
  stats,
  title = 'Reputación como Tutor',
  showBreakdown = true,
}: TutorStatsProps) {
  const hasReviews = Boolean(stats && stats.total_reviews_received > 0);
  const completedCount = stats?.total_completed_tutorings || 0;
  const reviewsCount = stats?.total_reviews_received || 0;

  return (
    <div className="ia-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StarIcon size={18} color="#2563eb" />
          {title}
        </h3>
        {hasReviews && stats && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              background: '#eff6ff',
              color: '#1d4ed8',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            <StarIcon size={14} color="#2563eb" />
            {Number(stats.overall_rating).toFixed(1)} / 10
          </span>
        )}
      </div>

      {/* Métricas clave */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: hasReviews && showBreakdown ? '16px' : '0',
        }}
      >
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <CheckIcon size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
            {completedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
            Tutorías Realizadas
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <UsersIcon size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
            {reviewsCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
            Evaluaciones Recibidas
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <BookOpenIcon size={18} color="#4f46e5" />
          </div>
          <div style={{ fontSize: hasReviews ? '1.35rem' : '0.9rem', fontWeight: hasReviews ? 800 : 600, color: hasReviews ? '#0f172a' : '#64748b', paddingTop: hasReviews ? '0' : '4px' }}>
            {hasReviews && stats ? `${Number(stats.overall_rating).toFixed(1)} / 10` : 'Sin reseñas'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
            Calificación Global
          </div>
        </div>
      </div>

      {/* Desglose de competencias si existen evaluaciones */}
      {hasReviews && showBreakdown && stats ? (
        <div style={{ background: '#f1f5f9', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
            Desglose de competencias evaluadas:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '3px' }}>
                <span>Comunicación pedagógica</span>
                <strong>{Number(stats.avg_communication).toFixed(1)} / 10</strong>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (Number(stats.avg_communication) / 10) * 100)}%`,
                    background: '#2563eb',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '3px' }}>
                <span>Dominio técnico y temático</span>
                <strong>{Number(stats.avg_knowledge).toFixed(1)} / 10</strong>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (Number(stats.avg_knowledge) / 10) * 100)}%`,
                    background: '#3b82f6',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '3px' }}>
                <span>Puntualidad y compromiso</span>
                <strong>{Number(stats.avg_punctuality).toFixed(1)} / 10</strong>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (Number(stats.avg_punctuality) / 10) * 100)}%`,
                    background: '#60a5fa',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
          Este tutor aún no cuenta con evaluaciones de estudiantes. Las calificaciones aparecerán una vez finalizada y evaluada su primera tutoría.
        </div>
      )}
    </div>
  );
}
