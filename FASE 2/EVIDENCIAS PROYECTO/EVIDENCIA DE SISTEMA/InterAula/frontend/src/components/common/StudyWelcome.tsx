import { Link } from 'react-router-dom';
import { BookOpenIcon, UsersIcon, SlidersIcon } from './Icons';
import '../../styles/visualOverview.css';

export default function StudyWelcome({name}:{name:string}) {
  return <header className="ia-study-welcome">
    <div className="ia-study-welcome-copy">
      <span className="ia-visual-kicker">Aprender juntos, a nuestra manera</span>
      <h1>Hola, {name}</h1>
      <p>Organiza tu estudio, aprende a tu ritmo y encuentra apoyo entre universitarios. Aquí puedes retomar una materia, resolver una duda o crear algo con otras personas.</p>
      <div className="ia-welcome-highlights" aria-label="Lo que encontrarás">
        <span><BookOpenIcon size={15} aria-hidden="true"/>Pasos claros</span>
        <span><UsersIcon size={15} aria-hidden="true"/>Apoyo entre pares</span>
        <span><SlidersIcon size={15} aria-hidden="true"/>Tu forma de aprender</span>
      </div>
      <Link className="ia-btn-secondary" to="/guide">Cómo usar InterAula</Link>
    </div>
    <figure className="ia-study-welcome-photo">
      <img src="/images/academic/hero-colaboracion.jpg" width="1200" height="800" alt="Estudiantes conversando y trabajando con sus computadores alrededor de una mesa." decoding="async" fetchPriority="high"/>
      <figcaption>Un espacio para estudiar, compartir y acompañarse.</figcaption>
    </figure>
  </header>;
}
