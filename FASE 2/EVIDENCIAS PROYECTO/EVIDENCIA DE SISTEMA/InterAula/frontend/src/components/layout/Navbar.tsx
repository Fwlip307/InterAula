import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import { profileService } from '../../services/profile.service';
import { messagingService } from '../../services/messaging.service';
import type { Profile } from '../../types/profile';
import interaulaLogo from '../../assets/branding/interaula-logo.png';
import ThemeModeMenu from './ThemeModeMenu';
import GlobalNavigationSearch from './GlobalNavigationSearch';
import InboxLink from './InboxLink';
import {
  ACCOUNT_MENU_ITEMS,
  MAIN_DESTINATIONS,
  isCategoryActive,
  type NavigationCategoryId,
} from '../../navigation/guidedNavigation';
import {
  BookOpenIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  CompassIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  MessageSquareIcon,
  SettingsIcon,
  SlidersIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '../common/Icons';

const CATEGORY_ICONS: Record<NavigationCategoryId, typeof BookOpenIcon> = {
  learn: BookOpenIcon,
  tutoring: UsersIcon,
  community: MessageSquareIcon,
  projects: BriefcaseIcon,
};

function renderAccountItemIcon(itemId: string) {
  switch (itemId) {
    case 'my-profile':
      return <UserIcon size={15} />;
    case 'learning-preferences':
      return <CompassIcon size={15} />;
    case 'sensory-accessibility':
      return <SlidersIcon size={15} />;
    case 'settings':
      return <SettingsIcon size={15} />;
    case 'notifications':
      return <MailIcon size={15} />;
    default:
      return <UserIcon size={15} />;
  }
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { isCalmMode, toggleCalmMode } = useCalmMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openCategory, setOpenCategory] = useState<NavigationCategoryId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
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
    let active = true;
    if (!user) {
      setUnreadMessages(0);
      return;
    }

    const loadUnread = () => {
      messagingService
        .getUnreadCount()
        .then((res) => {
          if (active) setUnreadMessages(res.unreadCount || 0);
        })
        .catch(() => {});
    };

    loadUnread();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadUnread();
    }, 45000);
    window.addEventListener('interaula:messages-change', loadUnread);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('interaula:messages-change', loadUnread);
    };
  }, [user?.id, location.pathname]);

  useEffect(() => {
    setOpenCategory(null);
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.key]);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) setMenuOpen(false);
      if (navRef.current && !navRef.current.contains(target)) setOpenCategory(null);
      if (headerRef.current && !headerRef.current.contains(target)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const displayName = profile?.display_name || profile?.first_name || user?.email?.split('@')[0] || 'Mi cuenta';
  const close = () => {
    setOpenCategory(null);
    setMenuOpen(false);
    setMobileOpen(false);
  };

  return (
    <header
      className="ia-navbar"
      ref={headerRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (openCategory) {
            setOpenCategory(null);
          } else if (menuOpen) {
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

        <nav className="ia-nav-links" ref={navRef} aria-label="Navegación principal">
          {MAIN_DESTINATIONS.map((category) => {
            const active = isCategoryActive(category, location.pathname, location.search);
            const isOpen = openCategory === category.id;
            const Icon = CATEGORY_ICONS[category.id];
            const showCommunityBadge = category.id === 'community' && unreadMessages > 0;

            return (
              <div key={category.id} className="ia-nav-category">
                <button
                  type="button"
                  className={`ia-nav-item ia-nav-category-btn ${active ? 'active' : ''}`}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  aria-controls={`ia-nav-menu-${category.id}`}
                  onClick={() => {
                    setOpenCategory((prev) => (prev === category.id ? null : category.id));
                    setMenuOpen(false);
                    setMobileOpen(false);
                  }}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{category.label}</span>
                  {showCommunityBadge && (
                    <span className="ia-nav-unread-dot" aria-label={`${unreadMessages} mensajes sin leer`}>
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                  <ChevronDownIcon
                    size={13}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.14s ease',
                      opacity: 0.72,
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    id={`ia-nav-menu-${category.id}`}
                    className="ia-nav-submenu"
                    role="menu"
                    aria-label={category.label}
                  >
                    {category.items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.href}
                        role="menuitem"
                        className="ia-nav-submenu-item"
                        onClick={close}
                      >
                        <span className="ia-nav-submenu-title">
                          {item.label}
                          {item.id === 'direct-messaging' && unreadMessages > 0 && (
                            <span className="ia-nav-unread-dot">
                              {unreadMessages > 99 ? '99+' : unreadMessages}
                            </span>
                          )}
                        </span>
                        <span className="ia-nav-submenu-desc">{item.description}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
                setOpenCategory(null);
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
              <div id="ia-account-menu" className="ia-dropdown-menu ia-dropdown-menu--wide">
                <div className="ia-dropdown-header">
                  <strong>{displayName}</strong>
                  {user?.email && <span className="ia-dropdown-sub">{user.email}</span>}
                </div>
                <div className="ia-dropdown-divider" />
                {ACCOUNT_MENU_ITEMS.map((item) => (
                  <Link key={item.id} to={item.href} className="ia-dropdown-item" onClick={close}>
                    {renderAccountItemIcon(item.id)}
                    <span>{item.label}</span>
                  </Link>
                ))}
                <div className="ia-dropdown-divider" />
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
              setOpenCategory(null);
              setMenuOpen(false);
            }}
          >
            {mobileOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="ia-mobile-navigation" className="ia-mobile-nav" aria-label="Navegación principal móvil">
          {MAIN_DESTINATIONS.map((category) => (
            <div key={category.id} className="ia-mobile-nav-group">
              <div className="ia-mobile-nav-label">{category.label}</div>
              {category.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className={`ia-mobile-nav-item ${
                    location.pathname + location.search === item.href ? 'active' : ''
                  }`}
                  onClick={close}
                >
                  <span>{item.label}</span>
                  {item.id === 'direct-messaging' && unreadMessages > 0 && (
                    <span className="ia-nav-unread-dot">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}

          <div className="ia-mobile-nav-group">
            <div className="ia-mobile-nav-label">Mi cuenta</div>
            {ACCOUNT_MENU_ITEMS.map((item) => (
              <Link key={item.id} to={item.href} className="ia-mobile-nav-item" onClick={close}>
                {renderAccountItemIcon(item.id)}
                <span>{item.label}</span>
              </Link>
            ))}
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
