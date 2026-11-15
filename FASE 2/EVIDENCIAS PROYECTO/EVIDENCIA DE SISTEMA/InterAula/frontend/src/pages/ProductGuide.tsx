import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeModeMenu from '../components/layout/ThemeModeMenu';
import { ReadAloudControls } from '../components/common/ReadAloudControls';
import { GUIDE_INTRO, GUIDE_SECTIONS, STARTING_STEPS } from '../content/productGuide';
import { BookOpenIcon, TargetIcon, UsersIcon, BriefcaseIcon, SlidersIcon, CompassIcon, ShieldCheckIcon } from '../components/common/Icons';
import '../styles/dashboard.css';
import '../styles/productGuide.css';
import '../styles/visualOverview.css';

const GUIDE_ICONS = { estudiar: BookOpenIcon, practicar: TargetIcon, apoyo: UsersIcon, comunidad: BriefcaseIcon, 'mis-apoyos': SlidersIcon, descubrir: CompassIcon, ensenar: ShieldCheckIcon };

export default function ProductGuide() {
  const { user } = useAuth();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView({block:'start'});
      target?.focus({preventScroll:true});
    } else window.scrollTo(0,0);
  }, [hash]);
  return <div className="ia-layout ia-product-guide">
    <a className="ia-skip-link" href="#guide-main">Saltar al contenido</a>
    <header className="ia-guide-header">
      <Link className="ia-brand" to={user?'/dashboard':'/'}>InterAula</Link>
      <nav aria-label="Accesos de la guía"><Link to={user?'/dashboard':'/'}>{user?'Volver a mi inicio':'Volver a la presentación'}</Link><ThemeModeMenu variant="app" />{!user&&<Link className="ia-btn-primary" to="/login">Iniciar sesión</Link>}</nav>
    </header>
    <main id="guide-main" className="ia-main" tabIndex={-1}>
      <header className="ia-guide-intro"><span className="ia-guided-eyebrow">Guía de InterAula</span><h1>Qué puedes hacer y cómo empezar</h1><p>{GUIDE_INTRO}</p><ReadAloudControls compact text={GUIDE_INTRO} label="Escuchar introducción" />{!user&&<p className="ia-guide-signin-note">Puedes leer esta guía sin una cuenta. Para usar las herramientas necesitas <Link to="/login">iniciar sesión</Link> o <Link to="/register">registrarte</Link>.</p>}</header>
      <section className="ia-guide-start" aria-labelledby="guide-start-title"><h2 id="guide-start-title">Si es tu primera vez</h2><ol>{STARTING_STEPS.map(step=><li key={step.title}><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol></section>
      <nav className="ia-guide-index" aria-label="Temas de la guía">{GUIDE_SECTIONS.map(section=><a key={section.id} href={'#'+section.id}>{section.title}</a>)}</nav>
      <div className="ia-guide-sections">{GUIDE_SECTIONS.map(section=>{const Icon=GUIDE_ICONS[section.id];return <section id={section.id} key={section.id} className="ia-guide-section" tabIndex={-1} aria-labelledby={section.id+'-title'}>
        <div className="ia-guide-section-heading"><span className="ia-guide-section-symbol"><Icon size={21} aria-hidden="true"/></span><h2 id={section.id+'-title'}>{section.title}</h2></div><p className="ia-guide-description">{section.description}</p>
        <ul className="ia-guide-features">{section.links.map(link=><li key={link.href}><Link to={link.href}>{link.title}</Link><p>{link.description}</p></li>)}</ul>
        <p className="ia-guide-example"><strong>Por ejemplo:</strong> {section.example}</p>
        {'note' in section&&<p className="ia-guide-note">{section.note}</p>}
      </section>;})}</div>
      <section className="ia-guide-finish" aria-labelledby="guide-finish-title"><h2 id="guide-finish-title">Si no encuentras una herramienta</h2><p>Dentro del portal, usa el buscador de la barra superior. Puedes escribir “apuntes”, “mis apoyos”, “tareas” o “acreditación” y entrar directamente.</p><Link className="ia-btn-primary" to={user?'/dashboard':'/register'}>{user?'Elegir mi siguiente paso':'Crear mi cuenta'}</Link></section>
    </main>
    <footer className="ia-footer">InterAula · Aprender juntos, a nuestra manera</footer>
  </div>;
}
