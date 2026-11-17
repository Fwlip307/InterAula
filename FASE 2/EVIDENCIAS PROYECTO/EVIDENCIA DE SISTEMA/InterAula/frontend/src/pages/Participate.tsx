import { lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BriefcaseIcon, MessageSquareIcon } from '../components/common/Icons';
import '../styles/guidedExperience.css';

const Forum = lazy(() => import('./forum/Forum'));
const ProjectsHub = lazy(() => import('./projects/ProjectsHub'));

type CommunityTab = 'forum' | 'projects';

export default function Participate() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: CommunityTab = searchParams.get('tab') === 'projects' ? 'projects' : 'forum';

  const handleSelectTab = (tab: CommunityTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="ia-guided-page ia-community-shell">
      <header className="ia-community-header">
        <div>
          <h1 className="ia-page-title">Comunidad</h1>
          <p className="ia-page-subtitle">
            Participa en el Foro Académico o colabora en equipos dentro del Hub de Proyectos.
          </p>
        </div>

        <div className="ia-community-tabs" role="tablist" aria-label="Apartados de Comunidad">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'forum'}
            className={`ia-community-tab ${activeTab === 'forum' ? 'active' : ''}`}
            onClick={() => handleSelectTab('forum')}
          >
            <MessageSquareIcon size={16} />
            <span>Foro Académico</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'projects'}
            className={`ia-community-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => handleSelectTab('projects')}
          >
            <BriefcaseIcon size={16} />
            <span>Hub de Proyectos</span>
          </button>
        </div>
      </header>

      <div className="ia-community-panel" role="tabpanel">
        <Suspense
          fallback={
            <div className="ia-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--ia-text-muted)' }}>
              Cargando apartado de comunidad...
            </div>
          }
        >
          {activeTab === 'forum' ? <Forum /> : <ProjectsHub />}
        </Suspense>
      </div>

      <section aria-labelledby="community-preferences-title" className="ia-community-footer-bar">
        <h2 id="community-preferences-title" className="ia-guided-section-title" style={{ marginBottom: '8px' }}>
          Mi institución y mis intereses
        </h2>
        <div className="ia-guided-inline" style={{ padding: 0 }}>
          <Link to="/community">Ajustar institución y cercanía</Link>
          <Link to="/profile?tab=interests">Elegir mis intereses</Link>
          <Link to="/dashboard#para-ti">Ver mis recomendaciones</Link>
        </div>
      </section>
    </div>
  );
}
