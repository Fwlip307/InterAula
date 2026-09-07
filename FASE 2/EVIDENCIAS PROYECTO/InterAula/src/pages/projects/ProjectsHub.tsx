import { Link } from 'react-router-dom';
import {
  BriefcaseIcon,
  CodeIcon,
  UsersIcon,
  SparklesIcon,
  ArrowLeftIcon,
  EditIcon,
} from '../../components/common/Icons';

export default function ProjectsHub() {
  return (
    <div>
      {/* Hero Banner del Hub de Proyectos */}
      <section className="ia-hero-banner" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)' }}>
        <div className="ia-hero-text">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
            <SparklesIcon size={14} color="#fde047" /> Módulo en desarrollo (Sprint 2)
          </div>
          <h1>Hub de Proyectos InterAula</h1>
          <p>
            Encuentra proyectos, aporta tus habilidades y forma equipos multidisciplinarios con estudiantes de distintas carreras y facultades.
          </p>
        </div>
        <div className="ia-hero-actions">
          <Link to="/profile/edit" className="ia-btn-hero-primary">
            <EditIcon size={16} /> Configurar mis habilidades
          </Link>
        </div>
      </section>

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
        <div className="ia-empty-box" style={{ padding: '50px 20px' }}>
          <div className="ia-empty-icon" style={{ width: '64px', height: '64px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <BriefcaseIcon size={32} />
          </div>
          <h2 className="ia-empty-title" style={{ fontSize: '1.3rem' }}>
            El Hub de Proyectos está en construcción activa
          </h2>
          <p className="ia-empty-desc" style={{ maxWidth: '540px' }}>
            Las tablas y modelos de seguridad (proyectos, vacantes, membresías y postulaciones protegidas) ya se encuentran desplegadas en Supabase. La interfaz de gestión y postulación de proyectos se activará en el siguiente Sprint.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
            <Link to="/profile" className="ia-btn-secondary">
              Ver mi perfil actual
            </Link>
            <Link to="/dashboard" className="ia-btn-primary">
              <ArrowLeftIcon size={16} /> Volver al panel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
