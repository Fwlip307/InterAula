import {useEffect,useState} from 'react';
import {tutoringService} from '../../../services/tutoring.service';
import type {TutorPriority,TutorModelMetadata,TutorDemo} from '../../../types/tutorRecommendations';
import '../../../styles/tutorRecommendations.css';

interface Props {priority:TutorPriority;onChange:(priority:TutorPriority)=>void;model:TutorModelMetadata|null;loading:boolean}
export default function TutorRecommendationPanel({priority,onChange,model,loading}:Props){
 const [showDemo,setShowDemo]=useState(false),[demo,setDemo]=useState<TutorDemo|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!showDemo)return;
  let live=true;setBusy(true);setError('');setDemo(null);
  tutoringService.getTutorDemo(priority).then(value=>{if(live)setDemo(value);})
   .catch(()=>{if(live)setError('No pudimos cargar el ejemplo. Puedes reintentar; el catálogo real sigue disponible.');})
   .finally(()=>{if(live)setBusy(false);});
  return()=>{live=false;};
 },[showDemo,priority,retry]);
 return <section className="ia-card ia-tutor-matching" aria-labelledby="tutor-matching-title">
  <div className="ia-tutor-matching-top"><div><span className="ia-tutor-matching-label">Apoyo a tu manera</span><h2 id="tutor-matching-title">¿Qué valoras más en una tutoría?</h2><p>Comparamos valoraciones de sesiones finalizadas. Las materias acreditadas y tus filtros siempre se respetan.</p></div>
   <label htmlFor="tutor-priority">Priorizar<select id="tutor-priority" value={priority} onChange={event=>onChange(event.target.value as TutorPriority)}>
    <option value="balanced">Un perfil equilibrado</option><option value="communication">Explicaciones claras</option><option value="knowledge">Dominio del tema</option><option value="punctuality">Puntualidad</option><option value="none">Orden habitual</option>
   </select></label></div>
  <p className="ia-tutor-matching-status" role="status">{loading?'Buscando perfiles para tu preferencia…':model?.description||'Puedes explorar tutores por materia y disponibilidad.'}</p>
  <button type="button" className="ia-btn-secondary" aria-expanded={showDemo} aria-controls="tutor-matching-demo" onClick={()=>setShowDemo(value=>!value)}>{showDemo?'Cerrar ejemplo DEMO':'Probar con datos DEMO'}</button>
  {showDemo&&<div id="tutor-matching-demo" className="ia-tutor-demo" data-kmeans-demo>
   <h3>Ejemplo de agrupación K-Means</h3><p><strong>Datos ficticios.</strong> Estos perfiles no son personas de la comunidad. Cambia la prioridad para comparar el resultado.</p>
   {busy?<p role="status">Calculando el ejemplo…</p>:error?<div role="alert"><p>{error}</p><button type="button" className="ia-btn-secondary" onClick={()=>setRetry(value=>value+1)}>Reintentar ejemplo</button></div>:demo&&<>
    <p role="status">{demo.model.status==='ready'?`Modelo calculado con ${demo.model.trainingCount} perfiles ficticios y ${demo.model.clusterCount} grupos.`:demo.model.description}</p>
    {demo.model.status==='ready'&&<div className="ia-tutor-demo-grid">{demo.profiles.slice(0,3).map(profile=><article key={profile.id}>
     <span className="ia-tutor-matching-label">DEMO · Sin reservas</span><h4>{profile.displayName}</h4>
     <dl><div><dt>Comunicación</dt><dd>{profile.scores[0].toFixed(1)} / 10</dd></div><div><dt>Dominio</dt><dd>{profile.scores[1].toFixed(1)} / 10</dd></div><div><dt>Puntualidad</dt><dd>{profile.scores[2].toFixed(1)} / 10</dd></div></dl>
    </article>)}</div>}
   </>}
  </div>}
 </section>;
}
