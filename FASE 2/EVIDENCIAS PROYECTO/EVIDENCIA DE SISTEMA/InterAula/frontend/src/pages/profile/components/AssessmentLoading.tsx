import { ShieldCheckIcon } from '../../../components/common/Icons';

export default function AssessmentLoading({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <section className="ia-assess-stage-card" role="status" aria-live="polite">
      <span className="ia-assess-stage-icon" aria-hidden="true">
        <ShieldCheckIcon size={30} />
      </span>
      <h3>{title}</h3>
      <p>
        {detail ||
          'Estamos preparando preguntas nuevas y verificables para tu asignatura. Esto puede tomar unos segundos.'}
      </p>
      <div className="ia-assess-progress-track" style={{ maxWidth: '320px' }} aria-hidden="true">
        <div className="ia-assess-progress-fill" style={{ width: '58%' }} />
      </div>
    </section>
  );
}
