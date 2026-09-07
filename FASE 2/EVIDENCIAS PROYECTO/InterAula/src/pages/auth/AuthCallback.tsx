import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Maneja los retornos de confirmación de correo electrónico y recuperación de contraseña en InterAula
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let handled = false;

    // Detecta si la URL corresponde a un flujo de recuperación de contraseña
    const isRecovery = window.location.href.includes('type=recovery');

    const handleSuccess = (event: string) => {
      if (!mounted || handled) return;
      handled = true;

      if (event === 'PASSWORD_RECOVERY' || isRecovery) {
        navigate('/update-password', { replace: true });
        return;
      }

      // Redirige al dashboard tras confirmar email o iniciar sesión exitosamente
      navigate('/dashboard', { replace: true });
    };

    // Escucha el evento de autenticación emitido por Supabase al procesar el hash/token
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || handled) return;

      if (event === 'PASSWORD_RECOVERY') {
        handleSuccess(event);
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        handleSuccess(event);
      }
    });

    // Verificación de respaldo (polling) en caso de que onAuthStateChange ya haya disparado antes del montaje
    const checkSession = async (attempt = 1) => {
      if (!mounted || handled) return;

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        handleSuccess('SESSION_FOUND');
        return;
      }

      if (attempt < 8) {
        setTimeout(() => checkSession(attempt + 1), 400);
      } else if (!handled && mounted) {
        // Si no se obtuvo sesión tras varios intentos, redirigir al login
        navigate('/login', {
          replace: true,
          state: { message: 'No se pudo verificar la sesión o el enlace ha caducado. Inicia sesión.' },
        });
      }
    };

    // Inicia verificación tras breve espera para permitir que el cliente Supabase lea el fragmento de la URL
    setTimeout(() => checkSession(1), 500);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div className="auth-spinner" style={{ margin: '0 auto 20px auto', width: '32px', height: '32px' }} />
        <h2 className="auth-title" style={{ fontSize: '1.35rem', marginBottom: '8px' }}>
          Validando autenticación
        </h2>
        <p className="auth-subtitle" style={{ margin: 0 }}>
          Estamos confirmando tus credenciales de acceso a InterAula...
        </p>
      </div>
    </div>
  );
}
