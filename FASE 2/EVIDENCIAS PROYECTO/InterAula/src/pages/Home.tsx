import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profile.service';
import type { Subject } from '../types/profile';
import {
  GraduationCapIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  UsersIcon,
  SparklesIcon,
  CheckIcon,
  ArrowLeftIcon,
  CalendarIcon,
} from '../components/common/Icons';
import interaulaLogo from '../assets/branding/interaula-logo.png';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const subs = await profileService.getSubjects();
        if (subs && subs.length > 0) {
          setSubjects(subs.slice(0, 8));
        }
      } catch (err) {
        console.error('[Home] Error cargando asignaturas:', err);
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

          <nav className="ia-landing-nav">
            <a href="#como-funciona" className="ia-landing-nav-link">
              ¿Cómo funciona?
            </a>
            <a href="#materias" className="ia-landing-nav-link">
              Materias
            </a>
            <a href="#pilares" className="ia-landing-nav-link">
              Beneficios
            </a>
          </nav>

          <div className="ia-landing-auth-btns">
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
            <span>Red Académica de Tutorías Universitarias</span>
          </div>

          <h1 className="ia-landing-title">
            Aprende y supera tus asignaturas con{' '}
            <span className="ia-landing-title-highlight">tutores de tu propia carrera</span>
          </h1>

          <p className="ia-landing-desc">
            InterAula conecta a estudiantes de educación superior para preparar evaluaciones, resolver dudas
            y certificar conocimientos mediante mentorías entre pares y validación académica rigurosa.
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
              <span>Explorar asignaturas</span>
            </button>
          </div>

          <div className="ia-landing-trust-bar">
            <div className="ia-landing-trust-item">
              <ShieldCheckIcon size={18} color="#16a34a" />
              <span>Certificados de notas oficiales Duoc UC</span>
            </div>
            <div className="ia-landing-trust-item">
              <SparklesIcon size={18} color="#7c3aed" />
              <span>Evaluación técnica con IA para tutores</span>
            </div>
            <div className="ia-landing-trust-item">
              <UsersIcon size={18} color="#2563eb" />
              <span>Comunidad 100% entre pares universitarios</span>
            </div>
          </div>
        </div>
      </section>

      {/* MATERIAS DESTACADAS */}
      <section id="materias" className="ia-landing-section" style={{ paddingBottom: '40px' }}>
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">Catálogo formativo</div>
          <h2 className="ia-landing-section-title">Asignaturas disponibles</h2>
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
              Cargando asignaturas disponibles...
            </div>
          )}
        </div>
      </section>

      {/* PILARES / BENEFICIOS */}
      <section id="pilares" className="ia-landing-section">
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">¿Por qué InterAula?</div>
          <h2 className="ia-landing-section-title">Construido para el éxito académico</h2>
          <p className="ia-landing-section-desc">
            Una plataforma orientada a resultados reales, sin intermediarios externos y diseñada para la comunidad universitaria.
          </p>
        </div>

        <div className="ia-pillars-grid">
          {/* Pilar 1 */}
          <div className="ia-pillar-card">
            <div className="ia-pillar-icon blue">
              <UsersIcon size={26} color="#2563eb" />
            </div>
            <h3 className="ia-pillar-title">Tutorías 1 a 1 y Talleres</h3>
            <p className="ia-pillar-desc">
              Aprende de estudiantes que ya cursaron y aprobaron con éxito tus asignaturas con metodologías cercanas y prácticas.
            </p>
            <ul className="ia-pillar-feature-list">
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Sesiones personalizadas a tu propio ritmo</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Talleres grupales antes de certámenes</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Flexibilidad de horarios según tu malla</span>
              </li>
            </ul>
          </div>

          {/* Pilar 2 */}
          <div className="ia-pillar-card">
            <div className="ia-pillar-icon green">
              <ShieldCheckIcon size={26} color="#16a34a" />
            </div>
            <h3 className="ia-pillar-title">Validación Rigurosa de Tutores</h3>
            <p className="ia-pillar-desc">
              Garantizamos la idoneidad académica revisando certificados oficiales de notas y evaluando conocimientos con IA.
            </p>
            <ul className="ia-pillar-feature-list">
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Verificación de certificados PDF de notas</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Evaluación técnica de dominio conceptual</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Insignias de acreditación visibles</span>
              </li>
            </ul>
          </div>

          {/* Pilar 3 */}
          <div className="ia-pillar-card">
            <div className="ia-pillar-icon purple">
              <SparklesIcon size={26} color="#7c3aed" />
            </div>
            <h3 className="ia-pillar-title">Aula Virtual y Recursos</h3>
            <p className="ia-pillar-desc">
              Espacio integral para estudiar: salas virtuales con pizarra colaborativa, banco de guías y resúmenes compartidos.
            </p>
            <ul className="ia-pillar-feature-list">
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Salas virtuales sin necesidad de instalar software</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Banco colaborativo de apuntes y ejercicios</span>
              </li>
              <li className="ia-pillar-feature-item">
                <CheckIcon size={16} color="#16a34a" />
                <span>Flashcards y quizzes de autoevaluación</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="ia-landing-section" style={{ backgroundColor: '#f8fafc', borderRadius: '24px', margin: '20px auto' }}>
        <div className="ia-landing-section-header">
          <div className="ia-landing-section-tag">Paso a paso</div>
          <h2 className="ia-landing-section-title">¿Cómo funciona InterAula?</h2>
          <p className="ia-landing-section-desc">
            Comenzar es simple y toma solo un par de minutos para encontrar el apoyo que necesitas.
          </p>
        </div>

        <div className="ia-steps-grid">
          <div className="ia-step-card">
            <div className="ia-step-number">1</div>
            <h3 className="ia-step-title">Crea tu cuenta institucional</h3>
            <p className="ia-step-desc">
              Regístrate con tu correo y selecciona tu institución, carrera y sede para acceder a la red de tu comunidad.
            </p>
          </div>

          <div className="ia-step-card">
            <div className="ia-step-number">2</div>
            <h3 className="ia-step-title">Busca tu tutor o materia</h3>
            <p className="ia-step-desc">
              Filtra por asignatura, consulta el perfil de tutores acreditados y agenda una sesión según tus horarios.
            </p>
          </div>

          <div className="ia-step-card">
            <div className="ia-step-number">3</div>
            <h3 className="ia-step-title">Aprende y aprueba tus ramos</h3>
            <p className="ia-step-desc">
              Conéctate a la sesión en vivo, aclara tus dudas con explicaciones claras y evalúa a tu tutor al finalizar.
            </p>
          </div>
        </div>
      </section>

      {/* LLAMADO A LA ACCIÓN FINAL */}
      <div className="ia-landing-section">
        <div className="ia-cta-banner">
          <h2>¿Listo para mejorar tu rendimiento académico?</h2>
          <p>
            Únete a la comunidad de estudiantes universitarios que colaboran y se preparan juntos día a día.
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
              Catálogo de Asignaturas
            </Link>
            <a href="#pilares" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}>
              Beneficios
            </a>
          </div>
        </div>

        <div className="ia-landing-footer-copy">
          © {new Date().getFullYear()} InterAula · Plataforma Universitaria de Tutorías y Acompañamiento Académico.
        </div>
      </footer>
    </div>
  );
}
