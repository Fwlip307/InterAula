import { Link } from 'react-router-dom';
import {
  BookOpenIcon,
  UsersIcon,
  BriefcaseIcon,
  MessageSquareIcon,
  SlidersIcon,
  TargetIcon,
  ShieldCheckIcon,
  LightbulbIcon,
  CheckCircleIcon,
  CompassIcon,
} from './Icons';
import '../../styles/productGuide.css';
import '../../styles/guidedExperience.css';
import '../../styles/visualOverview.css';

const AREAS = [
  {
    id: 'study',
    Icon: BookOpenIcon,
    title: 'Aprender',
    tag: 'Estudio autónomo y adaptable',
    summary: 'Rutas guiadas, biblioteca de apuntes y práctica sin presión de tiempo.',
    image: 'espacio-estudio.jpg',
    alt: 'Una persona escribe sus apuntes junto a un computador.',
    items: [
      'Organiza tus rutas, tareas y metas en Mi espacio de aprendizaje.',
      'Consulta la biblioteca de recursos y redacta apuntes académicos.',
      'Practica con cuestionarios y evaluaciones sin presión de tiempo.',
    ],
    example: 'Tengo una prueba: preparo una ruta y repaso un tema a la vez.',
    href: '/learning-space',
    action: 'Ir a Aprender',
  },
  {
    id: 'support',
    Icon: UsersIcon,
    title: 'Tutorías',
    tag: 'Acompañamiento entre pares',
    summary: 'Conecta con tutores acreditados, agenda sesiones o enseña tus ramos.',
    image: 'tutoria-pares.jpg',
    alt: 'Un grupo de estudiantes revisa un computador en una biblioteca.',
    items: [
      'Explora tutorías, busca tutores acreditados y solicita una sesión.',
      'Ofrece tutorías y valida tus asignaturas en Acreditación de tutor.',
      'Administra tus tutorías y entra directo al aula virtual.',
    ],
    example: 'No entiendo un ejercicio: busco un tutor acreditado y coordino una sesión.',
    href: '/tutoring',
    action: 'Ir a Tutorías',
  },
  {
    id: 'community',
    Icon: MessageSquareIcon,
    title: 'Comunidad',
    tag: 'Conversación y colaboración',
    summary: 'Foro académico, mensajería directa y talleres grupales en vivo.',
    image: 'hero-colaboracion.jpg',
    alt: 'Estudiantes universitarios conversando y colaborando juntos.',
    items: [
      'Pregunta, responde y debate en el foro académico.',
      'Conversa por mensajería directa con tutores y compañeros.',
      'Inscríbete en talleres y actividades grupales en vivo.',
    ],
    example: 'Tengo una duda puntual: pregunto en el foro o escribo por mensajería.',
    href: '/participate',
    action: 'Ir a Comunidad',
  },
  {
    id: 'projects',
    Icon: BriefcaseIcon,
    title: 'Proyectos',
    tag: 'Hub interdisciplinario',
    summary: 'Postula a equipos estudiantiles o publica tu propia iniciativa.',
    image: 'proyectos-equipo.jpg',
    alt: 'Dos personas trabajan juntas en un proyecto frente a un computador.',
    items: [
      'Explora el Hub de Proyectos y postula a vacantes abiertas.',
      'Crea tu propio proyecto definiendo roles, dedicación y acuerdos.',
      'Gestiona tus proyectos, postulaciones, equipos y entregables.',
    ],
    example: 'Quiero armar un equipo: publico el proyecto y coordino entregables.',
    href: '/projects',
    action: 'Ir a Proyectos',
  },
] as const;

const SHORTCUTS = [
  {
    Icon: SlidersIcon,
    href: '/settings#accessibility',
    title: 'Apoyos sensoriales y accesibilidad',
    description: 'Modo Calma, Crepúsculo, filtro cálido suave, lectura fácil y espaciado adaptable.',
  },
  {
    Icon: TargetIcon,
    href: '/learning-space?tab=profile',
    title: 'Mis preferencias de aprendizaje',
    description: 'Define cómo prefieres estudiar y decide cuándo compartir tus apoyos en tutorías.',
  },
  {
    Icon: ShieldCheckIcon,
    href: '/profile?tab=tutoring',
    title: 'Acreditación de tutor',
    description: 'Valida tus conocimientos mediante evaluación técnica, certificado o respaldo docente.',
  },
] as const;

