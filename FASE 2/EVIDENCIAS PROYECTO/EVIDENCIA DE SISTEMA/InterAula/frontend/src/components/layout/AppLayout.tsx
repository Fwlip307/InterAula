import ModerationStatus from '../support/ModerationStatus';
import { useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import ReadingRuler from '../common/ReadingRuler';
import { useCalmMode } from '../../context/CalmModeContext';
import { MAIN_DESTINATIONS, isDestinationActive } from '../../navigation/guidedNavigation';
import { useAuth } from '../../context/AuthContext';
import { OrientationProvider } from '../../context/OrientationContext';
import OrientationAssistant from '../orientation/OrientationAssistant';
import interaulaLogo from '../../assets/branding/interaula-logo.png';
import '../../styles/dashboard.css';
import '../../styles/guidedExperience.css';

export default function AppLayout() {
  const { user } = useAuth();
  return (
    <OrientationProvider key={user?.id || 'guest'}>
      <AppLayoutContent />
    </OrientationProvider>
  );
}

function AppLayoutContent() {
  const { isCalmMode, toggleCalmMode } = useCalmMode();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const group = MAIN_DESTINATIONS.find(
    (item) => item.href !== '/dashboard' && isDestinationActive(location.pathname, item.paths)
  );

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  const currentBreadcrumb =
    location.pathname === '/support'
      ? 'Avisos y ayuda'
      : location.pathname.startsWith('/resources')
        ? 'Apuntes'
        : location.pathname.startsWith('/projects')
          ? 'Hub de Proyectos'
          : location.pathname.startsWith('/forum')
            ? 'Foro Académico'
            : location.pathname === '/community'
              ? 'Mi institución'
              : location.pathname.startsWith('/profile') || location.pathname.startsWith('/users')
                ? 'Perfil'
                : location.pathname === '/settings'
                  ? 'Configuración'
                  : location.pathname === '/my-tutoring'
                    ? 'Mis tutorías'
                    : group?.label || 'Mi espacio';

  return (
    <div
      className={'ia-layout ' + (isCalmMode ? 'ia-calm-mode' : '')}
      data-calm-mode={isCalmMode ? 'true' : 'false'}
    >
      <a className="ia-skip-link" href="#ia-main-content">
        Saltar al contenido
      </a>
      {isCalmMode && (
        <div className="ia-calm-active-bar">
          <strong>Modo Calma activo</strong>
          <div className="ia-guided-inline" style={{ padding: 0 }}>
            <Link to="/settings">Ajustar lectura</Link>
            <button type="button" className="ia-calm-active-bar__action" onClick={toggleCalmMode}>
              Desactivar
            </button>
          </div>
        </div>
      )}
      <Navbar />
      <ReadingRuler />
      <main className="ia-main" id="ia-main-content" ref={main} tabIndex={-1}>
        {location.pathname !== '/dashboard' && (
          <nav className="ia-guided-location" aria-label="Ubicación">
            <Link to="/dashboard">Inicio</Link>
            <span aria-hidden="true">/</span>
            {group && location.pathname !== group.href ? (
              <>
                <Link to={group.href}>{group.label}</Link>
                <span aria-hidden="true">/</span>
              </>
            ) : null}
            <span>{currentBreadcrumb}</span>
          </nav>
        )}
        <ModerationStatus />
        <Outlet />
      </main>

      <footer className="ia-footer">
        <div className="ia-footer-inner">
          <div className="ia-footer-brand-col">
            <Link to="/dashboard" className="ia-footer-brand">
              <img src={interaulaLogo} alt="Logo InterAula" className="ia-brand-logo" />
              <span className="ia-brand-name">InterAula</span>
            </Link>
            <p className="ia-footer-desc">
              Plataforma universitaria de tutorías entre pares, aprendizaje adaptable y comunidad académica neuroinclusiva.
            </p>
          </div>

          <div className="ia-footer-col">
            <h3 className="ia-footer-heading">Explorar</h3>
            <ul className="ia-footer-links">
              <li><Link to="/dashboard">Inicio</Link></li>
              <li><Link to="/learning-space">Estudiar</Link></li>
              <li><Link to="/tutoring">Pedir apoyo</Link></li>
              <li><Link to="/resources?tab=community">Apuntes de estudio</Link></li>
              <li><Link to="/participate">Comunidad (Foro y Proyectos)</Link></li>
            </ul>
          </div>

          <div className="ia-footer-col">
            <h3 className="ia-footer-heading">Accesibilidad y soporte</h3>
            <ul className="ia-footer-links">
              <li><Link to="/settings">Lectura y apariencia</Link></li>
              <li><Link to="/community">Mi institución y cercanía</Link></li>
              <li><Link to="/profile?tab=tutoring">Acreditarme como tutor</Link></li>
              <li><Link to="/guide">Guía de InterAula</Link></li>
              <li><Link to="/support">Avisos y ayuda</Link></li>
            </ul>
          </div>
        </div>

        <div className="ia-footer-bottom">
          <span>InterAula · Aprender juntos, a nuestra manera</span>
          <span>Diseño Universal de Aprendizaje (DUA) · Comunidad Universitaria</span>
        </div>
      </footer>

      <OrientationAssistant />
    </div>
  );
}
