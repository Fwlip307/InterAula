import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un símbolo o carácter especial (@, #, !, etc.).';
  return null;
}

// Iconos para visibilidad de contraseña
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

// Registro de usuarios con Supabase Auth en InterAula
export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const pwdError = validatePassword(password);
    if (pwdError) {
      setErrorMsg(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (!acceptTerms) {
      setErrorMsg('Debes aceptar las normas de uso y convivencia académica de InterAula para registrarte.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Ocurrió un error al intentar crear la cuenta.');
      return;
    }

    // Detección de usuario existente cuando Supabase tiene habilitada confirmación de correo
    if (data?.user?.identities && data.user.identities.length === 0) {
      setErrorMsg('Este correo ya se encuentra registrado en InterAula. Por favor, inicia sesión.');
      return;
    }

    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAcceptTerms(false);

    setSuccessMsg(
      '¡Registro exitoso! Te hemos enviado un enlace de confirmación a tu correo electrónico. Por favor revisa tu bandeja de entrada o spam para activar tu cuenta.'
    );
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-brand-badge">
          🎓 Nueva Cuenta
        </div>

        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">
          Únete a InterAula para participar en tutorías y grupos de estudio académicos.
        </p>

        <form onSubmit={handleRegister}>
          {/* Correo */}
          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">Correo electrónico institucional o personal</label>
            <input
              id="reg-email"
              type="email"
              placeholder="alumno@universidad.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              autoComplete="email"
            />
          </div>

          {/* Contraseña */}
          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-password"
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

            {/* Barra de seguridad */}
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
            <label htmlFor="reg-confirm" className="form-label">Confirmar contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="form-input"
                style={{
                  paddingRight: '44px',
                  borderColor: confirmPassword.length > 0 ? (confirmPassword === password ? '#16a34a' : '#ef4444') : undefined,
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
            {confirmPassword.length > 0 && (
              <p style={{ fontSize: '12px', marginTop: '4px', color: confirmPassword === password ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                {confirmPassword === password ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
              </p>
            )}
          </div>

          {/* Aceptación de términos académicos */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', margin: '14px 0', fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              required
              style={{ marginTop: '2px', accentColor: '#2563eb' }}
            />
            <span>
              Acepto las normas de uso, integridad académica y privacidad de la plataforma InterAula.
            </span>
          </label>

          {errorMsg && <div className="auth-error-alert">{errorMsg}</div>}
          {successMsg && <div className="auth-success-alert">{successMsg}</div>}

          <button
            type="submit"
            disabled={loading || successMsg !== '' || !acceptTerms}
            className="btn-auth-submit"
            style={{ marginTop: '12px' }}
          >
            {loading ? (
              <>
                <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>Registrando cuenta...</span>
              </>
            ) : (
              'Crear cuenta en InterAula'
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="auth-link">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
