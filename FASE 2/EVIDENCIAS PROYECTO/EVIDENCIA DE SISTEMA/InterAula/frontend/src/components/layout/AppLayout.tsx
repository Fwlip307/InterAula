import { useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import ReadingRuler from '../common/ReadingRuler';
import { useCalmMode } from '../../context/CalmModeContext';
import { MAIN_DESTINATIONS, isDestinationActive } from '../../navigation/guidedNavigation';
import '../../styles/dashboard.css';
import '../../styles/guidedExperience.css';

export default function AppLayout() {
  const { isCalmMode, toggleCalmMode } = useCalmMode();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const group = MAIN_DESTINATIONS.find(item => item.href !== '/dashboard' && isDestinationActive(location.pathname, item.paths));
  useEffect(() => {
    if (!location.hash) { window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }); }
  }, [location.pathname]);
  return <div className={'ia-layout ' + (isCalmMode ? 'ia-calm-mode' : '')} data-calm-mode={isCalmMode ? 'true' : 'false'}>
    <a className="ia-skip-link" href="#ia-main-content">Saltar al contenido</a>
    {isCalmMode && <div className="ia-calm-active-bar"><strong>Modo Calma activo</strong><div className="ia-guided-inline" style={{ padding: 0 }}><Link to="/settings">Ajustar lectura</Link><button type="button" className="ia-calm-active-bar__action" onClick={toggleCalmMode}>Desactivar</button></div></div>}
    <Navbar />
    <ReadingRuler />
    <main className="ia-main" id="ia-main-content" ref={main} tabIndex={-1}>
      {location.pathname !== '/dashboard' && <nav className="ia-guided-location" aria-label="Ubicación">
        <Link to="/dashboard">Inicio</Link><span aria-hidden="true">/</span>
        {group && location.pathname !== group.href ? <><Link to={group.href}>{group.label}</Link><span aria-hidden="true">/</span></> : null}
        <span>{location.pathname.startsWith('/resources') ? 'Apuntes' : location.pathname.startsWith('/projects') ? 'Proyectos' : location.pathname.startsWith('/forum') ? 'Foro' : location.pathname === '/community' ? 'Mi institución' : location.pathname.startsWith('/profile') || location.pathname.startsWith('/users') ? 'Perfil' : location.pathname === '/settings' ? 'Configuración' : location.pathname === '/my-tutoring' ? 'Mis tutorías' : group?.label || 'Mi espacio'}</span>
      </nav>}
      <Outlet />
    </main>
    <footer className="ia-footer"><p style={{ margin: 0 }}>InterAula · Aprender juntos, a nuestra manera</p></footer>
  </div>;
}
