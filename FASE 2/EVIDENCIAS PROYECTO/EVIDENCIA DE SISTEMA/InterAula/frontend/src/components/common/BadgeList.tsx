import type { UserBadge } from '../../types/tutoring';
import { AwardIcon, ShieldCheckIcon } from './Icons';
import { formatTutoringDateTime } from '../../utils/formatters';

interface BadgeListProps {
  badges: UserBadge[];
  title?: string;
  compact?: boolean;
}

/**
 * Visualizador de insignias académicas y de prestigio universitario obtenidas por el usuario.
 * Utiliza exclusivamente iconos SVG y fechas reales desde Supabase.
 */
export default function BadgeList({
  badges,
  title = 'Insignias y Reconocimientos',
  compact = false,
}: BadgeListProps) {
  if (badges.length === 0) {
    return (
      <div className="ia-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AwardIcon size={18} color="#2563eb" />
          {title}
        </h3>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: '0.84rem', color: '#64748b' }}>
          Aún no se registran insignias obtenidas. Se otorgan automáticamente al completar hitos académicos y de tutoría (1, 10, 25 y 50 tutorías).
        </div>
      </div>
    );
  }

  return (
    <div className="ia-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AwardIcon size={18} color="#2563eb" />
          {title}
        </h3>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '3px 10px', borderRadius: '9999px' }}>
          {badges.length} {badges.length === 1 ? 'insignia' : 'insignias'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? 'repeat(auto-fill, minmax(180px, 1fr))' : 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {badges.map((ub) => {
          const badge = ub.badge;
          if (!badge) return null;

          return (
            <div
              key={ub.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AwardIcon size={20} color="#1d4ed8" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                  {badge.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.35, marginBottom: '6px' }}>
                  {badge.description}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheckIcon size={12} color="#16a34a" />
                  <span>Obtenida: {formatTutoringDateTime(ub.awarded_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
