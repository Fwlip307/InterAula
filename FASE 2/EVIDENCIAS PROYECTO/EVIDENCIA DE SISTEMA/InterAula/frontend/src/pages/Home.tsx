import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCalmMode } from '../context/CalmModeContext';
import ThemeModeMenu from '../components/layout/ThemeModeMenu';
import { profileService } from '../services/profile.service';
import { projectService } from '../services/project.service';
import type { Subject } from '../types/profile';
import type { Project } from '../types/project';
import {
  BookOpenIcon,
  ShieldCheckIcon,
  UsersIcon,
  CheckIcon,
  BriefcaseIcon,
  CompassIcon,
  LayersIcon,
  LightbulbIcon,
  SlidersIcon,
  ListChecksIcon,
  TargetIcon,
  ArrowRightIcon,
} from '../components/common/Icons';
import interaulaLogo from '../assets/branding/interaula-logo.png';
import '../styles/home.css';

const SEVEN_STEPS = [
  {
    step: '01',
    title: 'Configuras cómo prefieres aprender',
    description:
      'Creas tu perfil académico y defines de forma privada si prefieres explicaciones paso a paso, ejemplos prácticos, apoyo visual o sesiones tranquilas.',
  },
  {
    step: '02',
    title: 'Ingresas a Mi espacio de aprendizaje',
    description:
      'Accedes a tu entorno central donde se reúnen tus asignaturas a reforzar, objetivos del semestre, rutas activas y próximas actividades.',
  },
  {
    step: '03',
    title: 'Avanzas con rutas divididas en pasos manejables',
    description:
      'Transformas cualquier asignatura o evaluación compleja en etapas breves, ordenadas y fáciles de retomar sin sobrecarga.',
  },
  {
    step: '04',
    title: 'Cambias el modo de explicación cuando lo necesites',
    description:
      'Alternas entre explicación sencilla, paso a paso, con ejemplos prácticos, esquema visual o profundización técnica sin perder tu progreso.',
  },
  {
    step: '05',
    title: 'Practicas, evalúas tu avance y refuerzas sin presión',
    description:
      'Compruebas lo aprendido sin cronómetros punitivos, identificando qué temas ya están consolidados y cuáles conviene repasar.',
  },
  {
    step: '06',
    title: 'Solicitas u ofreces tutorías colaborativas entre pares',
    description:
      'Pides apoyo en las materias que te cuestan compartiendo tu estilo de estudio, o enseñas aquellas asignaturas que ya dominas.',
  },
  {
    step: '07',
    title: 'Colaboras en proyectos, apuntes y foro académico',
    description:
      'Integras tus conocimientos en el Hub de Proyectos Interdisciplinarios, la Biblioteca de Apuntes y el Foro estudiantil.',
  },
];

