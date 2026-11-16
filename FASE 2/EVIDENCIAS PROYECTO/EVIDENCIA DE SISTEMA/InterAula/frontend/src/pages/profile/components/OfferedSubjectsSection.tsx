import type {OfferedSubject} from '../../../types/profile';
import {BookOpenIcon,ShieldCheckIcon} from '../../../components/common/Icons';
import {formatAcademicLevel} from '../../../utils/formatters';

export default function OfferedSubjectsSection({offeredSubjects}:{offeredSubjects:OfferedSubject[]}) {
 const accredited=offeredSubjects.filter(subject=>subject.is_verified===true);
 return <section className="ia-form-section ia-accredited-subjects" id="offered-subjects">
  <div className="ia-accredited-subjects-heading"><BookOpenIcon size={20}/><h2>Materias habilitadas para impartir ({accredited.length})</h2></div>
  <p>Solo aparecen las materias aprobadas mediante evaluación o revisión de respaldo académico.</p>
  {accredited.length?<ul>{accredited.map(item=><li key={item.subject_id}>
   <div><strong>{item.subject?.name||'Asignatura acreditada'}</strong><span className="ia-badge ia-badge-success"><ShieldCheckIcon size={13}/> Acreditada</span></div>
   <span>{formatAcademicLevel(item.level)}</span>
  </li>)}</ul>:<div className="ia-accreditation-empty">Todavía no tienes materias acreditadas. Usa las opciones de acreditación de esta página; al aprobar aparecerán aquí.</div>}
 </section>;
}
