import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {recommendationsService} from '../services/recommendations.service';
import {getAllInstitutions} from '../data/institutionsAndCareers';
import type {AcademicCommunity as CommunityState,CommunityPreferences} from '../types/recommendations';
import '../styles/recommendations.css';

const institutions=getAllInstitutions();
const scopes=[['all','Toda la comunidad','Explora todas las instituciones; las coincidencias académicas tienen prioridad.'],
  ['institution','Mi institución','Personas y publicaciones vinculadas a la institución elegida.'],
  ['campus','Mi sede','Coincidencias de la misma institución y sede.'],
  ['nearby','Cerca de mi sede','Sedes de cualquier institución en la misma comuna y región.']] as const;
export default function AcademicCommunity() {
  const [state,setState]=useState<CommunityState|null>(null);
  const [draft,setDraft]=useState<CommunityPreferences|null>(null);
  const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let live=true;setError('');
    recommendationsService.getCommunity().then(value=>{if(live){setState(value);setDraft(value.preferences);}})
      .catch(()=>{if(live)setError('No pudimos cargar tu comunidad. Puedes reintentar.');});
    return()=>{live=false;};
  },[retry]);
  const institution=institutions.find(i=>i.id===draft?.institutionId);
  const campus=institution?.sedes?.find(s=>s.id===draft?.campusId);
  const patch=(value:Partial<CommunityPreferences>)=>{setDraft(current=>current?{...current,...value}:current);setMessage('');setError('');};
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!draft||saving)return;
    setSaving(true);setError('');setMessage('');
    try {const value=await recommendationsService.saveCommunity(draft);setState(value);setDraft(value.preferences);setMessage('Guardamos tu comunidad. Tus intereses se mantienen.');}
    catch(cause){setError(cause instanceof Error?cause.message:'No se pudo guardar. Tu selección sigue aquí.');}
    finally{setSaving(false);}
  }
  return <main className="ia-community-page">
    <Link to="/dashboard#para-ti">← Volver a Para ti</Link>
    <header><p className="ia-reco-eyebrow">Aprender en comunidad</p><h1>Mi comunidad académica</h1>
      <p>Elige dónde quieres encontrar apoyo, personas y proyectos. Primero buscamos coincidencias con lo que quieres aprender.</p></header>
    {error&&<div className="ia-reco-error" role="alert">{error} {!state&&<button type="button" onClick={()=>setRetry(v=>v+1)}>Reintentar</button>}</div>}
    {!state&&!error&&<p role="status">Cargando tu comunidad…</p>}
    {state?.activationRequired&&<p role="status">Las preferencias de comunidad todavía no están habilitadas. Puedes seguir explorando todas las publicaciones.</p>}
    {draft&&<form className="ia-for-you" onSubmit={save}>
      <fieldset disabled={saving} className="ia-community-fields"><legend>Tu referencia académica</legend>
        <label>Institución<select value={draft.institutionId||''} onChange={e=>patch({institutionId:e.target.value||null,campusId:null,scope:'all'})}>
          <option value="">Sin institución de referencia</option>{institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <label>Sede<select value={draft.campusId||''} disabled={!institution} onChange={e=>patch({campusId:e.target.value||null,scope:!e.target.value?'all':draft.scope})}>
          <option value="">Todas las sedes</option>{institution?.sedes?.map(s=><option key={s.id} value={s.id}>{s.name}{s.comuna?' · '+s.comuna:''}</option>)}</select></label>
      </fieldset>
      <p className="ia-community-hint">Esta referencia es privada y no cambia la institución de tu perfil público. {campus?.comuna&&<>Buscaremos cerca de <strong>{campus.comuna}, {campus.region}</strong>.</>}</p>
      <fieldset disabled={saving} className="ia-community-scopes"><legend>Dónde buscar</legend>
        {scopes.map(([value,label,description])=><label key={value} className={draft.scope===value?'is-selected':''}>
          <input type="radio" name="community-scope" value={value} checked={draft.scope===value}
            disabled={value==='institution'?!institution:value==='campus'?!campus:value==='nearby'?!campus?.comuna:false}
            onChange={()=>patch({scope:value})}/><span><strong>{label}</strong><small>{description}</small></span></label>)}
      </fieldset>
      <label className="ia-community-mode">Modalidad de las actividades<select value={draft.modality} onChange={e=>patch({modality:e.target.value as CommunityPreferences['modality']})}>
        <option value="any">Todas las modalidades</option><option value="online">Online</option><option value="in_person">Presencial</option><option value="hybrid">Híbrida</option>
      </select></label>
      <p className="ia-community-hint">La modalidad se aplica a las actividades que la indican. Confirma con cada persona cómo puede participar. La cercanía corresponde a la comuna de una sede: no indica kilómetros ni tu ubicación actual.</p>
      <button type="submit" className="ia-btn-primary" disabled={saving||state?.activationRequired}>{saving?'Guardando…':'Guardar mi comunidad'}</button>
      {message&&<p className="ia-reco-success" role="status">{message} <Link to="/dashboard#para-ti">Ver mis recomendaciones</Link></p>}
    </form>}
  </main>;
}
