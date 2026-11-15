import { Link } from 'react-router-dom';
import type { LearningPath, StudyTask } from '../../types/learningSpace';
import { nextStudyStep } from '../../navigation/guidedNavigation';
import '../../styles/guidedExperience.css';

export default function GuidedStudyStart({ paths, tasks }: { paths: LearningPath[]; tasks: StudyTask[] }) {
  const next = nextStudyStep(paths, tasks);
  return <div className="ia-guided-stack">
    <section className="ia-guided-next" aria-labelledby="study-next-title">
      <span className="ia-guided-eyebrow">Un paso a la vez</span>
      <h2 id="study-next-title">{next.title}</h2>
      <p>{next.detail}</p>
      <Link className="ia-btn-primary" to={next.href}>{next.action} →</Link>
    </section>
    <div className="ia-guided-options">
      <Link className="ia-guided-option" to="/learning-space?tab=explain"><strong>Entender un tema</strong><span>Explicaciones con ejemplos y pasos cortos.</span></Link>
      <Link className="ia-guided-option" to="/learning-space?tab=adaptive"><strong>Practicar a mi ritmo</strong><span>Ruta adaptativa · piloto de Cálculo, sin cronómetro.</span></Link>
      <Link className="ia-guided-option" to="/learning-space?tab=profile"><strong>Ajustar mis apoyos</strong><span>Elige cómo prefieres estudiar y recibir ayuda.</span></Link>
    </div>
  </div>;
}

