import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useCalmMode } from '../../context/CalmModeContext';
import '../../styles/dashboard.css';

export default function AppLayout() {
  const { isCalmMode } = useCalmMode();

  return (
    <div className={`ia-layout ${isCalmMode ? 'ia-calm-mode' : ''}`} data-calm-mode={isCalmMode ? 'true' : 'false'}>
      <Navbar />
      <main className="ia-main">
        <Outlet />
      </main>
      <footer className="ia-footer">
        <p style={{ margin: 0 }}>
          InterAula · Red Colaborativa de Aprendizaje Universitario
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
              🌿 Modo Calma activo
            </span>
          )}
        </p>
      </footer>
    </div>
  );
}
