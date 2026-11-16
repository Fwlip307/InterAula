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
  title = 'Hitos de trayectoria',
  compact = false,
}: BadgeListProps) {
  if (badges.length === 0) {
    return (
      <div className="ia-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--ia-text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AwardIcon size={18} color="var(--ia-primary, #2563eb)" />
          {title}
        </h3>
        <div style={{ background: 'var(--ia-bg-subtle, #f8fafc)', borderRadius: '8px', padding: '14px', border: '1px dashed var(--ia-border, #cbd5e1)', textAlign: 'center', fontSize: '0.84rem', color: 'var(--ia-text-muted, #64748b)' }}>
          Aún no se registran hitos de trayectoria. Los nuevos hitos reconocen 1, 10, 25 y 50 sesiones validadas; la calidad se calcula por separado.
        </div>
      </div>
    );
  }

  return (
    <div className="ia-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--ia-text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AwardIcon size={18} color="var(--ia-primary, #2563eb)" />
          {title}
        </h3>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ia-primary, #2563eb)', background: 'var(--ia-primary-subtle, #eff6ff)', padding: '3px 10px', borderRadius: '9999px' }}>
          {badges.length} {badges.length === 1 ? 'insignia' : 'insignias'}
        </span>
      </div>

      <p style={{fontSize:'.8rem',lineHeight:1.6,color:'var(--ia-text-muted)'}}>Estos hitos reconocen participación. Los anteriores se conservan como registros históricos; no certifican calidad docente.</p>
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
                background: 'var(--ia-bg-card, #ffffff)',
                border: '1px solid var(--ia-border, #e2e8f0)',
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
                  background: 'var(--ia-primary-subtle, #eff6ff)',
                  border: '1px solid var(--ia-primary-border, #bfdbfe)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AwardIcon size={20} color="var(--ia-primary, #1d4ed8)" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ia-text-main, #0f172a)', marginBottom: '2px' }}>
                  {{tutoring_1:'Primera tutoría realizada',tutoring_10:'10 tutorías realizadas',tutoring_25:'25 tutorías realizadas',tutoring_50:'50 tutorías realizadas'}[badge.code]||badge.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-body, #475569)', lineHeight: 1.35, marginBottom: '6px' }}>
                  {badge.description}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ia-text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
