import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import { profileService } from '../../services/profile.service';
import type { Profile } from '../../types/profile';
import ThemeModeMenu from './ThemeModeMenu';
import GlobalNavigationSearch from './GlobalNavigationSearch';
import InboxLink from './InboxLink';
import { MAIN_DESTINATIONS, isDestinationActive } from '../../navigation/guidedNavigation';
import { AcademicCapIcon, ChevronDownIcon, MenuIcon, XIcon } from '../common/Icons';

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
    if (user) profileService.getMyProfile().then(data => { if (active) setProfile(data); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, location.pathname]);
  useEffect(() => { setMenuOpen(false); setMobileOpen(false); }, [location.key]);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);
  const displayName = profile?.display_name || profile?.first_name || user?.email?.split('@')[0] || 'Mi cuenta';
  const close = () => { setMenuOpen(false); setMobileOpen(false); };
  return <header className="ia-navbar" ref={headerRef} onKeyDown={event => {
    if (event.key === 'Escape') {
      if (menuOpen) { setMenuOpen(false); accountButton.current?.focus(); }
      else if (mobileOpen) { setMobileOpen(false); mobileButton.current?.focus(); }
    }
  }}>
    <div className="ia-navbar-inner">
      <Link to="/dashboard" className="ia-brand" aria-label="InterAula, ir al inicio"><AcademicCapIcon size={24} color={isCalmMode ? '#475569' : '#2563eb'} /><span className="ia-brand-name">InterAula</span></Link>
      <nav className="ia-nav-links" aria-label="Navegación principal">
        {MAIN_DESTINATIONS.map(item => <Link key={item.href} to={item.href} className={'ia-nav-item ' + (isDestinationActive(location.pathname, item.paths) ? 'active' : '')} aria-current={isDestinationActive(location.pathname, item.paths) ? 'page' : undefined}>{item.label}</Link>)}
      </nav>
      <div className="ia-nav-user">
        <GlobalNavigationSearch onOpen={close} />
        <InboxLink/>
        <ThemeModeMenu variant="app" />
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button type="button" ref={accountButton} className="ia-user-pill-btn" aria-label="Mi cuenta" aria-controls="ia-account-menu" aria-expanded={menuOpen} onClick={() => { setMenuOpen(value => !value); setMobileOpen(false); }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="ia-user-avatar-img" /> : <span className="ia-user-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
            <span className="ia-user-name-text">{displayName}</span><ChevronDownIcon size={14} />
          </button>
          {menuOpen && <div id="ia-account-menu" className="ia-dropdown-menu">
            <div className="ia-dropdown-header"><strong>{displayName}</strong></div>
            <Link to="/profile" className="ia-dropdown-item" onClick={close}>Mi perfil</Link>
            <Link to="/guide" className="ia-dropdown-item" onClick={close}>Guía de InterAula</Link>
            <Link to="/learning-space?tab=profile" className="ia-dropdown-item" onClick={close}>Mis apoyos para aprender</Link>
            <Link to="/settings" className="ia-dropdown-item" onClick={close}>Lectura y apariencia</Link>
            <div className="ia-dropdown-divider" />
              <Link to="/profile?tab=interests" className="ia-dropdown-item" onClick={close}>Mis intereses</Link>
              <Link to="/community" className="ia-dropdown-item" onClick={close}>Mi institución y cercanía</Link>
              <Link to="/profile/edit" className="ia-dropdown-item" onClick={close}>Editar mis datos</Link>
              <Link to="/profile?tab=tutoring" className="ia-dropdown-item" onClick={close}>Acreditarme como tutor</Link>
              <Link to="/my-tutoring" className="ia-dropdown-item" onClick={close}>Gestionar mis tutorías</Link>
            <button type="button" className="ia-dropdown-item" onClick={toggleCalmMode}>{isCalmMode ? 'Desactivar Modo Calma' : 'Activar Modo Calma'}</button>
            <div className="ia-dropdown-divider" />
            <button type="button" className="ia-dropdown-item danger" onClick={async () => { await signOut(); navigate('/login'); }}>Cerrar sesión</button>
          </div>}
        </div>
        <button ref={mobileButton} type="button" className="ia-mobile-toggle" aria-label={mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={mobileOpen} aria-controls="ia-mobile-navigation" onClick={() => { setMobileOpen(value => !value); setMenuOpen(false); }}>
          {mobileOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
        </button>
      </div>
    </div>
    {mobileOpen && <nav id="ia-mobile-navigation" className="ia-mobile-nav" aria-label="Navegación principal móvil">
      {MAIN_DESTINATIONS.map(item => <Link key={item.href} to={item.href} className={'ia-mobile-nav-item ' + (isDestinationActive(location.pathname, item.paths) ? 'active' : '')} aria-current={isDestinationActive(location.pathname, item.paths) ? 'page' : undefined} onClick={close}>{item.label}</Link>)}
    </nav>}
  </header>;
}
