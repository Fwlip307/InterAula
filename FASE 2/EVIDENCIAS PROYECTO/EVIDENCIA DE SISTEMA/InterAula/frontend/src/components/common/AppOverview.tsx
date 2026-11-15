import { Link } from 'react-router-dom';
import '../../styles/productGuide.css';
import '../../styles/guidedExperience.css';

export default function AppOverview() {
  return <section className="ia-app-overview" aria-labelledby="app-overview-title">
    <header><h2 id="app-overview-title">¿Qué puedes hacer en InterAula?</h2><p>Un espacio para organizar tu estudio y aprender con otros universitarios. Elige lo que necesites hoy.</p></header>
    <div className="ia-guided-options">
      <article className="ia-guide-overview-card"><h3>Estudiar a tu ritmo</h3><ul><li>Organiza materias, metas y tareas en pasos pequeños.</li><li>Entiende temas con explicaciones y ejemplos.</li><li>Practica y descubre qué conviene reforzar.</li></ul><Link className="ia-guide-action" to="/learning-space">Ir a Estudiar →</Link></article>
      <article className="ia-guide-overview-card"><h3>Pedir apoyo</h3><ul><li>Encuentra un tutor para tu materia.</li><li>Participa en talleres y clases grupales.</li><li>Revisa tu agenda y accede a tus sesiones.</li></ul><Link className="ia-guide-action" to="/tutoring">Buscar apoyo →</Link></article>
      <article className="ia-guide-overview-card"><h3>Participar en comunidad</h3><ul><li>Consulta y comparte apuntes.</li><li>Pregunta y conversa en el foro.</li><li>Forma equipos o participa en proyectos.</li></ul><Link className="ia-guide-action" to="/participate">Explorar la comunidad →</Link></article>
    </div>
    <div className="ia-guide-shortcuts" aria-label="Otras posibilidades de InterAula">
      <Link to="/learning-space?tab=profile"><strong>Elige tus apoyos</strong><span>Configura cómo prefieres aprender y compartir tus preferencias.</span></Link>
      <Link to="/profile?tab=interests"><strong>Descubre temas y personas</strong><span>Elige intereses y ajusta tu institución o sede para las sugerencias.</span></Link>
      <Link to="/profile?tab=tutoring"><strong>Comparte lo que sabes</strong><span>Acredita tus materias para ofrecer tutorías a otros estudiantes.</span></Link>
    </div>
    <Link className="ia-guide-action" to="/guide">Ver la guía completa con ejemplos y accesos</Link>
  </section>;
}
