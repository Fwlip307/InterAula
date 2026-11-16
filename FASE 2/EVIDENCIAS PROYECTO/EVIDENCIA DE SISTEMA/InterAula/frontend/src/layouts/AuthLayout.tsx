import { Link, Outlet } from 'react-router-dom';

// Layout que envuelve las páginas de autenticación de InterAula
export default function AuthLayout() {
  return (
    <div className="auth-layout-root">
      <header className="auth-header">
        <Link to="/" className="auth-header-brand" title="Volver al inicio de InterAula">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
          <span className="auth-brand-logo-text">InterAula</span>
        </Link>

        <nav className="auth-header-nav">
          <Link to="/" className="auth-nav-link">Inicio</Link>
          <Link to="/login" className="auth-nav-link">Ingresar</Link>
          <Link to="/register" className="auth-nav-link">Registro</Link>
        </nav>
      </header>

      <main className="auth-layout-body">
        <Outlet />
      </main>
    </div>
  );
}
