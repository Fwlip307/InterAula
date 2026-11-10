import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import { profileService } from '../../services/profile.service';
import type { Profile } from '../../types/profile';
import ThemeModeMenu from './ThemeModeMenu';
import GlobalNavigationSearch from './GlobalNavigationSearch';
import {
  AcademicCapIcon,
  UserIcon,
  EditIcon,
  LogOutIcon,
  ChevronDownIcon,
  MenuIcon,
  XIcon,
  ShieldCheckIcon,
  CompassIcon,
  SlidersIcon,
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

  useEffect(() => {
    let active = true;
    profileService.getMyProfile().then((data) => {
      if (active) setProfile(data);
    });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName =
    profile?.display_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : null) ||
    user?.email?.split('@')[0] ||
    'Estudiante';

  const initials = displayName.charAt(0).toUpperCase();

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="ia-navbar">
      <div className="ia-navbar-inner">
        <Link to="/dashboard" className="ia-brand" aria-label="InterAula, ir al inicio">
          <AcademicCapIcon size={24} color={isCalmMode ? '#475569' : '#2563eb'} />
          <span className="ia-brand-name">InterAula</span>
        </Link>

        <nav className="ia-nav-links" aria-label="Navegación principal">
          <Link to="/dashboard" className={`ia-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            Inicio
          </Link>
          <Link to="/learning-space" className={`ia-nav-item ${isActive('/learning-space') || isActive('/learning') ? 'active' : ''}`}>
            Mi espacio
          </Link>
          <Link to="/tutoring" className={`ia-nav-item ${isActive('/tutoring') ? 'active' : ''}`}>
            Tutorías
          </Link>
          <Link to="/resources" className={`ia-nav-item ${isActive('/resources') ? 'active' : ''}`}>
            Apuntes
          </Link>
          <Link to="/projects" className={`ia-nav-item ${isActive('/projects') ? 'active' : ''}`}>
            Proyectos
          </Link>
          <Link to="/forum" className={`ia-nav-item ${isActive('/forum') ? 'active' : ''}`}>
            Foro
          </Link>
          <Link to="/profile" className={`ia-nav-item ${isActive('/profile') ? 'active' : ''}`}>
            Mi Perfil
          </Link>
        </nav>

        <div className="ia-nav-user">
          <GlobalNavigationSearch onOpen={() => { setMenuOpen(false); setMobileOpen(false); }} />
          <ThemeModeMenu variant="app" />

          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="ia-user-pill-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="ia-user-avatar-img" />
              ) : (
                <div className="ia-user-avatar">{initials}</div>
              )}
              <span className="ia-user-name-text">{displayName}</span>
              <ChevronDownIcon size={14} color="#64748b" />
            </button>

            {menuOpen && (
              <div className="ia-dropdown-menu">
                <div className="ia-dropdown-header">
                  <strong>{displayName}</strong>
                  <span className="ia-dropdown-email">{user?.email}</span>
                </div>
                <div className="ia-dropdown-divider" />
                <Link to="/learning-space" className="ia-dropdown-item" onClick={() => setMenuOpen(false)}>
                  <CompassIcon size={15} />
                  <span>Mi espacio de aprendizaje</span>
                </Link>
                <Link to="/profile" className="ia-dropdown-item" onClick={() => setMenuOpen(false)}>
                  <UserIcon size={15} />
                  <span>Ver mi perfil</span>
                </Link>
                <Link to="/profile?tab=interests" className="ia-dropdown-item" onClick={() => setMenuOpen(false)}>
                  <CompassIcon size={15} />
                  <span>Mis intereses y recomendaciones</span>
                </Link>
                <Link to="/profile/edit" className="ia-dropdown-item" onClick={() => setMenuOpen(false)}>
                  <EditIcon size={15} />
                  <span>Editar perfil</span>
                </Link>
                <Link to="/profile?tab=tutoring" className="ia-dropdown-item" onClick={() => setMenuOpen(false)}>
                  <ShieldCheckIcon size={15} />
                  <span>Acreditación de Tutor</span>
                </Link>
                <Link to="/settings" className="ia-dropdown-item" onClick={() => setMenuOpen(false)}>
                  <SlidersIcon size={15} />
                  <span>Accesibilidad y tema visual</span>
                </Link>
                <div className="ia-dropdown-divider" />
                <button type="button" className="ia-dropdown-item danger" onClick={handleSignOut}>
                  <LogOutIcon size={15} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="ia-mobile-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="ia-mobile-nav">
          <Link
            to="/dashboard"
            className={`ia-mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Inicio
          </Link>
          <Link
            to="/learning-space"
            className={`ia-mobile-nav-item ${isActive('/learning-space') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Mi espacio de aprendizaje
          </Link>
          <Link
            to="/tutoring"
            className={`ia-mobile-nav-item ${isActive('/tutoring') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Tutorías
          </Link>
          <Link
            to="/resources"
            className={`ia-mobile-nav-item ${isActive('/resources') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Apuntes y Biblioteca
          </Link>
          <Link
            to="/projects"
            className={`ia-mobile-nav-item ${isActive('/projects') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Proyectos
          </Link>
          <Link
            to="/forum"
            className={`ia-mobile-nav-item ${isActive('/forum') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Foro Estudiantil
          </Link>
          <Link
            to="/profile"
            className={`ia-mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Mi Perfil
          </Link>
          <Link
            to="/profile/edit"
            className={`ia-mobile-nav-item ${location.pathname === '/profile/edit' ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Editar Perfil
          </Link>
          <Link to="/profile?tab=interests" className="ia-mobile-nav-item" onClick={() => setMobileOpen(false)}>
            Mis intereses y recomendaciones
          </Link>
          <Link
            to="/profile?tab=tutoring"
            className={`ia-mobile-nav-item ${location.search.includes('tab=tutoring') ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Acreditación de Tutor
          </Link>
          <button
            type="button"
            className="ia-mobile-nav-item"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => {
              toggleCalmMode();
              setMobileOpen(false);
            }}
          >
            {isCalmMode ? 'Desactivar Modo Calma' : 'Activar Modo Calma'}
          </button>
          <div className="ia-dropdown-divider" style={{ margin: '8px 0' }} />
          <button
            type="button"
            className="ia-mobile-nav-item danger"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={handleSignOut}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  );
}
