import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import { tutoringService } from '../../services/tutoring.service';
import type { Profile } from '../../types/profile';
import {
  UserIcon,
  SettingsIcon,
  ChevronDownIcon,
} from '../common/Icons';
import { getUserDisplayName, getUserInitial } from '../../utils/formatters';
import interaulaLogo from '../../assets/branding/interaula-logo.png';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasLiveClass, setHasLiveClass] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        const p = await profileService.getMyProfile();
        if (isMounted && p) {
          setProfile(p);
        }
      } catch (err) {
        console.error('[Navbar] Error al cargar perfil:', err);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    async function checkLive() {
      try {
        const workshops = await tutoringService.getUpcomingWorkshops();
        setHasLiveClass(workshops.some((w) => w.status === 'in_progress'));
      } catch {}
    }
    checkLive();

    const onUpdate = () => checkLive();
    window.addEventListener('ia_workshops_updated', onUpdate);
    const interval = setInterval(checkLive, 8000);

    return () => {
      window.removeEventListener('ia_workshops_updated', onUpdate);
      clearInterval(interval);
    };
  }, []);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeMenus = () => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  };

  const handleSignOut = async () => {
    closeMenus();
    await signOut();
    navigate('/login', { replace: true });
  };

  // Cálculo del avatar y nombre a mostrar mediante utilidad centralizada
  const displayName = getUserDisplayName(profile, user?.user_metadata, user?.email);
  const initial = getUserInitial(displayName);
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <header className="ia-navbar">
      <div className="ia-navbar-inner">
        {/* Logo / Marca */}
        <NavLink to="/dashboard" className="ia-brand" title="Ir al panel principal">
          <img
            src={interaulaLogo}
            alt="Logo InterAula"
            style={{ width: '36px', height: '36px', objectFit: 'contain' }}
          />
          <span className="ia-brand-name">InterAula</span>
        </NavLink>

        {/* Navegación principal (Desktop) */}
        <nav className="ia-nav-links">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `ia-nav-item ${isActive ? 'active' : ''}`}
          >
            Mi Panel
          </NavLink>
          <NavLink
            to="/tutoring"
            className={({ isActive }) => `ia-nav-item ${isActive ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Explorar Tutorías</span>
            {hasLiveClass && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  lineHeight: 1,
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.7)',
                }}
              >
                EN VIVO
              </span>
            )}
          </NavLink>
          <NavLink
            to="/my-tutoring"
            className={({ isActive }) => `ia-nav-item ${isActive ? 'active' : ''}`}
          >
            Mis Tutorías
          </NavLink>
          <NavLink
            to="/resources"
            className={({ isActive }) => `ia-nav-item ${isActive ? 'active' : ''}`}
          >
            Recursos y Apuntes
          </NavLink>
        </nav>

        {/* Menú de Usuario */}
        <div className="ia-nav-user" ref={dropdownRef}>
          <button
            type="button"
            className="ia-user-pill-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="ia-user-avatar-img"
                width="28"
                height="28"
                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="ia-user-avatar">{initial}</div>
            )}
            <span className="ia-user-name-text">{displayName}</span>
            <ChevronDownIcon size={14} color="#64748b" />
          </button>

          {/* Menú desplegable */}
          {isDropdownOpen && (
            <div className="ia-dropdown-menu">
              <div className="ia-dropdown-header">
                <strong>{profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : displayName}</strong>
                <span className="ia-dropdown-email">{user?.email}</span>
              </div>
              <div className="ia-dropdown-divider" />
              <NavLink to="/profile" className="ia-dropdown-item" onClick={closeMenus}>
                <UserIcon size={16} color="#2563eb" />
                Mi Perfil
              </NavLink>
              <NavLink to="/settings" className="ia-dropdown-item" onClick={closeMenus}>
                <SettingsIcon size={16} color="#64748b" />
                Configuración
              </NavLink>
              <div className="ia-dropdown-divider" />
              <button
                type="button"
                onClick={handleSignOut}
                className="ia-dropdown-item danger"
              >
                Cerrar sesión
              </button>
            </div>
          )}

          {/* Botón menú móvil */}
          <button
            type="button"
            className="ia-mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menú de navegación"
          >
            <span className="ia-hamburger-line" />
            <span className="ia-hamburger-line" />
            <span className="ia-hamburger-line" />
          </button>
        </div>
      </div>

      {/* Menú desplegable para móviles */}
      {isMobileMenuOpen && (
        <div className="ia-mobile-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `ia-mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMenus}
          >
            Mi Panel
          </NavLink>
          <NavLink
            to="/tutoring"
            className={({ isActive }) => `ia-mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMenus}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>Explorar Tutorías</span>
            {hasLiveClass && (
              <span
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                EN VIVO
              </span>
            )}
          </NavLink>
          <NavLink
            to="/my-tutoring"
            className={({ isActive }) => `ia-mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMenus}
          >
            Mis Tutorías
          </NavLink>
          <NavLink
            to="/resources"
            className={({ isActive }) => `ia-mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMenus}
          >
            Recursos y Apuntes
          </NavLink>
          <div className="ia-dropdown-divider" />
          <NavLink to="/profile" className="ia-mobile-nav-item" onClick={closeMenus}>
            Mi Perfil
          </NavLink>
          <NavLink to="/settings" className="ia-mobile-nav-item" onClick={closeMenus}>
            Configuración
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="ia-mobile-nav-item danger"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  );
}