export default function Home() {
  const { user } = useAuth();
  const { isCalmMode, toggleCalmMode } = useCalmMode();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [demoMode, setDemoMode] = useState<'sencilla' | 'paso_a_paso' | 'ejemplos' | 'visual'>('paso_a_paso');

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
          setFeaturedProjects(
            projs.filter((p) => p.status === 'open' || p.status === 'recruiting').slice(0, 3)
          );
        }
      } catch (err) {
        console.error('[Home] Error cargando catálogo:', err);
      }
    }
    loadCatalog();
  }, []);

  return (
    <div className="ia-landing">
      {isCalmMode && (
        <div className="ia-calm-active-bar" role="status" aria-live="polite">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <SlidersIcon size={14} />
            <strong>Modo Calma activo:</strong> Superficies descansadas, contraste suave y lectura sin estímulos distractivos.
          </span>
          <button type="button" className="ia-calm-active-bar__action" onClick={toggleCalmMode}>
            Volver a vista estándar
          </button>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INSTITUCIONAL */}
      <header className="ia-landing-header">
        <div className="ia-landing-header-inner">
          <Link to="/" className="ia-landing-brand">
            <img
              src={interaulaLogo}
              alt="Logo InterAula"
              style={{ width: '34px', height: '34px', objectFit: 'contain' }}
            />
            <span className="ia-landing-brand-name">InterAula</span>
          </Link>

          <nav className="ia-landing-nav" aria-label="Navegación de presentación">
            <a href="#proposito" className="ia-landing-nav-link">
              Propósito
            </a>
            <a href="#como-funciona" className="ia-landing-nav-link">
              Cómo funciona
            </a>
            <a href="#espacio-aprendizaje" className="ia-landing-nav-link">
              Mi espacio de aprendizaje
            </a>
            <a href="#tutorias" className="ia-landing-nav-link">
              Tutorías
            </a>
            <a href="#inclusion" className="ia-landing-nav-link">
              Inclusión
            </a>
            <a href="#proyectos" className="ia-landing-nav-link">
              Hub de Proyectos
            </a>
          </nav>

          <div className="ia-landing-auth-btns">
            <ThemeModeMenu variant="landing" />

            {user ? (
              <>
                <Link to="/dashboard" className="ia-landing-btn-portal">
                  <span>Ir al portal</span>
                  <ArrowRightIcon size={15} />
                </Link>
                <Link to="/learning-space" className="ia-landing-btn-primary">
                  <CompassIcon size={16} />
                  <span>Mi espacio de aprendizaje</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="ia-landing-btn-login" aria-label="Iniciar sesión">
                  <span className="ia-login-full">Iniciar sesión</span><span className="ia-login-short">Ingresar</span>
                </Link>
                <Link to="/register" className="ia-landing-btn-primary">
                  <span>Registrarse</span>
                  <ArrowRightIcon size={15} />
                </Link>
              </>
            )}
          </div>
          <nav className="ia-landing-mobile-nav" aria-label="Secciones de presentación">
            <select aria-label="Ir a una sección" defaultValue="" onChange={(event) => { if (event.target.value) document.getElementById(event.target.value)?.scrollIntoView(); }}>
              <option value="" disabled>Explorar InterAula</option>
              <option value="proposito">Propósito</option>
              <option value="como-funciona">Cómo funciona</option>
              <option value="espacio-aprendizaje">Mi espacio de aprendizaje</option>
              <option value="tutorias">Tutorías</option>
              <option value="inclusion">Inclusión</option>
              <option value="proyectos">Proyectos</option>
            </select>
          </nav>
        </div>
      </header>

      {/* =====================================================================
          1. HERO PRINCIPAL CON FOTOGRAFÍA ACADÉMICA VERIFICADA
         ===================================================================== */}
      <section className="ia-landing-hero">
        <div className="ia-landing-hero-inner">
          <div className="ia-landing-hero-grid">
            <div>
              <div className="ia-landing-badge">
                <CompassIcon size={15} />
                <span>Plataforma académica colaborativa, inclusiva y adaptable</span>
              </div>

              <h1 className="ia-landing-title">
                InterAula:{' '}
                <span className="ia-landing-title-highlight">
                  Aprender juntos, a nuestra manera
                </span>
              </h1>

              <p className="ia-landing-desc">
                Organiza tu estudio a tu ritmo, recibe explicaciones adaptadas y encuentra apoyo en
                tutorías entre estudiantes. Comparte apuntes y participa en proyectos con personas de
                distintas carreras.
              </p>

              <div className="ia-landing-hero-actions">
                {user ? (
                  <>
                    <Link to="/learning-space" className="ia-landing-btn-primary ia-landing-btn-lg">
                      <CompassIcon size={18} />
                      <span>Ingresar a Mi espacio de aprendizaje</span>
                    </Link>
                    <Link to="/dashboard" className="ia-landing-btn-outline ia-landing-btn-lg">
                      <span>Ir al portal académico</span>
                      <ArrowRightIcon size={16} />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="ia-landing-btn-primary ia-landing-btn-lg">
                      <span>Crear mi espacio de aprendizaje</span>
                      <ArrowRightIcon size={17} />
                    </Link>
                    <Link to="/login" className="ia-landing-btn-outline ia-landing-btn-lg">
                      <span>Iniciar sesión</span>
                    </Link>
                  </>
                )}
              </div>

              <div className="ia-landing-trust-bar">
                <div className="ia-landing-trust-item">
                  <CompassIcon size={17} />
                  <span>Rutas paso a paso y 6 modos de explicación</span>
                </div>
                <div className="ia-landing-trust-item">
                  <UsersIcon size={17} />
                  <span>Tutorías colaborativas entre pares</span>
                </div>
                <div className="ia-landing-trust-item">
                  <BriefcaseIcon size={17} />
                  <span>Hub de Proyectos Interdisciplinarios</span>
                </div>
              </div>
            </div>

            <div className="ia-landing-hero-visual">
              <div className="ia-photo-frame">
                <img
                  src="/images/academic/hero-colaboracion.jpg"
                  alt="Estudiantes universitarios estudiando juntos y colaborando con computadores y cuadernos"
                />
                <div className="ia-hero-float-badge">
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.84rem', color: '#0f172a' }}>
                      Aprendizaje adaptado a tu ritmo
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: '#475569' }}>
                      Explicaciones sencillas, paso a paso, visuales o con casos reales
                    </span>
                  </div>
                  <span className="ia-showcase-chip">Inclusivo · DUA</span>
                </div>
                <div className="ia-photo-caption">
                  <span>Comunidad universitaria colaborativa e interdisciplinaria</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Fotografía: Brooke Cagle / Unsplash</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. EL PROBLEMA QUE BUSCAMOS RESOLVER
         ===================================================================== */}
      <section id="proposito" className="ia-landing-section ia-problem-section">
        <div className="ia-problem-layout">
          <div className="ia-problem-main">
            <span className="ia-landing-section-tag">El desafío universitario</span>
            <h2 className="ia-landing-section-title" style={{ textAlign: 'left', marginTop: '0.75rem' }}>
              No todas las personas aprenden al mismo ritmo ni de la misma forma
            </h2>
            <p className="ia-problem-paragraph">
              En la educación superior es frecuente enfrentarse a unidades extensas, explicaciones
              rápidas o materiales que asumen una única manera de estudiar. Cuando un tema no queda
              claro a la primera, muchos estudiantes experimentan sobrecarga, bloqueo al organizar
              sus tareas o dificultad para encontrar apoyo oportuno.
            </p>
            <p className="ia-problem-paragraph">
              InterAula nace para cambiar esa experiencia: combina un entorno personalizable que
              divide el estudio en etapas manejables con una red humana de compañeros dispuestos a
              explicar, compartir apuntes y construir proyectos en comunidad.
            </p>
            <div className="ia-section-photo-card" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
              <img
                src="/images/academic/espacio-estudio.jpg"
                alt="Estudiante organizando apuntes, esquemas y tareas paso a paso en su cuaderno de estudio"
                loading="lazy"
              />
              <div className="ia-section-photo-card__caption">
                <span>Organización paso a paso y planificación de estudio sin sobrecarga</span>
                <span>Foto: Green Chameleon / Unsplash</span>
              </div>
            </div>
          </div>

          <div className="ia-problem-contrast">
            <div className="ia-contrast-block ia-contrast-block--before">
              <h3>Estudio tradicional aislado</h3>
              <ul>
                <li>Contenidos extensos presentados de una sola forma rígida</li>
                <li>Bloqueo al no saber por qué paso empezar una asignatura</li>
                <li>Evaluaciones con presión de tiempo que dificultan concentrarse</li>
                <li>Falta de conexión con compañeros de otras especialidades</li>
              </ul>
            </div>
            <div className="ia-contrast-block ia-contrast-block--after">
              <h3>La propuesta de InterAula</h3>
              <ul>
                <li>Explicaciones adaptables: sencilla, paso a paso, visual o práctica</li>
                <li>Rutas de aprendizaje y tareas desglosadas a tu propio ritmo</li>
                <li>Tutorías entre pares informadas con tus preferencias de estudio</li>
                <li>Proyectos interdisciplinarios para aplicar lo aprendido en equipo</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. CÓMO FUNCIONA INTERAULA (7 PASOS)
         ===================================================================== */}
      <section id="como-funciona" className="ia-landing-section">
        <div className="ia-landing-section-header">
          <span className="ia-landing-section-tag">Recorrido del estudiante</span>
          <h2 className="ia-landing-section-title">Cómo funciona InterAula</h2>
          <p className="ia-landing-section-desc">
            Un flujo continuo que conecta tu organización personal con el apoyo colaborativo de toda
            la comunidad.
          </p>
        </div>

        <div className="ia-seven-steps-list">
          {SEVEN_STEPS.map((item) => (
            <div key={item.step} className="ia-seven-step-row">
              <div className="ia-seven-step-num">{item.step}</div>
              <div className="ia-seven-step-body">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          4. MI ESPACIO DE APRENDIZAJE (SECCIÓN DESTACADA)
         ===================================================================== */}
      <section id="espacio-aprendizaje" className="ia-landing-section ia-featured-space-section">
        <div className="ia-featured-space-header">
          <div>
            <span className="ia-landing-section-tag">El corazón de InterAula</span>
            <h2 className="ia-landing-section-title" style={{ textAlign: 'left', marginTop: '0.6rem' }}>
              Mi espacio de aprendizaje: de una materia compleja a un camino claro
            </h2>
            <p className="ia-landing-section-desc" style={{ textAlign: 'left', margin: 0 }}>
              Cada asignatura o meta académica se transforma en una secuencia estructurada de etapas
              pequeñas. En cada etapa puedes cambiar el modo en que recibes la explicación,
              practicar sin límite de tiempo y pedir apoyo directo a un tutor par.
            </p>
          </div>
          <Link
            to={user ? '/learning-space' : '/register'}
            className="ia-landing-btn-primary"
          >
            <CompassIcon size={16} />
            <span>{user ? 'Abrir Mi espacio de aprendizaje' : 'Probar Mi espacio de aprendizaje'}</span>
          </Link>
        </div>

        {/* Demostración interactiva real de cómo se transforma una asignatura */}
        <div className="ia-space-showcase">
          <div className="ia-space-showcase__path">
            <div className="ia-space-showcase__path-header">
              <span className="ia-showcase-chip">Asignatura: Programación de Algoritmos</span>
              <span className="ia-showcase-progress">Avance de ruta: 50% (2 de 4 etapas)</span>
            </div>
            <h3 className="ia-space-showcase__path-title">
              Meta: Comprender estructuras iterativas y arreglos para el certamen
            </h3>

            <div className="ia-showcase-stages">
              <div className="ia-showcase-stage done">
                <CheckIcon size={15} />
                <div>
                  <strong>Etapa 1: Conceptos base e índices</strong>
                  <span>Completada · Explicación sencilla + esquema visual</span>
                </div>
              </div>
              <div className="ia-showcase-stage done">
                <CheckIcon size={15} />
                <div>
                  <strong>Etapa 2: Recorrido paso a paso con ciclo for</strong>
                  <span>Completada · Práctica guiada sin reloj</span>
                </div>
              </div>
              <div className="ia-showcase-stage current">
                <LayersIcon size={15} />
                <div>
                  <strong>Etapa 3: Búsqueda y filtrado en arreglos</strong>
                  <span>En curso · Explora los modos de explicación a la derecha</span>
                </div>
              </div>
              <div className="ia-showcase-stage">
                <TargetIcon size={15} />
                <div>
                  <strong>Etapa 4: Comprobación de comprensión o tutoría 1 a 1</strong>
                  <span>Siguiente paso · Conecta con un tutor si quedan dudas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ia-space-showcase__explainer">
            <div className="ia-space-showcase__explainer-top">
              <span className="ia-showcase-label">
                <LightbulbIcon size={15} /> Aprende a tu manera (Cambia el modo de explicación)
              </span>
              <div className="ia-showcase-mode-tabs">
                <button
                  type="button"
                  className={demoMode === 'sencilla' ? 'active' : ''}
                  onClick={() => setDemoMode('sencilla')}
                >
                  Sencilla
                </button>
                <button
                  type="button"
                  className={demoMode === 'paso_a_paso' ? 'active' : ''}
                  onClick={() => setDemoMode('paso_a_paso')}
                >
                  Paso a paso
                </button>
                <button
                  type="button"
                  className={demoMode === 'ejemplos' ? 'active' : ''}
                  onClick={() => setDemoMode('ejemplos')}
                >
                  Con ejemplos
                </button>
                <button
                  type="button"
                  className={demoMode === 'visual' ? 'active' : ''}
                  onClick={() => setDemoMode('visual')}
                >
                  Visualmente
                </button>
              </div>
            </div>

            <div className="ia-space-showcase__explainer-body">
              {demoMode === 'sencilla' && (
                <>
                  <h4>Explicación sencilla</h4>
                  <p>
                    Recorrer un arreglo significa revisar sus casillas una por una en orden, desde
                    la primera hasta la última, para encontrar un dato o transformar su contenido
                    sin saltarse ninguna posición.
                  </p>
                </>
              )}
              {demoMode === 'paso_a_paso' && (
                <>
                  <h4>Secuencia paso a paso</h4>
                  <ol>
                    <li>1. Definimos el índice inicial en la posición 0 del arreglo.</li>
                    <li>2. Comprobamos que el índice sea menor al largo total de elementos.</li>
                    <li>3. Leemos el valor actual y avanzamos una posición en cada vuelta.</li>
                  </ol>
                </>
              )}
              {demoMode === 'ejemplos' && (
                <>
                  <h4>Con ejemplos prácticos</h4>
                  <p>
                    Imagina una lista de asistencia de 30 estudiantes: revisas cada fila desde el
                    número 1 hasta el 30 y marcas únicamente a quienes asistieron hoy al taller.
                  </p>
                </>
              )}
              {demoMode === 'visual' && (
                <>
                  <h4>Estructura visual del flujo</h4>
                  <p>
                    [Entrada: Lista de datos] → [Condición: ¿Quedan elementos por revisar?] →
                    [Acción: Evaluar elemento actual] → [Salida: Resultado verificado].
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. TUTORÍAS COLABORATIVAS
         ===================================================================== */}
      <section id="tutorias" className="ia-landing-section">
        <div className="ia-two-col-feature">
          <div>
            <span className="ia-landing-section-tag">Apoyo mutuo entre compañeros</span>
            <h2 className="ia-landing-section-title" style={{ textAlign: 'left', marginTop: '0.6rem' }}>
              Tutorías colaborativas: pide apoyo en lo difícil y enseña lo que dominas
            </h2>
            <p className="ia-problem-paragraph">
              En InterAula nadie está encasillado en un único rol. Un mismo estudiante puede
              solicitar tutorías en las asignaturas que necesita reforzar y, al mismo tiempo,
              acreditarse como tutor par en las materias donde tiene fortaleza.
            </p>
            <ul className="ia-clean-check-list">
              <li>
                <CheckIcon size={16} />
                <span>
                  Comparte voluntariamente con tu tutor cómo te resulta más cómodo aprender antes de
                  la sesión.
                </span>
              </li>
              <li>
                <CheckIcon size={16} />
                <span>
                  Distingue entre Tutores Pares Verificados (con nota o evaluación técnica) y Apoyo
                  Académico entre Pares.
                </span>
              </li>
              <li>
                <CheckIcon size={16} />
                <span>
                  Coordina sesiones individuales 1 a 1 o inscríbete en talleres grupales de repaso.
                </span>
              </li>
            </ul>
          </div>

          <div className="ia-subjects-showcase-box">
            <div className="ia-section-photo-card">
              <img
                src="/images/academic/tutoria-pares.jpg"
                alt="Compañeros de universidad resolviendo dudas juntos en una sesión de tutoría en biblioteca"
                loading="lazy"
              />
              <div className="ia-section-photo-card__caption">
                <span>Mentoría horizontal entre estudiantes de educación superior</span>
                <span>Foto: Priscilla Du Preez / Unsplash</span>
              </div>
            </div>
            <h3>Asignaturas activas en el catálogo</h3>
            <p>
              Selecciona una materia para explorar tutores disponibles, apuntes y rutas de estudio:
            </p>
            <div className="ia-subjects-cloud" style={{ justifyContent: 'flex-start' }}>
              {subjects.length > 0 ? (
                subjects.map((sub) => (
                  <Link
                    key={sub.id}
                    to={user ? `/tutoring?subjectId=${sub.id}` : `/login?redirect=/tutoring`}
                    className="ia-subject-chip"
                  >
                    <BookOpenIcon size={15} />
                    <span>{sub.name}</span>
                  </Link>
                ))
              ) : (
                <span className="text-muted">Catálogo académico disponible al iniciar sesión.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. INCLUSIÓN Y ACCESIBILIDAD
         ===================================================================== */}
      <section id="inclusion" className="ia-landing-section ia-inclusion-section">
        <div className="ia-landing-section-header">
          <span className="ia-landing-section-tag">Diseño inclusivo y respetuoso</span>
          <h2 className="ia-landing-section-title">
            Accesibilidad real integrada en toda la experiencia
          </h2>
          <p className="ia-landing-section-desc">
            Diseñado para reducir la fatiga visual y la sobrecarga cognitiva, sin solicitar
            diagnósticos clínicos ni exponer etiquetas en tu perfil público.
          </p>
        </div>

        <div className="ia-inclusion-grid">
          <div className="ia-inclusion-item">
            <SlidersIcon size={20} />
            <h3>Modo Calma y control visual</h3>
            <p>
              Activa en cualquier momento una interfaz sobria de bajo estímulo, ajusta el tamaño de
              texto, el espaciado de lectura, el contraste y reduce las animaciones.
            </p>
          </div>
          <div className="ia-inclusion-item">
            <ListChecksIcon size={20} />
            <h3>Organización por subtareas y pausas</h3>
            <p>
              Divide entregas grandes en pasos pequeños con intervalos de enfoque y descanso
              configurables a tu medida, que puedes pausar y retomar sin presión.
            </p>
          </div>
          <div className="ia-inclusion-item">
            <TargetIcon size={20} />
            <h3>Práctica sin límite de tiempo</h3>
            <p>
              Desactiva los temporizadores en tus cuestionarios de práctica y utiliza pistas paso a
              paso para consolidar conceptos a tu propio ritmo.
            </p>
          </div>
          <div className="ia-inclusion-item">
            <ShieldCheckIcon size={20} />
            <h3>Privacidad de tus preferencias</h3>
            <p>
              Tus preferencias pedagógicas son voluntarias y privadas: solo tú decides cuándo
              compartirlas al coordinar una tutoría.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. HUB DE PROYECTOS INTERDISCIPLINARIOS
         ===================================================================== */}
      <section id="proyectos" className="ia-landing-section">
        <div className="ia-featured-space-header" style={{ marginBottom: '1.75rem' }}>
          <div>
            <span className="ia-landing-section-tag">Colaboración entre carreras</span>
            <h2 className="ia-landing-section-title" style={{ textAlign: 'left', marginTop: '0.6rem' }}>
              Hub de Proyectos Interdisciplinarios
            </h2>
            <p className="ia-landing-section-desc" style={{ textAlign: 'left', margin: 0 }}>
              Publica una iniciativa o únete a equipos que buscan perfiles de programación, diseño,
              datos, gestión o investigación con roles, habilidades y condiciones transparentes.
            </p>
          </div>
          <Link to={user ? '/projects' : '/login?redirect=/projects'} className="ia-landing-btn-outline">
            <BriefcaseIcon size={16} />
            <span>Explorar Hub de Proyectos</span>
          </Link>
        </div>

        <div className="ia-section-photo-card" style={{ marginBottom: '1.5rem' }}>
          <img
            src="/images/academic/proyectos-equipo.jpg"
            alt="Equipo interdisciplinario de estudiantes colaborando en el desarrollo de un proyecto tecnológico"
            loading="lazy"
            style={{ height: '250px' }}
          />
          <div className="ia-section-photo-card__caption">
            <span>Equipos interdisciplinarios de ingeniería, diseño, datos y gestión trabajando en proyectos reales</span>
            <span>Foto: Mimi Thian / Unsplash</span>
          </div>
        </div>

        {featuredProjects.length > 0 ? (
          <div className="ia-pillars-grid">
            {featuredProjects.map((proj) => (
              <div
                key={proj.id}
                className="ia-pillar-card"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <span className="ia-project-badge">
                    {proj.category || 'Proyecto Interdisciplinario'}
                  </span>
                  <h3 className="ia-pillar-title" style={{ marginBottom: '0.4rem' }}>
                    {proj.title}
                  </h3>
                  <p className="ia-pillar-desc" style={{ marginBottom: '0.9rem' }}>
                    {proj.short_description || proj.description}
                  </p>
                </div>
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                    {(proj.positions || []).slice(0, 3).map((pos) => (
                      <span key={pos.id} className="ia-project-role-tag">
                        Rol: {pos.title}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={user ? '/projects' : '/login?redirect=/projects'}
                    className="ia-landing-btn-outline"
                    style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
                  >
                    Ver roles y postular
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ia-empty-projects-showcase">
            <p>
              ¿Buscas compañeros de otras carreras para desarrollar una aplicación, proyecto de
              ramo o portafolio? Publica tu proyecto definiendo los perfiles y habilidades que
              necesitas.
            </p>
            <Link to={user ? '/projects' : '/register'} className="ia-landing-btn-primary">
              <BriefcaseIcon size={16} />
              <span>Crear o explorar proyectos</span>
            </Link>
          </div>
        )}
      </section>

      {/* =====================================================================
          8. LLAMADO A LA ACCIÓN FINAL
         ===================================================================== */}
      <section className="ia-landing-section">
        <div className="ia-cta-banner">
          <h2>Comienza hoy en InterAula: Aprender juntos, a nuestra manera</h2>
          <p>
            Configura tu espacio de aprendizaje, avanza paso a paso en tus asignaturas y conecta con
            estudiantes de toda tu comunidad académica.
          </p>
          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <Link to="/learning-space" className="ia-cta-banner-btn">
                <CompassIcon size={18} />
                <span>Ir a Mi espacio de aprendizaje</span>
              </Link>
            ) : (
              <>
                <Link to="/register" className="ia-cta-banner-btn">
                  <span>Crear cuenta gratuita</span>
                  <ArrowRightIcon size={17} />
                </Link>
                <Link
                  to="/login"
                  className="ia-landing-btn-outline"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.35)' }}
                >
                  <span>Iniciar sesión</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ia-landing-footer">
        <div className="ia-landing-footer-inner">
          <div className="ia-landing-footer-brand">
            <img
              src={interaulaLogo}
              alt="InterAula"
              style={{ width: '26px', height: '26px', objectFit: 'contain' }}
            />
            <span>InterAula · Aprender juntos, a nuestra manera</span>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <Link
              to={user ? '/learning-space' : '/login'}
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}
            >
              Mi espacio de aprendizaje
            </Link>
            <Link
              to="/tutoring"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}
            >
              Tutorías colaborativas
            </Link>
            <Link
              to="/projects"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}
            >
              Hub de Proyectos
            </Link>
            <Link
              to="/resources"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem' }}
            >
              Biblioteca de Apuntes
            </Link>
          </div>
        </div>

        <div className="ia-landing-footer-copy">
          © {new Date().getFullYear()} InterAula · Plataforma académica colaborativa, inclusiva e
          interdisciplinaria.
        </div>
      </footer>
    </div>
  );
}
