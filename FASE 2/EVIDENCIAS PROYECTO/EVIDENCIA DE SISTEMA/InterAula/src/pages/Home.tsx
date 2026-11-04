import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCalmMode } from '../context/CalmModeContext';
import { profileService } from '../services/profile.service';
import { projectService } from '../services/project.service';
import type { Subject } from '../types/profile';
import type { Project } from '../types/project';
import {
  GraduationCapIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  UsersIcon,
  SparklesIcon,
  CheckIcon,
  ArrowLeftIcon,
  CalendarIcon,
  BriefcaseIcon,
} from '../components/common/Icons';
import interaulaLogo from '../assets/branding/interaula-logo.png';
import '../styles/home.css';

export default function Home() {
  const { user } = useAuth();
  const { isCalmMode, toggleCalmMode } = useCalmMode();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [subs, projs] = await Promise.all([
          profileService.getSubjects().catch(() => []),
          projectService.getProjects().catch(() => []),
        ]);
        if (subs && subs.length > 0) {
          setSubjects(subs.slice(0, 8));
        }
        if (projs && projs.length > 0) {
          setFeaturedProjects(projs.filter((p) => p.status === 'open' || p.status === 'recruiting').slice(0, 3));
        }
      } catch (err) {
        console.error('[Home] Error cargando catálogo:', err);
      }
    }
    loadCatalog();
  }, []);

  return (
    <div className="ia-landing">
      {/* HEADER / BARRA DE NAVEGACIÓN SUPERIOR */}
      <header className="ia-landing-header">
        <div className="ia-landing-header-inner">
          <Link to="/" className="ia-landing-brand">
            <img
              src={interaulaLogo}
              alt="Logo InterAula"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
            <span className="ia-landing-brand-name">InterAula</span>
          </Link>

          <nav className="ia-landing-nav" aria-label="Navegación de portada">
            <a href="#pilares" className="ia-landing-nav-link">
              Pilares Inclusivos
            </a>
            <a href="#materias" className="ia-landing-nav-link">
              Tutorías y Materias
            </a>
            <a href="#proyectos" className="ia-landing-nav-link">
              Hub de Proyectos
            </a>
            <a href="#como-funciona" className="ia-landing-nav-link">
              ¿Cómo funciona?
            </a>
          </nav>

          <div className="ia-landing-auth-btns" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={toggleCalmMode}
              aria-pressed={isCalmMode}
              title={isCalmMode ? 'Desactivar Modo Calma' : 'Activar Modo Calma (Bajo estímulo visual)'}
              style={{
                padding: '6px 12px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: `1.5px solid ${isCalmMode ? '#475569' : '#cbd5e1'}`,
                backgroundColor: isCalmMode ? '#334155' : '#f8fafc',
                color: isCalmMode ? '#ffffff' : '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{isCalmMode ? '🧘 Modo Calma Activo' : '🧘 Modo Calma'}</span>
            </button>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {user.email}
                </span>
                <Link to="/dashboard" className="ia-landing-btn-primary">
                  <span>Ir a mi Portal</span>
                  <ArrowLeftIcon size={16} color="#ffffff" style={{ transform: 'rotate(180deg)' }} />
                </Link>
              </div>
            ) : (
              <>
                <Link to="/login" className="ia-landing-btn-login">
                  Iniciar sesión
                </Link>
                <Link to="/register" className="ia-landing-btn-primary">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="ia-landing-hero">
        <div className="ia-landing-hero-inner">
          <div className="ia-landing-badge">
            <GraduationCapIcon size={16} color="#1e40af" />
            <span>InterAula: Aprender juntos, a nuestra manera</span>
          </div>

          <h1 className="ia-landing-title">
            Aprendizaje colaborativo, accesible e{' '}
            <span className="ia-landing-title-highlight">interdisciplinario entre pares</span>
          </h1>

          <p className="ia-landing-desc">
            Recibe apoyo en las asignaturas que necesitas reforzar, enseña las materias que dominas,
            personaliza la interfaz a tu ritmo de estudio y forma equipos en el Hub de Proyectos Interdisciplinarios.
          </p>

          <div className="ia-landing-hero-actions">
            {user ? (
              <Link to="/dashboard" className="ia-landing-btn-primary" style={{ padding: '12px 26px', fontSize: '1rem' }}>
                <GraduationCapIcon size={20} color="#ffffff" />
                <span>Entrar a mi Portal de Inicio</span>
              </Link>
            ) : (
              <>
                <Link to="/register" className="ia-landing-btn-primary" style={{ padding: '12px 26px', fontSize: '1rem' }}>
                  <span>Comenzar ahora gratis</span>
                  <ArrowLeftIcon size={18} color="#ffffff" style={{ transform: 'rotate(180deg)' }} />
                </Link>
                <Link to="/login" className="ia-landing-btn-outline" style={{ padding: '12px 22px', fontSize: '1rem' }}>
                  <span>Ya tengo una cuenta</span>
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => navigate('/tutoring')}
              className="ia-landing-btn-outline"
              style={{ padding: '12px 22px', fontSize: '1rem', cursor: 'pointer' }}
            >
              <BookOpenIcon size={18} color="#2563eb" />
              <span>Solicitar u ofrecer tutoría</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="ia-landing-btn-outline"
              style={{ padding: '12px 22px', fontSize: '1rem', cursor: 'pointer' }}
            >
              <BriefcaseIcon size={18} color="#7c3aed" />
              <span>Explorar Hub de Proyectos</span>
            </button>
          </div>

          <div className="ia-landing-trust-bar">
            <div className="ia-landing-trust-item">
              <UsersIcon size={18} color="#2563eb" />
              <span>1. Aprendizaje colaborativo entre pares</span>
            </div>
            <div className="ia-landing-trust-item">
              <SparklesIcon size={18} color="#16a34a" />
              <span>2. Inclusión y accesibilidad transversal (WCAG 2.2 AA)</span>
            </div>
            <div className="ia-landing-trust-item">
              <BriefcaseIcon size={18} color="#7c3aed" />
              <span>3. Colaboración en proyectos interdisciplinarios</span>
            </div>
          </div>
        </div>
      </section>

      {/* PILARES / BENEFICIOS DE LA PLATAFORMA */}
      <section id="pilares" className="ia-landing-section">
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">Nuestros 3 Pilares</div>
          <h2 className="ia-landing-section-title">InterAula: Aprender juntos, a nuestra manera</h2>
          <p className="ia-landing-section-desc">
            Un entorno académico diseñado para que cada estudiante aprenda con comodidad, claridad y colaboración real.
          </p>
        </div>

        <div className="ia-pillars-grid">
          {/* Pilar 1 */}
          <div className="ia-pillar-card">
            <div className="ia-pillar-icon blue">
              <UsersIcon size={26} color="#2563eb" />
            </div>
            <h3 className="ia-pillar-title">1. Aprendizaje Colaborativo</h3>
            <p className="ia-pillar-desc">
              El corazón de InterAula son las tutorías entre pares: un mismo estudiante puede pedir apoyo en una materia y enseñar otra que domina.
            </p>
            <ul className="ia-pillar-feature-list">
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Tutores Pares Verificados y Apoyo Académico entre Pares</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Solicitudes con preferencias pedagógicas y de comunicación</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Biblioteca de apuntes, foro académico y quizzes adaptativos</span>
              </li>
            </ul>
          </div>

          {/* Pilar 2 */}
          <div className="ia-pillar-card">
            <div className="ia-pillar-icon green">
              <ShieldCheckIcon size={26} color="#16a34a" />
            </div>
            <h3 className="ia-pillar-title">2. Inclusión y Accesibilidad Transversal</h3>
            <p className="ia-pillar-desc">
              Cada persona aprende distinto. La plataforma se adapta a tus preferencias visuales, sensoriales y pedagógicas sin etiquetas públicas.
            </p>
            <ul className="ia-pillar-feature-list">
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Modo Calma, alto contraste, tamaño de fuente y espaciado</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Cuestionarios sin límite de tiempo y pistas paso a paso</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Preferencias de aprendizaje 100% privadas y voluntarias</span>
              </li>
            </ul>
          </div>

          {/* Pilar 3 */}
          <div className="ia-pillar-card">
            <div className="ia-pillar-icon purple">
              <BriefcaseIcon size={26} color="#7c3aed" />
            </div>
            <h3 className="ia-pillar-title">3. Colaboración Interdisciplinaria</h3>
            <p className="ia-pillar-desc">
              Conecta con estudiantes de distintas carreras y especialidades para construir proyectos reales, portafolio e iniciativas de innovación.
            </p>
            <ul className="ia-pillar-feature-list">
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Publicación de roles, vacantes y habilidades requeridas</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Condiciones transparentes (voluntarias, académicas o declaradas)</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Postulación auditable y gestión de equipo e hitos</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* MATERIAS DESTACADAS */}
      <section id="materias" className="ia-landing-section" style={{ paddingBottom: '30px' }}>
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">Catálogo formativo</div>
          <h2 className="ia-landing-section-title">Asignaturas disponibles para tutorías</h2>
          <p className="ia-landing-section-desc">
            Encuentra apoyo en los ramos más desafiantes o comparte tu experiencia en las asignaturas que ya dominas.
          </p>
        </div>

        <div className="ia-subjects-cloud">
          {subjects.length > 0 ? (
            subjects.map((sub) => (
              <Link
                key={sub.id}
                to={user ? `/tutoring?subjectId=${sub.id}` : `/login?redirect=/tutoring`}
                className="ia-subject-chip"
              >
                <BookOpenIcon size={16} color="#2563eb" />
                <span>{sub.name}</span>
              </Link>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Explora el catálogo completo de asignaturas dentro de la plataforma.
            </div>
          )}
        </div>
      </section>

      {/* PROYECTOS INTERDISCIPLINARIOS ABIERTOS */}
      <section id="proyectos" className="ia-landing-section" style={{ paddingTop: '10px', paddingBottom: '40px' }}>
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">Hub de Proyectos Interdisciplinarios</div>
          <h2 className="ia-landing-section-title">Proyectos buscando colaboradores</h2>
          <p className="ia-landing-section-desc">
            Únete a iniciativas estudiantiles de distintas áreas o publica tu propio proyecto con roles y acuerdos claros.
          </p>
        </div>

        {featuredProjects.length > 0 ? (
          <div className="ia-pillars-grid">
            {featuredProjects.map((proj) => (
              <div key={proj.id} className="ia-pillar-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#6d28d9',
                      backgroundColor: '#f3e8ff',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      marginBottom: '10px',
                    }}
                  >
                    {proj.category || 'Proyecto Colaborativo'}
                  </span>
                  <h3 className="ia-pillar-title" style={{ marginBottom: '6px' }}>{proj.title}</h3>
                  <p className="ia-pillar-desc" style={{ marginBottom: '12px' }}>
                    {proj.short_description || proj.description}
                  </p>
                </div>
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {(proj.positions || []).slice(0, 3).map((pos) => (
                      <span
                        key={pos.id}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                        }}
                      >
                        Vacante: {pos.title}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={user ? '/projects' : '/login?redirect=/projects'}
                    className="ia-landing-btn-outline"
                    style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
                  >
                    Ver vacantes y condiciones
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 12px 0', color: '#475569', fontSize: '0.95rem' }}>
              ¿Tienes una idea de aplicación, investigación, diseño o emprendimiento académico?
            </p>
            <Link to={user ? '/projects' : '/register'} className="ia-landing-btn-primary" style={{ textDecoration: 'none' }}>
              Publicar el primer proyecto en el Hub
            </Link>
          </div>
        )}
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="ia-landing-section" style={{ backgroundColor: '#f8fafc', borderRadius: '24px', margin: '20px auto' }}>
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">Paso a paso</div>
          <h2 className="ia-landing-section-title">¿Cómo participar en InterAula?</h2>
          <p className="ia-landing-section-desc">
            Un flujo claro y predecible para aprender, enseñar y colaborar en equipo.
          </p>
        </div>

        <div className="ia-steps-grid">
          <div className="ia-step-card">
            <div className="ia-step-number">1</div>
            <h3 className="ia-step-title">Personaliza tu experiencia</h3>
            <p className="ia-step-desc">
              Crea tu cuenta, selecciona tu carrera y ajusta tus preferencias de lectura, Modo Calma y estilo de aprendizaje privado.
            </p>
          </div>

          <div className="ia-step-card">
            <div className="ia-step-number">2</div>
            <h3 className="ia-step-title">Solicita u ofrece tutorías</h3>
            <p className="ia-step-desc">
              Coordina sesiones 1 a 1 indicando cómo te resulta más cómodo aprender, o comparte tus conocimientos con otros compañeros.
            </p>
          </div>

          <div className="ia-step-card">
            <div className="ia-step-number">3</div>
            <h3 className="ia-step-title">Colabora en proyectos y recursos</h3>
            <p className="ia-step-desc">
              Descarga apuntes, practica con cuestionarios sin estrés y postula a roles en el Hub de Proyectos Interdisciplinarios.
            </p>
          </div>
        </div>
      </section>

      {/* LLAMADO A LA ACCIÓN FINAL */}
      <div className="ia-landing-section">
        <div className="ia-cta-banner">
          <h2>InterAula: Aprender juntos, a nuestra manera</h2>
          <p>
            Únete a la comunidad académica colaborativa, accesible e interdisciplinaria.
          </p>
          {user ? (
            <Link to="/dashboard" className="ia-cta-banner-btn">
              <CalendarIcon size={18} color="#1e3a8a" />
              <span>Ir a mi Portal de Inicio</span>
            </Link>
          ) : (
            <Link to="/register" className="ia-cta-banner-btn">
              <GraduationCapIcon size={18} color="#1e3a8a" />
              <span>Crear cuenta gratuita</span>
            </Link>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="ia-landing-footer">
        <div className="ia-landing-footer-inner">
          <div className="ia-landing-footer-brand">
            <img
              src={interaulaLogo}
              alt="InterAula"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
            />
            <span>InterAula</span>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <Link to={user ? '/dashboard' : '/login'} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}>
              {user ? 'Mi Portal' : 'Iniciar sesión'}
            </Link>
            <Link to="/tutoring" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}>
              Tutorías y Retos
            </Link>
            <Link to="/projects" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}>
              Hub de Proyectos
            </Link>
            <Link to="/resources" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}>
              Biblioteca de Apuntes
            </Link>
          </div>
        </div>

        <div className="ia-landing-footer-copy">
          © {new Date().getFullYear()} InterAula · Aprender juntos, a nuestra manera · Plataforma Académica Colaborativa, Inclusiva e Interdisciplinaria.
        </div>
      </footer>
    </div>
  );
}