export default function AppOverview({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`ia-app-overview ${compact ? 'ia-app-overview--compact' : ''}`}
      aria-labelledby="app-overview-title"
    >
      <header className="ia-app-overview-head">
        <div>
          <span className="ia-visual-kicker">Accesos rápidos</span>
          <h2 id="app-overview-title">
            {compact ? 'Explora los espacios de InterAula' : '¿Qué puedes hacer en InterAula?'}
          </h2>
          {!compact && (
            <p>
              Elige el espacio que necesitas hoy: estudiar a tu ritmo, coordinar tutorías, participar en comunidad o crear proyectos en equipo.
            </p>
          )}
        </div>
        {compact && (
          <Link className="ia-guide-action ia-guide-action--subtle" to="/guide">
            Ver recorrido completo
          </Link>
        )}
      </header>
      <div className="ia-guided-options ia-guided-options--four">
        {AREAS.map(({ Icon, ...area }) => (
          <article
            key={area.id}
            className={`ia-guide-overview-card ia-visual-area ${compact ? 'ia-visual-area--compact' : ''}`}
            data-area={area.id}
            data-orientation={'overview-' + area.id}
          >
            {compact ? (
              <div className="ia-area-compact-head">
                <span className="ia-area-icon ia-area-icon--inline">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <span className="ia-area-label">{area.tag}</span>
                  <h3>{area.title}</h3>
                </div>
              </div>
            ) : (
              <div className="ia-area-photo">
                <img
                  src={'/images/academic/' + area.image}
                  width="1000"
                  height="667"
                  alt={area.alt}
                  loading="lazy"
                  decoding="async"
                />
                <span className="ia-area-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
              </div>
            )}
            <div className="ia-area-content">
              {!compact && (
                <>
                  <span className="ia-area-label">{area.tag}</span>
                  <h3>{area.title}</h3>
                </>
              )}
              {compact ? (
                <>
                  <p className="ia-area-summary">{area.summary}</p>
                  <details className="ia-area-details">
                    <summary>Ver qué incluye</summary>
                    <ul>
                      {area.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <>
                  <ul>
                    {area.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="ia-area-example">
                    <strong>Por ejemplo</strong>
                    {area.example}
                  </p>
                </>
              )}
              <Link className="ia-guide-action" to={area.href}>
                {area.action}
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!compact && (
        <>
          <section className="ia-practice-spotlight" aria-labelledby="practice-spotlight-title">
            <div className="ia-practice-spotlight-copy">
              <span className="ia-visual-kicker">
                <CompassIcon size={16} aria-hidden="true" />
                Piloto de Cálculo
              </span>
              <h3 id="practice-spotlight-title">Un siguiente paso que se adapta a tus respuestas</h3>
              <p>
                La ruta adaptativa te propone un concepto para practicar. Si aparece una dificultad, puede recomendar reforzar una base antes de seguir avanzando.
              </p>
              <div className="ia-spotlight-tags">
                <span>Sin cronómetro</span>
                <span>Con pistas</span>
                <span>Mapa de conceptos</span>
              </div>
              <Link className="ia-btn-primary" to="/learning-space?tab=adaptive">
                Explorar mi ruta adaptativa
              </Link>
            </div>
            <div className="ia-practice-journey">
              <p className="ia-journey-title">Así es una sesión de práctica</p>
              <ol>
                <li>
                  <span className="ia-journey-icon">
                    <BookOpenIcon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Responde una pregunta</strong>
                    <span>Puedes pedir una pista antes de responder.</span>
                  </div>
                </li>
                <li>
                  <span className="ia-journey-icon">
                    <LightbulbIcon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Revisa la explicación</strong>
                    <span>Comprende el resultado con retroalimentación.</span>
                  </div>
                </li>
                <li>
                  <span className="ia-journey-icon">
                    <CheckCircleIcon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Recibe tu siguiente paso</strong>
                    <span>Continúa o refuerza un concepto previo.</span>
                  </div>
                </li>
              </ol>
              <p className="ia-journey-note">La práctica te ayuda a estudiar; no acredita materias para enseñar.</p>
            </div>
          </section>
          <div className="ia-guide-shortcuts" aria-label="Otras posibilidades de InterAula">
            {SHORTCUTS.map(({ Icon, ...item }) => (
              <Link key={item.href} to={item.href}>
                <span className="ia-shortcut-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </Link>
            ))}
          </div>
          <Link className="ia-guide-action" to="/guide">
            Ver la guía completa con ejemplos y accesos
          </Link>
        </>
      )}
    </section>
  );
}
