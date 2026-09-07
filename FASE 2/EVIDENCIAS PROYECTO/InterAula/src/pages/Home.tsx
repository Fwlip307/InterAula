import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCapIcon } from '../components/common/Icons';

// Página de inicio o bienvenida de InterAula
export default function Home() {
  const { user } = useAuth();

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand-badge">
          <GraduationCapIcon size={16} />
          <span>Plataforma Universitaria</span>
        </div>

        <h1 className="auth-title">Bienvenido a InterAula</h1>
        <p className="auth-subtitle">
          Sistema de intercambio académico, mentorías y tutorías entre pares universitarios.
        </p>

        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>
              Has iniciado sesión como: <strong>{user.email}</strong>
            </p>
            <Link to="/dashboard" className="btn-auth-submit" style={{ textDecoration: 'none' }}>
              Ir al Dashboard
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/login" className="btn-auth-submit" style={{ textDecoration: 'none' }}>
              Iniciar sesión
            </Link>
            <Link to="/register" className="btn-auth-secondary">
              Crear cuenta nueva
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
