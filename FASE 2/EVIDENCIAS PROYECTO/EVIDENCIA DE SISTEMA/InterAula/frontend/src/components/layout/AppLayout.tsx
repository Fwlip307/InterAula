import ModerationStatus from '../support/ModerationStatus';
import { useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import ReadingRuler from '../common/ReadingRuler';
import { useCalmMode } from '../../context/CalmModeContext';
import { MAIN_DESTINATIONS, isCategoryActive } from '../../navigation/guidedNavigation';
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
  const group = MAIN_DESTINATIONS.find((item) =>
    isCategoryActive(item, location.pathname, location.search)
  );

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');

  const currentBreadcrumb =
    location.pathname === '/support'
      ? 'Notificaciones y avisos'
      : location.pathname.startsWith('/messages')
        ? 'Mensajería'
        : location.pathname.startsWith('/resources')
          ? tab === 'mine'
            ? 'Apuntes académicos'
            : 'Biblioteca de recursos'
          : location.pathname.startsWith('/projects')
            ? 'Hub de Proyectos'
            : location.pathname.startsWith('/forum')
              ? 'Foro académico'
              : location.pathname === '/community'
                ? 'Mi institución'
                : location.pathname === '/profile' && tab === 'tutoring'
                  ? 'Acreditación de tutor'
                  : location.pathname.startsWith('/profile') || location.pathname.startsWith('/users')
                    ? 'Mi perfil'
                    : location.pathname === '/settings'
                      ? 'Configuración'
                      : location.pathname === '/my-tutoring'
                        ? 'Mis tutorías'
                        : location.pathname === '/tutoring' && tab === 'quizzes'
                          ? 'Cuestionarios y evaluaciones'
                          : location.pathname === '/tutoring' && tab === 'workshops'
                            ? 'Talleres y actividades'
                            : location.pathname === '/learning-space'
                              ? 'Mi espacio de aprendizaje'
                              : group?.label || 'Inicio';

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
            <Link to="/settings#accessibility">Ajustar lectura</Link>
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
            {group && currentBreadcrumb !== group.label ? (
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
              Plataforma universitaria de aprendizaje adaptable, tutorías entre pares, comunidad y proyectos interdisciplinarios.
            </p>
          </div>

          <div className="ia-footer-col">
            <h3 className="ia-footer-heading">Aprender y Tutorías</h3>
            <ul className="ia-footer-links">
              <li><Link to="/learning-space">Mi espacio de aprendizaje</Link></li>
              <li><Link to="/resources?tab=community">Biblioteca de recursos</Link></li>
              <li><Link to="/tutoring?tab=quizzes">Cuestionarios y evaluaciones</Link></li>
              <li><Link to="/tutoring">Explorar tutorías</Link></li>
              <li><Link to="/profile?tab=tutoring">Acreditación de tutor</Link></li>
            </ul>
          </div>

          <div className="ia-footer-col">
            <h3 className="ia-footer-heading">Comunidad y Proyectos</h3>
            <ul className="ia-footer-links">
              <li><Link to="/forum">Foro académico</Link></li>
              <li><Link to="/messages">Mensajería</Link></li>
              <li><Link to="/tutoring?tab=workshops">Talleres y actividades</Link></li>
              <li><Link to="/projects">Hub de Proyectos</Link></li>
              <li><Link to="/projects?tab=my_projects">Mis proyectos</Link></li>
            </ul>
          </div>

          <div className="ia-footer-col">
            <h3 className="ia-footer-heading">Mi cuenta</h3>
            <ul className="ia-footer-links">
              <li><Link to="/profile">Mi perfil</Link></li>
              <li><Link to="/learning-space?tab=profile">Mis preferencias de aprendizaje</Link></li>
              <li><Link to="/settings#accessibility">Apoyos sensoriales y accesibilidad</Link></li>
              <li><Link to="/settings">Configuración</Link></li>
              <li><Link to="/support">Notificaciones</Link></li>
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
