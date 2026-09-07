import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Iconos para alternar visibilidad de contraseña
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Icono vectorial oficial de Google
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

import { GraduationCapIcon } from '../../components/common/Icons';

// Inicio de sesión con correo/contraseña y Google OAuth en InterAula
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { from?: string; message?: string } | null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed') || error.message.includes('confirm')) {
        setErrorMsg('Debes confirmar tu correo electrónico antes de iniciar sesión. Por favor, revisa tu bandeja de entrada o spam.');
      } else if (error.message.includes('Invalid login credentials')) {
        setErrorMsg('Correo o contraseña incorrectos.');
      } else {
        setErrorMsg(error.message || 'Error al iniciar sesión. Inténtalo de nuevo.');
      }
      return;
    }

    // Redirige al dashboard o a la ruta previa solicitada
    navigate(routeState?.from ?? '/dashboard', { replace: true });
  };

  // Autenticación con Google OAuth
  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMsg(error.message || 'Ocurrió un error al intentar conectar con Google.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-brand-badge">
          <GraduationCapIcon size={16} />
          <span>Portal Académico</span>
        </div>

        <h1 className="auth-title">Iniciar sesión</h1>
        <p className="auth-subtitle">
          Ingresa a tu cuenta de InterAula para acceder a tutorías e intercambios académicos.
        </p>

        {routeState?.message && <div className="auth-info-alert">{routeState.message}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              placeholder="tu.correo@universidad.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              autoComplete="email"
              disabled={loading || googleLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                style={{ paddingRight: '44px' }}
                autoComplete="current-password"
                disabled={loading || googleLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: '16px' }}>
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: '13px' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {errorMsg && <div className="auth-error-alert">{errorMsg}</div>}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn-auth-submit"
            style={{ marginTop: '12px' }}
          >
            {loading ? (
              <>
                <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>Ingresando...</span>
              </>
            ) : (
              'Ingresar a InterAula'
            )}
          </button>
        </form>

        {/* Separador visual */}
        <div className="auth-divider">
          <span>o continuar con</span>
        </div>

        {/* Botón Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="btn-auth-google"
        >
          {googleLoading ? (
            <>
              <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Conectando con Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>Continuar con Google</span>
            </>
          )}
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            ¿Aún no tienes cuenta?{' '}
            <Link to="/register" className="auth-link">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
