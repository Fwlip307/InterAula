import { Link } from 'react-router-dom';
import '../styles/guidedExperience.css';

export default function Participate() {
  return <div className="ia-guided-page">
    <header className="ia-guided-heading"><h1>Comunidad</h1><p>Elige cómo quieres aprender con otras personas.</p></header>
    <div className="ia-guided-options">
      <Link className="ia-guided-option" to="/resources?tab=community"><span className="ia-guided-eyebrow">Consultar y compartir</span><strong>Apuntes</strong><span>Encuentra material para tus materias o comparte el tuyo.</span><span className="ia-guided-link">Explorar apuntes →</span></Link>
      <Link className="ia-guided-option" to="/forum"><span className="ia-guided-eyebrow">Conversar</span><strong>Foro</strong><span>Haz una pregunta y comparte ideas con la comunidad.</span><span className="ia-guided-link">Abrir el foro →</span></Link>
      <Link className="ia-guided-option" to="/projects?tab=explore"><span className="ia-guided-eyebrow">Crear en equipo</span><strong>Proyectos</strong><span>Encuentra un equipo o invita a otros a tu proyecto.</span><span className="ia-guided-link">Explorar proyectos →</span></Link>
    </div>
    <section aria-labelledby="community-preferences-title"><h2 id="community-preferences-title" className="ia-guided-section-title">Mi institución y mis intereses</h2><div className="ia-guided-inline"><Link to="/community">Ajustar institución y cercanía</Link><Link to="/profile?tab=interests">Elegir mis intereses</Link><Link to="/dashboard#para-ti">Ver mis recomendaciones</Link></div></section>
  </div>;
}

