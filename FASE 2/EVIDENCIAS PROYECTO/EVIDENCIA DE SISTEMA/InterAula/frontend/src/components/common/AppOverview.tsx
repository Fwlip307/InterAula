import { Link } from 'react-router-dom';
import { BookOpenIcon, UsersIcon, BriefcaseIcon, SlidersIcon, TargetIcon, ShieldCheckIcon, LightbulbIcon, CheckCircleIcon, CompassIcon } from './Icons';
import '../../styles/productGuide.css';
import '../../styles/guidedExperience.css';
import '../../styles/visualOverview.css';

const AREAS = [
  {id:'study',Icon:BookOpenIcon,title:'Estudiar a tu ritmo',tag:'Tu espacio de aprendizaje',image:'espacio-estudio.jpg',alt:'Una persona escribe sus apuntes junto a un computador.',items:['Organiza materias, metas y tareas en pasos pequeños.','Entiende temas con explicaciones y ejemplos.','Practica y descubre qué conviene reforzar.'],example:'Tengo una prueba: preparo una ruta y repaso un tema a la vez.',href:'/learning-space',action:'Ir a Estudiar'},
  {id:'support',Icon:UsersIcon,title:'Pedir apoyo',tag:'Aprender con otras personas',image:'tutoria-pares.jpg',alt:'Un grupo de estudiantes revisa un computador en una biblioteca.',items:['Encuentra un tutor para tu materia.','Participa en talleres y clases grupales.','Revisa tu agenda y accede a tus sesiones.'],example:'No entiendo un ejercicio: busco un tutor y solicito una sesión.',href:'/tutoring',action:'Buscar apoyo'},
  {id:'community',Icon:BriefcaseIcon,title:'Participar en comunidad',tag:'Conocimiento que se comparte',image:'proyectos-equipo.jpg',alt:'Dos personas trabajan juntas en un proyecto frente a un computador.',items:['Consulta y comparte apuntes.','Pregunta y conversa en el foro.','Forma equipos o participa en proyectos.'],example:'Quiero crear un proyecto: encuentro un equipo y comparto mis ideas.',href:'/participate',action:'Explorar la comunidad'},
] as const;

const SHORTCUTS = [
  {Icon:SlidersIcon,href:'/learning-space?tab=profile',title:'Elige tus apoyos',description:'Instrucciones escritas, pausas o formas de participar: elige lo que te ayuda y con quién compartirlo.'},
  {Icon:TargetIcon,href:'/profile?tab=interests',title:'Descubre temas y personas',description:'Distingue lo que te interesa, lo que quieres aprender y lo que puedes compartir. Ajusta también tu institución o sede.'},
  {Icon:ShieldCheckIcon,href:'/profile?tab=tutoring',title:'Comparte lo que sabes',description:'Acredita tus materias para ofrecer tutorías. La formación en acompañamiento inclusivo se revisa por separado.'},
] as const;

export default function AppOverview() {
  return <section className="ia-app-overview" aria-labelledby="app-overview-title">
    <header><span className="ia-visual-kicker">Tres caminos, un mismo espacio</span><h2 id="app-overview-title">¿Qué puedes hacer en InterAula?</h2><p>Un espacio para organizar tu estudio y aprender con otros universitarios. Elige lo que necesites hoy.</p></header>
    <div className="ia-guided-options">
      {AREAS.map(({Icon,...area})=><article key={area.id} className="ia-guide-overview-card ia-visual-area" data-area={area.id}>
        <div className="ia-area-photo"><img src={'/images/academic/'+area.image} width="1000" height="667" alt={area.alt} loading="lazy" decoding="async"/><span className="ia-area-icon"><Icon size={23} aria-hidden="true"/></span></div>
        <div className="ia-area-content"><span className="ia-area-label">{area.tag}</span><h3>{area.title}</h3><ul>{area.items.map(item=><li key={item}>{item}</li>)}</ul><p className="ia-area-example"><strong>Por ejemplo</strong>{area.example}</p><Link className="ia-guide-action" to={area.href}>{area.action} →</Link></div>
      </article>)}
    </div>
    <section className="ia-practice-spotlight" aria-labelledby="practice-spotlight-title">
      <div className="ia-practice-spotlight-copy"><span className="ia-visual-kicker"><CompassIcon size={16} aria-hidden="true"/>Piloto de Cálculo</span><h3 id="practice-spotlight-title">Un siguiente paso que se adapta a tus respuestas</h3><p>La ruta adaptativa te propone un concepto para practicar. Si aparece una dificultad, puede recomendar reforzar una base antes de seguir avanzando.</p><div className="ia-spotlight-tags"><span>Sin cronómetro</span><span>Con pistas</span><span>Mapa de conceptos</span></div><Link className="ia-btn-primary" to="/learning-space?tab=adaptive">Explorar mi ruta adaptativa</Link></div>
      <div className="ia-practice-journey"><p className="ia-journey-title">Así es una sesión de práctica</p><ol>
        <li><span className="ia-journey-icon"><BookOpenIcon size={19} aria-hidden="true"/></span><div><strong>Responde una pregunta</strong><span>Puedes pedir una pista antes de responder.</span></div></li>
        <li><span className="ia-journey-icon"><LightbulbIcon size={19} aria-hidden="true"/></span><div><strong>Revisa la explicación</strong><span>Comprende el resultado con retroalimentación.</span></div></li>
        <li><span className="ia-journey-icon"><CheckCircleIcon size={19} aria-hidden="true"/></span><div><strong>Recibe tu siguiente paso</strong><span>Continúa o refuerza un concepto previo.</span></div></li>
      </ol><p className="ia-journey-note">La práctica te ayuda a estudiar; no acredita materias para enseñar.</p></div>
    </section>
    <div className="ia-guide-shortcuts" aria-label="Otras posibilidades de InterAula">
      {SHORTCUTS.map(({Icon,...item})=><Link key={item.href} to={item.href}><span className="ia-shortcut-icon"><Icon size={21} aria-hidden="true"/></span><strong>{item.title}</strong><span>{item.description}</span></Link>)}
    </div>
    <Link className="ia-guide-action" to="/guide">Ver la guía completa con ejemplos y accesos</Link>
  </section>;
}
