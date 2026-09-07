import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  SettingsIcon,
  ShieldCheckIcon,
  LockIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '../../components/common/Icons';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/dashboard" className="ia-btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeftIcon size={16} /> Volver
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Configuración de la Cuenta
          </h1>
        </div>
      </div>

      <div className="ia-card">
        <h2 className="ia-card-title" style={{ marginBottom: '16px' }}>
          <ShieldCheckIcon size={20} color="#16a34a" /> Seguridad y Autenticación
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
          <div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Correo electrónico registrado
            </span>
            <input
              type="text"
              className="ia-input"
              value={user?.email || ''}
              disabled
            />
          </div>

          <div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Contraseña
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="password"
                className="ia-input"
                value="••••••••••••"
                disabled
              />
              <Link to="/update-password" className="ia-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                <LockIcon size={16} /> Cambiar
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="ia-card">
        <h2 className="ia-card-title" style={{ marginBottom: '16px' }}>
          <SettingsIcon size={20} color="#2563eb" /> Preferencias y Notificaciones
        </h2>
        <div className="ia-empty-box" style={{ padding: '30px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: '#eff6ff', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', marginBottom: '8px' }}>
            <SparklesIcon size={14} color="#2563eb" /> Módulo en desarrollo
          </div>
          <p className="ia-empty-desc" style={{ margin: 0 }}>
            Próximamente podrás configurar notificaciones por correo de solicitudes de tutorías y postulaciones a proyectos.
          </p>
        </div>
      </div>
    </div>
  );
}
