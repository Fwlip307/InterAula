import {useEffect,useState} from 'react';
import {recommendationsService} from '../../services/recommendations.service';
import {RECOMMENDATION_KIND_LABELS,type InterestDemo} from '../../types/recommendations';

export default function InterestDemoPanel(){
 const [open,setOpen]=useState(false),[focus,setFocus]=useState<'data'|'web'|'business'>('data'),[scope,setScope]=useState<'all'|'campus'|'nearby'>('all');
 const [data,setData]=useState<InterestDemo|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!open)return;
  let live=true;setLoading(true);setError('');setData(null);
  recommendationsService.getDemo(focus,scope).then(result=>{if(live)setData(result);})
   .catch(()=>{if(live)setError('No pudimos cargar el ejemplo. Tus sugerencias reales siguen disponibles.');})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[open,focus,scope,retry]);
 return <div className="ia-interest-demo">
  <button type="button" className="ia-reco-text-button" aria-expanded={open} aria-controls="interest-demo" onClick={()=>setOpen(value=>!value)}>{open?'Cerrar ejemplo de intereses':'Probar ejemplo de intereses y cercanía'}</button>
  {open&&<section id="interest-demo" aria-labelledby="interest-demo-title" aria-busy={loading}>
   <h3 id="interest-demo-title">Prueba cómo cambian las sugerencias</h3>
   <p><strong>Datos ficticios.</strong> Este ejemplo no cambia tus intereses ni tu comunidad y no permite contactar o reservar perfiles.</p>
   <div className="ia-interest-demo-controls">
    <label>Temas del ejemplo<select value={focus} onChange={e=>setFocus(e.target.value as typeof focus)}><option value="data">Python y análisis de datos</option><option value="web">Desarrollo web y diseño</option><option value="business">Marketing y administración</option></select></label>
    <label>Comunidad del ejemplo<select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="all">Toda la comunidad</option><option value="campus">Solo la misma sede</option><option value="nearby">Sedes de la misma comuna</option></select></label>
   </div>
   {loading?<p role="status">Agrupando los temas del ejemplo…</p>:error?<div role="alert"><p>{error}</p><button type="button" className="ia-btn-secondary" onClick={()=>setRetry(value=>value+1)}>Reintentar ejemplo</button></div>:data&&<>
    <p role="status">{data.matching.description} {data.matching.status==='ready'&&`K-Means: ${data.matching.trainingCount} perfiles ficticios, ${data.matching.clusterCount} grupos.`}</p>
    <p className="ia-community-hint">Referencia ficticia: {data.reference.institution}, {data.reference.campus} · {data.reference.commune}.</p>
    <div className="ia-reco-grid">{data.items.slice(0,6).map(item=><article key={`${item.kind}:${item.id}`} className="ia-reco-card">
     <span className="ia-reco-kind">DEMO · {RECOMMENDATION_KIND_LABELS[item.kind]}</span><h4>{item.title}</h4><p>{item.reason}</p>
     {item.clusterReason&&<p className="ia-reco-cluster">{item.clusterReason}</p>}{item.communityReason&&<p className="ia-reco-community">{item.communityReason}</p>}
    </article>)}</div>
   </>}
  </section>}
 </div>;
}
