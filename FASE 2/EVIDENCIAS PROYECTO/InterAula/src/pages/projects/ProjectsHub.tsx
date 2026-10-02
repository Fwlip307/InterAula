import { Link } from 'react-router-dom';
import {
  BriefcaseIcon,
  CodeIcon,
  UsersIcon,
  SparklesIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';

export default function ProjectsHub() {
  return (
    <div>
      {/* Cabecera Académica del Hub de Proyectos */}
      <div className="ia-page-header">
        <div>
          <h1 className="ia-page-title">Hub de Proyectos</h1>
          <p className="ia-page-subtitle">
            Espacio de colaboración académica y proyectos multidisciplinarios entre estudiantes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/profile/edit" className="ia-btn-primary">
            Configurar mis habilidades
          </Link>
        </div>
      </div>

      {/* Tarjetas Informativas de la Arquitectura del Hub */}
      <div className="ia-stats-grid">
        <div className="ia-stat-card">
          <div className="ia-stat-icon blue">
            <BriefcaseIcon size={22} color="#2563eb" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.1rem' }}>Proyectos Reales</div>
            <div className="ia-stat-label">Iniciativas creadas por estudiantes</div>
          </div>
        </div>

        <div className="ia-stat-card">
          <div className="ia-stat-icon amber">
            <CodeIcon size={22} color="#d97706" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.1rem' }}>Vacantes por Perfil</div>
            <div className="ia-stat-label">Frontend, Backend, UX, Datos</div>
          </div>
        </div>

        <div className="ia-stat-card">
          <div className="ia-stat-icon green">
            <UsersIcon size={22} color="#16a34a" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.1rem' }}>Equipos Ágiles</div>
            <div className="ia-stat-label">Postulaciones transparentes</div>
          </div>
        </div>

        <div className="ia-stat-card">
          <div className="ia-stat-icon purple">
            <SparklesIcon size={22} color="#9333ea" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.1rem' }}>Portafolio</div>
            <div className="ia-stat-label">Experiencia práctica verificable</div>
          </div>
        </div>
      </div>

      {/* Estado del Módulo */}
      <div className="ia-card">
        <EmptyState
          style={{ padding: '50px 20px' }}
          icon={<BriefcaseIcon size={32} color="#2563eb" />}
          title="El Hub de Proyectos está en construcción activa"
          description="Las tablas y modelos de seguridad (proyectos, vacantes, membresías y postulaciones protegidas) ya se encuentran desplegadas en Supabase. La interfaz de gestión y postulación de proyectos se activará en el siguiente Sprint."
          action={
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
              <Link to="/profile" className="ia-btn-secondary">
                Ver mi perfil actual
              </Link>
              <Link to="/dashboard" className="ia-btn-primary">
                Volver al panel
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
