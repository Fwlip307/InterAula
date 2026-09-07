import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

import { KeyIcon } from '../../components/common/Icons';

// Recuperación de contraseña mediante Supabase Auth para InterAula
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    const normalizedEmail = email.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!isValidEmail) {
      setErrorMsg('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      setLoading(false);

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setErrorMsg('Has realizado varias solicitudes recientemente. Por favor espera unos minutos antes de intentar de nuevo.');
        } else {
          setErrorMsg(error.message || 'No pudimos procesar la solicitud de recuperación.');
        }
        return;
      }

      setEmailSent(true);
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      setErrorMsg(msg);
    }
  };

  const handleResetForm = () => {
    setEmailSent(false);
    setEmail('');
    setErrorMsg('');
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-brand-badge">
          <KeyIcon size={16} />
          <span>Seguridad</span>
        </div>

        <h1 className="auth-title">Recuperar contraseña</h1>
        <p className="auth-subtitle">
          Ingresa tu correo institucional o personal para recibir un enlace seguro de restablecimiento.
        </p>

        {emailSent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                border: '2px solid #bbf7d0',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '18px', fontWeight: 700 }}>
              ¡Enlace enviado con éxito!
            </h3>

            <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5, marginBottom: '20px' }}>
              Hemos enviado las instrucciones para restablecer tu clave a <strong>{email}</strong>. Revisa tu bandeja de entrada o la carpeta de spam.
            </p>

            <button
              type="button"
              onClick={handleResetForm}
              className="btn-auth-secondary"
              style={{ marginBottom: '12px' }}
            >
              Enviar a otro correo
            </button>

            <div>
              <Link to="/login" className="auth-link" style={{ fontSize: '14px' }}>
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label htmlFor="reset-email" className="form-label">Correo electrónico</label>
              <input
                id="reset-email"
                type="email"
                placeholder="tu.correo@universidad.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                autoComplete="email"
              />
            </div>

            {errorMsg && <div className="auth-error-alert">{errorMsg}</div>}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn-auth-submit"
              style={{ marginTop: '16px' }}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Enviando enlace...</span>
                </>
              ) : (
                'Enviar enlace de recuperación'
              )}
            </button>

            <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <Link to="/login" className="auth-link">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
