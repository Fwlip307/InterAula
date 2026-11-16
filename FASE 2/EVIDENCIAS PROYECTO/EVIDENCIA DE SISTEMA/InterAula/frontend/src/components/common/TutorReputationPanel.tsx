import {useEffect,useState} from 'react';
import {tutoringService} from '../../services/tutoring.service';
import type {ReputationResult} from '../../types/reputation';
import '../../styles/reputation.css';

export default function TutorReputationPanel({profileId,own=false}:{profileId:string;own?:boolean}){
 const [result,setResult]=useState<ReputationResult|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setResult(null);
  tutoringService.getReputation(profileId).then(value=>{if(live)setResult(value);})
   .catch(()=>{if(live)setError('No pudimos cargar la reputación reciente. Puedes reintentar.');})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[profileId,retry]);
 const reputation=result?.reputation,policy=result?.policy;
 return <section className="ia-card ia-reputation" aria-labelledby={`reputation-${profileId}`} aria-busy={loading}>
  <h3 id={`reputation-${profileId}`}>Trayectoria y calidad reciente</h3>
  <p>Las materias acreditadas indican qué puede enseñar. La trayectoria reconoce sesiones realizadas; la calidad refleja valoraciones recientes.</p>
  {loading?<p role="status">Consultando reputación…</p>:error?<div role="alert"><p>{error}</p><button className="ia-btn-secondary" type="button" onClick={()=>setRetry(value=>value+1)}>Reintentar reputación</button></div>:
   result?.status==='activation_required'?<p role="status">La reputación verificable todavía necesita activarse. Las acreditaciones y los reconocimientos anteriores se conservan.</p>:
   reputation&&policy?<>
    <div className="ia-reputation-totals"><span><strong>{reputation.valid_sessions}</strong> sesiones validadas</span><span><strong>{reputation.legacy_sessions}</strong> sesiones históricas</span>
     <span><strong>{reputation.recent_reviews}</strong> reseñas de <strong>{reputation.recent_reviewers}</strong> estudiantes · últimos {policy.windowDays} días</span></div>
    <div className="ia-reputation-grid">{([
     ['Comunicación',reputation.communication_average,reputation.communication_adjusted,reputation.communication_highlight],
     ['Dominio del tema',reputation.knowledge_average,reputation.knowledge_adjusted,reputation.knowledge_highlight],
     ['Puntualidad',reputation.punctuality_average,reputation.punctuality_adjusted,reputation.punctuality_highlight],
    ] as const).map(([label,average,adjusted,active])=><article key={label}>
     <h4>{label}</h4><p>{average===null?'Sin reseñas recientes':`${Number(average).toFixed(1)} / 10`}</p>
     {active?<span className="ia-reputation-highlight">Reconocimiento de calidad activo</span>:<span className="ia-reputation-neutral">{reputation.recent_reviews<policy.minReviews||reputation.recent_reviewers<policy.minReviewers?'Aún sin muestra suficiente':'Sin reconocimiento activo en este período'}</span>}
     {adjusted!==null&&<small>Puntuación ajustada: {Number(adjusted).toFixed(2)} / 10</small>}
    </article>)}</div>
    <p className="ia-reputation-policy">Cómo se calcula: al menos {policy.minReviews} reseñas de {policy.minReviewers} estudiantes en {policy.windowDays} días y puntuación ajustada ≥ {policy.threshold}. Ajuste: (suma de notas + {policy.priorMean*policy.priorWeight}) ÷ (reseñas + {policy.priorWeight}), con una base de {policy.priorMean}/10 para moderar muestras pequeñas. Esa base no añade reseñas reales.</p>
    <p className="ia-reputation-policy">Los reconocimientos de calidad se recalculan y pueden dejar de estar activos. Una nota baja no borra la trayectoria ni suspende la cuenta. Las sesiones históricas sin evidencia nueva no cuentan para estos reconocimientos.</p>
    {own&&reputation.recent_reviews>0&&<p className="ia-reputation-coach">Revisa cada criterio y los comentarios de tus sesiones para elegir qué mejorar. Los apoyos y la acreditación de materias se gestionan por separado.</p>}
   </>:<p>Todavía no hay reputación registrada para este perfil.</p>}
 </section>;
}
