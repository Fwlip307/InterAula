import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';
import { useCalmMode } from '../../context/CalmModeContext';
import { SlidersIcon } from '../common/Icons';
import '../../styles/dashboard.css';

export default function AppLayout() {
  const { isCalmMode, toggleCalmMode } = useCalmMode();

  return (
    <div className={`ia-layout ${isCalmMode ? 'ia-calm-mode' : ''}`} data-calm-mode={isCalmMode ? 'true' : 'false'}>
      {isCalmMode && (
        <div className="ia-calm-active-bar" role="status" aria-live="polite">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <SlidersIcon size={14} />
            <strong>Modo Calma activo:</strong> Interfaz de bajo estímulo visual, contraste descansado y sin animaciones distractivas.
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/settings" style={{ color: 'inherit', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline' }}>
              Ajustar lectura
            </Link>
            <button type="button" className="ia-calm-active-bar__action" onClick={toggleCalmMode}>
              Volver a vista estándar
            </button>
          </div>
        </div>
      )}
      <Navbar />
      <main className="ia-main">
        <Outlet />
      </main>
      <footer className="ia-footer">
        <p style={{ margin: 0 }}>
          InterAula · Aprender juntos, a nuestra manera
          {isCalmMode && (
            <span
              style={{
                marginLeft: '10px',
                fontSize: '0.74rem',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'var(--ia-bg-subtle)',
                border: '1px solid var(--ia-border)',
                color: 'var(--ia-text-body)',
              }}
            >
              Modo Calma activo
            </span>
          )}
        </p>
      </footer>
    </div>
  );
}
