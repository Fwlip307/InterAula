import {ShieldCheckIcon} from '../../../components/common/Icons';

export default function AssessmentLoading({title}:{title:string}) {
 return <section className="ia-assessment-stage ia-assessment-loading" role="status" aria-live="polite">
  <span className="ia-assessment-loader" aria-hidden="true"><ShieldCheckIcon size={28}/></span>
  <h3>{title}</h3>
  <p>Un momento. Estamos preparando el siguiente paso.</p>
 </section>;
}
