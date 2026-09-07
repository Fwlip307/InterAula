import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Dashboard de prueba para verificar autenticación y rutas protegidas en InterAula
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              IA
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>InterAula</h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Plataforma de Intercambio Académico y Tutorías
              </p>
            </div>
          </div>

          <span className="dashboard-badge">
            ✓ Sesión iniciada correctamente
          </span>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
            USUARIO AUTENTICADO:
          </p>
          <p style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
            {user?.email || 'Sin correo asociado'}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            ID de usuario: {user?.id}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSignOut}
            className="btn-auth-secondary"
            style={{ width: 'auto', padding: '10px 24px', color: '#dc2626', borderColor: '#fca5a5' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
