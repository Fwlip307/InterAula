import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { recommendationsService } from '../../services/recommendations.service';
import { ApiError } from '../../lib/apiClient';
import type { InterestIntent, InterestPreferences as Preferences, InterestTopic } from '../../types/recommendations';
import '../../styles/recommendations.css';

const intentLabels: Record<InterestIntent,string> = {interest:'Me interesa',learn:'Quiero aprender',teach:'Puedo compartir'};
const normalize = (text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();

export default function InterestPreferences() {
  const [topics,setTopics]=useState<InterestTopic[]>([]);
  const [preferences,setPreferences]=useState<Preferences|null>(null);
  const [routeParams,setRouteParams]=useSearchParams();
  const requestedIntent=routeParams.get('intent');
  const intentControls=useRef<HTMLDivElement>(null);
  const intent:InterestIntent=requestedIntent==='learn'||requestedIntent==='teach'?requestedIntent:'interest';
  const setIntent=(value:InterestIntent)=>setRouteParams(current=>{
    const next=new URLSearchParams(current);next.set('tab','interests');next.set('intent',value);return next;
  },{replace:true});
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [reload,setReload]=useState(0);
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{
    if(loading||!['interest','learn','teach'].includes(requestedIntent||''))return;
    intentControls.current?.scrollIntoView({block:'start'});
    intentControls.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({preventScroll:true});
  },[requestedIntent,loading]);
  useEffect(()=>{
    let live=true;
    Promise.all([recommendationsService.getTopics(),recommendationsService.getPreferences()])
      .then(([catalog,saved])=>{if(live){setTopics(catalog);setPreferences(saved);setDirty(false);}})
      .catch(cause=>{if(live)setError(cause instanceof ApiError&&cause.details?.code==='RECOMMENDATIONS_NOT_READY'
        ?'La selección de intereses aún no está habilitada. Puedes seguir usando el resto de InterAula.'
        :'No pudimos cargar tus intereses. Reintenta para editar tu selección.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[reload]);
  function toggleTopic(id:string) {
    if(!preferences||saving)return;
    const chosen=preferences[intent];
    if(!chosen.includes(id)&&chosen.length>=12)return;
    setPreferences({...preferences,[intent]:chosen.includes(id)?chosen.filter(topic=>topic!==id):[...chosen,id]});
    setDirty(true);setMessage('');
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!preferences||saving)return;
    setSaving(true);setError('');setMessage('');
    try {
      const saved=await recommendationsService.savePreferences(preferences);
      setPreferences(saved);setDirty(false);setMessage('Tus intereses quedaron guardados. Ya puedes ver tus sugerencias.');
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'No pudimos guardar tus intereses. Tu selección sigue aquí.');
    } finally { setSaving(false); }
  }
  const visible=topics.filter(topic=>normalize([topic.name,topic.category,...topic.aliases].join(' ')).includes(normalize(search.trim())));
  return <section className="ia-interests" aria-labelledby="interest-title" aria-busy={loading||saving}>
    <header className="ia-reco-heading">
      <div><p className="ia-reco-eyebrow">Un espacio que se adapta a ti</p><h2 id="interest-title">Mis intereses</h2>
        <p>Elige temas para descubrir apuntes, proyectos y personas con quienes aprender. Puedes cambiarlos cuando quieras.</p></div>
      <Link className="ia-btn-secondary" to="/dashboard#para-ti">Ver «Para ti»</Link>
    </header>
    {loading&&<p role="status">Cargando tus intereses…</p>}
    {error&&<div className="ia-reco-error" role="alert"><p>{error}</p>
      {!preferences&&<button type="button" className="ia-btn-secondary" onClick={()=>{setLoading(true);setError('');setMessage('');setReload(value=>value+1);}}>Reintentar</button>}</div>}
    {!loading&&preferences&&<form onSubmit={save}>
      <fieldset disabled={saving} className="ia-interest-settings">
        <legend>Tu personalización</legend>
        <label><input type="checkbox" checked={preferences.personalization_enabled} onChange={event=>{
          setPreferences({...preferences,personalization_enabled:event.target.checked});setDirty(true);setMessage('');
        }}/> Usar mis intereses y materias a reforzar para recomendarme contenido</label>
        <p>Si la desactivas, «Para ti» mostrará novedades generales. Conservaremos tu selección.</p>
        <label><input type="checkbox" checked={preferences.discoverable} onChange={event=>{
          setPreferences({...preferences,discoverable:event.target.checked});setDirty(true);setMessage('');
        }}/> Compartir estos temas para que otras personas puedan encontrar mi perfil</label>
        <p>Es opcional. Solo se comparten los temas seleccionados cuando la personalización está activa; no tus datos de contacto ni preferencias de accesibilidad.</p>
      </fieldset>
      <div ref={intentControls} className="ia-interest-intents" aria-label="Qué quieres expresar con estos temas">
        {(Object.keys(intentLabels) as InterestIntent[]).map(value=><button key={value} type="button" aria-pressed={intent===value}
          className="ia-btn-secondary" onClick={()=>setIntent(value)}>{intentLabels[value]} <span>{preferences[value].length}/12</span></button>)}
      </div>
      <label className="ia-interest-search">Buscar un tema<input type="search" value={search} placeholder="Python, diseño, matemáticas…" onChange={event=>setSearch(event.target.value)}/></label>
      <fieldset className="ia-interest-topics" disabled={saving}>
        <legend>{intentLabels[intent]} · {preferences[intent].length} de 12 temas</legend>
        {intent==='teach'&&<p>Son conocimientos que puedes compartir. La acreditación para tutorías se gestiona por separado en tu perfil.</p>}
        <div className="ia-interest-grid">{visible.map(topic=><label key={topic.id} className={preferences[intent].includes(topic.id)?'is-selected':''}>
          <input type="checkbox" checked={preferences[intent].includes(topic.id)} onChange={()=>toggleTopic(topic.id)}
            disabled={!preferences[intent].includes(topic.id)&&preferences[intent].length>=12}/>
          <span>{topic.name}<small>{topic.category}</small></span>
        </label>)}</div>
        {visible.length===0&&<p>No encontramos ese tema. Prueba otro nombre.</p>}
      </fieldset>
      <div className="ia-interest-actions"><button className="ia-btn-primary" type="submit" disabled={saving||(!dirty&&preferences.revision>0)}>
        {saving?'Guardando…':'Guardar mis intereses'}</button><span>{dirty?'Tienes cambios sin guardar.':'Puedes elegir hasta 12 temas por apartado.'}</span></div>
      {message&&<p className="ia-reco-success" role="status">{message} <Link to="/dashboard#para-ti">Ir a mis sugerencias</Link></p>}
    </form>}
  </section>;
}
