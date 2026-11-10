import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { recommendationsService } from '../../services/recommendations.service';
import { ApiError } from '../../lib/apiClient';
import { RECOMMENDATION_KIND_LABELS, type RecommendationFeed, type RecommendationItem, type RecommendationKind } from '../../types/recommendations';
import '../../styles/recommendations.css';

export default function ForYouSection() {
  const {hash}=useLocation();
  const [data,setData]=useState<RecommendationFeed|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notReady,setNotReady]=useState(false);
  const [actionError,setActionError]=useState('');
  const [busy,setBusy]=useState(false);
  const [hidden,setHidden]=useState<RecommendationItem|null>(null);
  const [message,setMessage]=useState('');
  const [kind,setKind]=useState<RecommendationKind|'all'>('all');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(hash==='#para-ti') {
      const section=document.getElementById('para-ti');
      section?.scrollIntoView({block:'start'});section?.focus({preventScroll:true});
    }
  },[hash]);
  useEffect(()=>{
    let live=true;
    recommendationsService.getFeed().then(feed=>{if(live){setData(feed);setNotReady(false);}})
      .catch(cause=>{if(live){
        const setupPending=cause instanceof ApiError&&cause.details?.code==='RECOMMENDATIONS_NOT_READY';
        setNotReady(setupPending);
        setError(setupPending?'Las sugerencias aún no están activadas. Puedes seguir explorando apuntes, proyectos y tutorías. No necesitas elegir intereses para resolver este aviso.'
          :'No pudimos cargar tus sugerencias. Puedes reintentar o explorar la comunidad.');
      }})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[reload]);
  async function dismiss(item:RecommendationItem) {
    if(busy||loading)return;setBusy(true);setActionError('');
    try {
      await recommendationsService.dismiss(item.kind,item.id);
      setData(current=>current?{...current,items:current.items.filter(entry=>entry.kind!==item.kind||entry.id!==item.id),hiddenCount:current.hiddenCount+1}:current);
      setHidden(item);setMessage(`Ocultaste «${item.title}».`);setLoading(true);setReload(value=>value+1);
    } catch {setActionError('No se pudo ocultar la sugerencia. Intenta nuevamente.');}
    finally {setBusy(false);}
  }
  async function restore(all=false) {
    if(busy||loading)return;setBusy(true);setActionError('');
    try {
      if(all)await recommendationsService.restoreAll();
      else if(hidden)await recommendationsService.restore(hidden.kind,hidden.id);
      setHidden(null);setMessage(all?'Restauraste las sugerencias ocultas.':'La sugerencia volverá a estar disponible.');setLoading(true);setReload(value=>value+1);
    } catch {setActionError('No se pudieron restaurar las sugerencias. Intenta nuevamente.');}
    finally {setBusy(false);}
  }
  const items=data?.items.filter(item=>kind==='all'||item.kind===kind)||[];
  return <section id="para-ti" className="ia-for-you" tabIndex={-1} aria-labelledby="for-you-title" aria-busy={loading}>
    <header className="ia-reco-heading"><div><p className="ia-reco-eyebrow">Descubre tu próxima oportunidad</p><h2 id="for-you-title">Para ti</h2>
      <p>{data?.mode==='personalized'?'Contenidos y personas relacionados con lo que te interesa aprender y compartir.'
        :data?.mode==='disabled'?'La personalización está desactivada. Estas son novedades de la comunidad.'
        :error?'Explora los recursos y las personas de la comunidad mientras se habilitan las sugerencias.'
        :'Empieza explorando novedades o elige tus intereses para recibir sugerencias más cercanas a ti.'}</p></div>
      {!notReady&&<Link className="ia-btn-secondary" to="/profile?tab=interests">{data?.mode==='starter'?'Elegir mis intereses':'Ajustar mis intereses'}</Link>}</header>
    <nav className="ia-reco-explore" aria-label="Explorar toda la comunidad"><span>Explorar todo:</span>
      <Link to="/resources">Apuntes</Link><Link to="/forum">Foro</Link><Link to="/projects">Proyectos</Link><Link to="/tutoring">Tutorías y talleres</Link></nav>
    {(error||actionError)&&<div className="ia-reco-error" role="alert"><p>{error||actionError}</p>{error&&<button type="button" className="ia-btn-secondary" disabled={loading} onClick={()=>{setLoading(true);setError('');setReload(value=>value+1);}}>Reintentar</button>}</div>}
    {message&&<div className="ia-reco-notice" role="status">{message} {hidden&&<button type="button" onClick={()=>restore()} disabled={busy||loading}>Deshacer</button>}</div>}
    {loading&&<p role="status">Buscando sugerencias…</p>}
    {data&&!error&&<>
      <div className="ia-reco-toolbar"><label>Mostrar <select value={kind} onChange={event=>setKind(event.target.value as RecommendationKind|'all')}>
        <option value="all">Todas las sugerencias</option>{(Object.entries(RECOMMENDATION_KIND_LABELS) as [RecommendationKind,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>{data.hiddenCount>0&&<button type="button" className="ia-reco-text-button" disabled={busy||loading} onClick={()=>restore(true)}>Restaurar sugerencias ocultas ({data.hiddenCount})</button>}</div>
      <div className="ia-reco-grid">{items.map(item=><article key={`${item.kind}:${item.id}`} className="ia-reco-card">
        <span className={`ia-reco-kind ia-reco-kind-${item.kind}`}>{RECOMMENDATION_KIND_LABELS[item.kind]}</span>
        <h3><Link to={item.href}>{item.title}</Link></h3>{item.summary&&<p className="ia-reco-summary">{item.summary}</p>}
        <p className="ia-reco-reason">{item.reason}</p>
        <div className="ia-reco-card-footer"><Link to={item.href}>{item.kind==='person'?'Ver perfil':'Ver detalle'} <span aria-hidden="true">→</span></Link>
          <button type="button" className="ia-reco-text-button" disabled={busy||loading} onClick={()=>dismiss(item)} aria-label={`No me interesa: ${item.title}`}>No me interesa</button></div>
      </article>)}</div>
      {!loading&&items.length===0&&<div className="ia-reco-empty"><h3>{kind==='all'?'Todavía no hay coincidencias disponibles':'No hay sugerencias de este tipo'}</h3>
        <p>Prueba otros temas, restaura sugerencias ocultas o explora todas las publicaciones.</p>
        <Link to="/profile?tab=interests" className="ia-btn-secondary">Revisar mis intereses</Link></div>}
    </>}
  </section>;
}
