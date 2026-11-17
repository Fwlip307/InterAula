import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import { profileService } from '../../services/profile.service';
import type { Profile } from '../../types/profile';
import interaulaLogo from '../../assets/branding/interaula-logo.png';
import ThemeModeMenu from './ThemeModeMenu';
import GlobalNavigationSearch from './GlobalNavigationSearch';
import InboxLink from './InboxLink';
import { MAIN_DESTINATIONS, isDestinationActive } from '../../navigation/guidedNavigation';
import {
  BookOpenIcon,
  ChevronDownIcon,
  CompassIcon,
  EditIcon,
  LogOutIcon,
  MenuIcon,
  ShieldCheckIcon,
  SlidersIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '../common/Icons';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { isCalmMode, toggleCalmMode } = useCalmMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setProfile(null);
    if (user) {
      profileService
        .getMyProfile()
        .then((data) => {
          if (active) setProfile(data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user?.id, location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.key]);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const displayName = profile?.display_name || profile?.first_name || user?.email?.split('@')[0] || 'Mi cuenta';
  const close = () => {
    setMenuOpen(false);
    setMobileOpen(false);
  };

  return (
    <header
      className="ia-navbar"
      ref={headerRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (menuOpen) {
            setMenuOpen(false);
            accountButton.current?.focus();
          } else if (mobileOpen) {
            setMobileOpen(false);
            mobileButton.current?.focus();
          }
        }
      }}
    >
      <div className="ia-navbar-inner">
        <Link to="/dashboard" className="ia-brand" aria-label="InterAula, ir al inicio">
          <img src={interaulaLogo} alt="Logo InterAula" className="ia-brand-logo" />
          <span className="ia-brand-name">InterAula</span>
        </Link>

        <nav className="ia-nav-links" aria-label="Navegación principal">
          {MAIN_DESTINATIONS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={'ia-nav-item ' + (isDestinationActive(location.pathname, item.paths) ? 'active' : '')}
              aria-current={isDestinationActive(location.pathname, item.paths) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ia-nav-user">
          <GlobalNavigationSearch onOpen={close} />
          <InboxLink />
          <ThemeModeMenu variant="app" />

          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              ref={accountButton}
              className="ia-user-pill-btn"
              aria-label="Mi cuenta"
              aria-controls="ia-account-menu"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((value) => !value);
                setMobileOpen(false);
              }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="ia-user-avatar-img" />
              ) : (
                <span className="ia-user-avatar" aria-hidden="true">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="ia-user-name-text">{displayName}</span>
              <ChevronDownIcon size={14} />
            </button>

            {menuOpen && (
              <div id="ia-account-menu" className="ia-dropdown-menu">
                <div className="ia-dropdown-header">
                  <strong>{displayName}</strong>
                  {user?.email && <span className="ia-dropdown-sub">{user.email}</span>}
                </div>
                <Link to="/profile" className="ia-dropdown-item" onClick={close}>
                  <UserIcon size={15} />
                  <span>Mi perfil</span>
                </Link>
                <Link to="/profile/edit" className="ia-dropdown-item" onClick={close}>
                  <EditIcon size={15} />
                  <span>Editar mis datos</span>
                </Link>
                <Link to="/learning-space?tab=profile" className="ia-dropdown-item" onClick={close}>
                  <CompassIcon size={15} />
                  <span>Mis apoyos para aprender</span>
                </Link>
                <Link to="/settings" className="ia-dropdown-item" onClick={close}>
                  <SlidersIcon size={15} />
                  <span>Lectura y apariencia</span>
                </Link>
                <div className="ia-dropdown-divider" />
                <Link to="/resources?tab=community" className="ia-dropdown-item" onClick={close}>
                  <BookOpenIcon size={15} />
                  <span>Apuntes de estudio</span>
                </Link>
                <Link to="/community" className="ia-dropdown-item" onClick={close}>
                  <UsersIcon size={15} />
                  <span>Mi institución y cercanía</span>
                </Link>
                <Link to="/profile?tab=tutoring" className="ia-dropdown-item" onClick={close}>
                  <ShieldCheckIcon size={15} />
                  <span>Acreditarme como tutor</span>
                </Link>
                <Link to="/my-tutoring" className="ia-dropdown-item" onClick={close}>
                  <CompassIcon size={15} />
                  <span>Gestionar mis tutorías</span>
                </Link>
                <Link to="/guide" className="ia-dropdown-item" onClick={close}>
                  <BookOpenIcon size={15} />
                  <span>Guía de InterAula</span>
                </Link>
                <button
                  type="button"
                  className="ia-dropdown-item"
                  onClick={() => {
                    toggleCalmMode();
                    close();
                  }}
                >
                  <SlidersIcon size={15} />
                  <span>{isCalmMode ? 'Desactivar Modo Calma' : 'Activar Modo Calma'}</span>
                </button>
                <div className="ia-dropdown-divider" />
                <button
                  type="button"
                  className="ia-dropdown-item danger"
                  onClick={async () => {
                    await signOut();
                    navigate('/login');
                  }}
                >
                  <LogOutIcon size={15} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>

          <button
            ref={mobileButton}
            type="button"
            className="ia-mobile-toggle"
            aria-label={mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-expanded={mobileOpen}
            aria-controls="ia-mobile-navigation"
            onClick={() => {
              setMobileOpen((value) => !value);
              setMenuOpen(false);
            }}
          >
            {mobileOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="ia-mobile-navigation" className="ia-mobile-nav" aria-label="Navegación principal móvil">
          <div className="ia-mobile-nav-group">
            <div className="ia-mobile-nav-label">Navegación principal</div>
            {MAIN_DESTINATIONS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={'ia-mobile-nav-item ' + (isDestinationActive(location.pathname, item.paths) ? 'active' : '')}
                aria-current={isDestinationActive(location.pathname, item.paths) ? 'page' : undefined}
                onClick={close}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="ia-mobile-nav-group">
            <div className="ia-mobile-nav-label">Estudio y comunidad</div>
            <Link to="/resources?tab=community" className="ia-mobile-nav-item" onClick={close}>
              <BookOpenIcon size={15} />
              <span>Apuntes de estudio</span>
            </Link>
            <Link to="/my-tutoring" className="ia-mobile-nav-item" onClick={close}>
              <CompassIcon size={15} />
              <span>Mis tutorías y talleres</span>
            </Link>
            <Link to="/community" className="ia-mobile-nav-item" onClick={close}>
              <UsersIcon size={15} />
              <span>Mi institución y cercanía</span>
            </Link>
            <Link to="/guide" className="ia-mobile-nav-item" onClick={close}>
              <ShieldCheckIcon size={15} />
              <span>Guía de InterAula</span>
            </Link>
          </div>

          <div className="ia-mobile-nav-group">
            <div className="ia-mobile-nav-label">Cuenta y accesibilidad</div>
            <Link to="/profile" className="ia-mobile-nav-item" onClick={close}>
              <UserIcon size={15} />
              <span>Mi perfil</span>
            </Link>
            <Link to="/settings" className="ia-mobile-nav-item" onClick={close}>
              <SlidersIcon size={15} />
              <span>Lectura y apariencia</span>
            </Link>
            <button
              type="button"
              className="ia-mobile-nav-item"
              onClick={() => {
                toggleCalmMode();
                close();
              }}
            >
              <SlidersIcon size={15} />
              <span>{isCalmMode ? 'Desactivar Modo Calma' : 'Activar Modo Calma'}</span>
            </button>
            <button
              type="button"
              className="ia-mobile-nav-item danger"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
            >
              <LogOutIcon size={15} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
