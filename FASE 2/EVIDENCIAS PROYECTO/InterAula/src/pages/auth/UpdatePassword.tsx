import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Medidor y validación de seguridad de contraseña
function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { score, label: 'Débil', color: '#ef4444' };
  if (score === 3 || score === 4) return { score, label: 'Aceptable', color: '#eab308' };
  return { score, label: 'Fuerte', color: '#16a34a' };
}

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-z]/.test(pwd)) return 'Debe incluir al menos una letra minúscula.';
  if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un carácter especial (@, #, !, etc.).';
  return null;
}

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

// Formulario de restablecimiento de contraseña en InterAula
export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ready, setReady] = useState(false);

  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  // Verifica que exista una sesión válida originada desde el enlace de recuperación
  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (mounted) setReady(true);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (mounted) {
        // Si no hay sesión tras varios intentos, redirige al login con advertencia
        navigate('/login', {
          replace: true,
          state: { message: 'El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo.' },
        });
      }
    };

    checkRecoverySession();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const pwdError = validatePassword(password);
    if (pwdError) {
      setErrorMsg(pwdError);
      return;
    }

    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Error al actualizar la contraseña.');
      return;
    }

    setSuccessMsg('¡Contraseña actualizada correctamente! Redirigiendo a tu cuenta...');

    // Redirige al dashboard o login tras actualizar la clave
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2000);
  };

  if (!ready) {
    return (
      <div className="auth-page-wrapper">
        <div className="auth-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="auth-spinner" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '0 0 6px 0' }}>
            Verificando enlace de recuperación...
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
            Por favor espera un momento mientras validamos tus credenciales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-brand-badge">
          🔒 Nueva Credencial
        </div>

        <h1 className="auth-title">Nueva contraseña</h1>
        <p className="auth-subtitle">
          Define una nueva contraseña segura para acceder a tu cuenta de InterAula.
        </p>

        <form onSubmit={handleUpdate}>
          {/* Nueva Contraseña */}
          <div className="form-group">
            <label htmlFor="new-password" className="form-label">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                style={{ paddingRight: '44px' }}
                autoComplete="new-password"
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

            {/* Medidor de fortaleza */}
            {strength && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '4px',
                        backgroundColor: i <= strength.score ? strength.color : '#e2e8f0',
                        transition: 'background-color 0.3s ease',
                      }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: strength.color, margin: 0, fontWeight: 600 }}>
                  Seguridad: {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirmar Contraseña */}
          <div className="form-group">
            <label htmlFor="confirm-new-password" className="form-label">Confirmar nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirm-new-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repite la nueva contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="form-input"
                style={{
                  paddingRight: '44px',
                  borderColor: confirm.length > 0 ? (confirm === password ? '#16a34a' : '#ef4444') : undefined,
                }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
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
                aria-label={showConfirm ? 'Ocultar confirmación' : 'Ver confirmación'}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {confirm.length > 0 && (
              <p style={{ fontSize: '12px', marginTop: '4px', color: confirm === password ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                {confirm === password ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
              </p>
            )}
          </div>

          {errorMsg && <div className="auth-error-alert">{errorMsg}</div>}
          {successMsg && <div className="auth-success-alert">{successMsg}</div>}

          <button
            type="submit"
            disabled={loading || successMsg !== ''}
            className="btn-auth-submit"
            style={{ marginTop: '16px' }}
          >
            {loading ? (
              <>
                <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>Guardando contraseña...</span>
              </>
            ) : (
              'Actualizar contraseña'
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <Link to="/login" className="auth-link">
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
