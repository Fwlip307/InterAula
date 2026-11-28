import { Link } from 'react-router-dom';
import '../../styles/visualOverview.css';

export default function StudyWelcome({name}:{name:string}) {
  return <header className="ia-study-welcome">
    <div className="ia-study-welcome-copy">
      <span className="ia-visual-kicker">Aprender juntos, a nuestra manera</span>
      <h1>Hola, {name}</h1>
      <p>Avanza a tu ritmo, coordina tutorías entre pares o colabora en proyectos universitarios desde un solo lugar.</p>
      <div className="ia-study-welcome-actions">
        <Link className="ia-btn-secondary" to="/guide">Ver guía rápida</Link>
      </div>
    </div>
    <figure className="ia-study-welcome-photo">
      <img src="/images/academic/hero-colaboracion.jpg" width="1200" height="800" alt="Estudiantes conversando y trabajando con sus computadores alrededor de una mesa." decoding="async" fetchPriority="high"/>
    </figure>
  </header>;
}
