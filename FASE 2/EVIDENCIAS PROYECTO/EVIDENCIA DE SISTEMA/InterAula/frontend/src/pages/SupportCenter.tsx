import {MyMeasuresPanel,CaseModerationPanel} from '../components/support/ModerationPanels';
import {moderationService,type CaseMeasures} from '../services/moderation.service';
import {useEffect,useState,type FormEvent} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supportService} from '../services/support.service';
import {INCIDENT_STATUSES,REPORT_CATEGORIES,REPORT_KINDS,type Inbox,type Incident,type IncidentSummary,type ReportKind,type IncidentAction} from '../types/support';
import '../styles/support.css';

export default function SupportCenter(){
 const [params,setParams]=useSearchParams(),caseId=params.get('case'),kind=params.get('report') as ReportKind|null,target=params.get('target');
 const [tab,setTab]=useState<'inbox'|'mine'|'review'|'measures'>(params.get('tab')==='measures'?'measures':caseId||kind?'mine':'inbox'),[reload,setReload]=useState(0);
 const [inbox,setInbox]=useState<Inbox|null>(null),[cases,setCases]=useState<IncidentSummary[]>([]),[detail,setDetail]=useState<Incident|null>(null),[canReview,setCanReview]=useState(false);
 const [context,setContext]=useState<CaseMeasures|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [category,setCategory]=useState('other'),[description,setDescription]=useState(''),[draft,setDraft]=useState(''),[internal,setInternal]=useState('');
 useEffect(()=>{if(params.get('tab')==='measures')setTab('measures');else if(caseId||kind)setTab('mine');},[caseId,kind,params]);
 useEffect(()=>{setDescription('');setCategory('other');},[kind,target]);
 useEffect(()=>{setDraft('');setInternal('');},[caseId]);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setDetail(null);setContext(null);
  (async()=>{
   if(tab==='measures')return;
   if(tab==='inbox'){const value=await supportService.inbox();if(live){setInbox(value);setCanReview(value.canReview);}}
   else{const [list,one]=await Promise.all([supportService.list(tab==='review'?'review':'mine'),caseId?supportService.detail(caseId):Promise.resolve(null)]);
    if(live){setCases(list.items);setCanReview(list.canReview);setDetail(one);}
    if(caseId){try{const value=await moderationService.context(caseId);if(live)setContext(value);}catch(e:any){if(e.details?.code!=='MODERATION_NOT_READY')throw e;}}}
  })().catch(cause=>{if(live)setError(cause.message||'No pudimos cargar el centro de ayuda.');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[tab,caseId,kind,target,reload]);
 const switchTab=(next:typeof tab)=>{setTab(next);setParams(next==='measures'?{tab:'measures'}:{});setMessage('');setDraft('');setInternal('');};
 const refresh=()=>setReload(value=>value+1);
 async function create(event:FormEvent){
  event.preventDefault();if(!kind||!target||busy)return;setBusy(true);setError('');
  try{const value=await supportService.create({kind,targetId:target,category,description});setParams({case:value.id});setDescription('');setMessage('Tu incidencia quedó registrada. Puedes consultar aquí su seguimiento.');refresh();}
  catch(cause:any){setError(cause.message||'No pudimos registrar el reporte. Conservamos tu texto.');}finally{setBusy(false);}
 }
 async function act(action:IncidentAction,text=draft){
  if(!detail||busy)return;setBusy(true);setError('');
  try{const value=await supportService.act(detail.id,action,text,detail.revision);setDetail(value);setCases(items=>items.map(item=>item.id===value.id?{...item,status:value.status,updatedAt:value.updatedAt}:item));setDraft('');setInternal('');setMessage('La acción quedó registrada en el seguimiento.');window.dispatchEvent(new Event('interaula:inbox-change'));}
  catch(cause:any){setError(cause.message||'No pudimos registrar la acción. Conservamos tu texto.');}finally{setBusy(false);}
 }
 async function read(id?:string){setBusy(true);setError('');try{await supportService.read(id);refresh();window.dispatchEvent(new Event('interaula:inbox-change'));}catch(cause:any){setError(cause.message||'No pudimos marcar el aviso.');}finally{setBusy(false);}}
 const format=(value:string)=>new Date(value).toLocaleString('es-CL');
 return <div className="ia-support">
  <header><p className="ia-support-eyebrow">Seguimiento privado y avisos discretos</p><h1>Avisos y ayuda</h1><p>Revisa lo que requiere tu atención o informa un problema. Los reportes se revisan antes de tomar medidas.</p></header>
  <nav aria-label="Secciones de avisos y ayuda" className="ia-support-tabs">
   <button type="button" aria-pressed={tab==='inbox'} onClick={()=>switchTab('inbox')}>Avisos</button><button type="button" aria-pressed={tab==='mine'} onClick={()=>switchTab('mine')}>Mis incidencias</button>
   <button type="button" aria-pressed={tab==='measures'} onClick={()=>switchTab('measures')}>Mis medidas</button>
   {canReview&&<button type="button" aria-pressed={tab==='review'} onClick={()=>switchTab('review')}>Revisión autorizada</button>}
  </nav>
  {message&&<p role="status" className="ia-support-notice">{message}</p>}
  {error&&<div role="alert" className="ia-support-error"><p>{error}</p><button type="button" disabled={loading||busy} onClick={refresh}>Actualizar seguimiento</button></div>}
  {loading&&<p role="status">Cargando tu seguimiento…</p>}
  {tab==='inbox'&&!loading&&!error&&inbox&&<section aria-labelledby="inbox-title">
   <div className="ia-support-heading"><h2 id="inbox-title">Tu bandeja · {inbox.unreadCount} sin leer</h2><button type="button" disabled={busy||!inbox.unreadCount} onClick={()=>read()}>Marcar todos como leídos</button><button type="button" disabled={busy} onClick={refresh}>Actualizar avisos</button></div>
   <p>Los avisos son silenciosos y no usan destellos. Al abrir la bandeja se comprueban las tutorías de las próximas 24 horas.</p>
   {!inbox.items.length?<p className="ia-support-card">No hay avisos por ahora. Las nuevas solicitudes y cambios aparecerán aquí.</p>:<ul className="ia-support-list">{inbox.items.map(item=><li className="ia-support-card" key={item.id}>
    <div className="ia-support-heading"><h3>{item.title}</h3>{!item.read_at&&<span className="ia-support-tag">Sin leer</span>}<time dateTime={item.created_at}>{format(item.created_at)}</time></div><p>{item.body}</p>
    <div className="ia-support-actions"><Link to={item.href.startsWith('/')&&!item.href.startsWith('//')&&!item.href.includes('\\')?item.href:'/support'}>Ver detalle</Link>{!item.read_at&&<button type="button" disabled={busy} onClick={()=>read(item.id)}>Marcar leído</button>}</div>
   </li>)}</ul>}
   {inbox.items.length===inbox.limit&&<p>Se muestran los {inbox.limit} avisos más recientes. «Marcar todos» incluye también los anteriores.</p>}
  </section>}
  {tab==='measures'&&<MyMeasuresPanel/>}
  {(tab==='mine'||tab==='review')&&<>
   {kind&&target&&Object.hasOwn(REPORT_KINDS,kind)&&<form className="ia-support-card" onSubmit={create} aria-labelledby="report-title">
    <h2 id="report-title">Informar sobre {REPORT_KINDS[kind].toLowerCase()}</h2><p>El reporte original solo lo ves tú y el equipo autorizado. Un revisor preparará el resumen que corresponda compartir.</p>
    <label>Motivo<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(REPORT_CATEGORIES).filter(([key])=>kind==='session'||key!=='no_show').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Qué ocurrió<textarea minLength={20} maxLength={4000} required rows={5} value={description} onChange={e=>setDescription(e.target.value)} aria-describedby="report-help"/></label>
    <p id="report-help">Entre 20 y 4000 caracteres. Comparte los antecedentes necesarios para revisar el caso. No se suspende una cuenta solo por recibir un reporte.</p>
    <button className="ia-btn-primary" type="submit" disabled={busy||description.trim().length<20}>{busy?'Registrando…':'Enviar reporte privado'}</button>
   </form>}
   {!loading&&!error&&<section aria-labelledby="cases-title"><h2 id="cases-title">{tab==='review'?'Cola de revisión':'Tu seguimiento'}</h2>
    <p>Las incidencias sin revisor asignado permanecen pendientes. Las apelaciones requieren una persona distinta de quien resolvió primero.</p>
    {!cases.length?<p>No hay incidencias en esta lista. Para informar un problema, abre la sesión, perfil o contenido y elige «Informar un problema».</p>:<ul className="ia-support-list">{cases.map(item=><li key={item.id}><Link className="ia-support-case-link" to={'/support?case='+item.id}>{REPORT_KINDS[item.targetKind]} · {REPORT_CATEGORIES[item.category]||item.category}<span>{INCIDENT_STATUSES[item.status]}</span></Link></li>)}</ul>}
    {cases.length===100&&<p>Se muestran las 100 incidencias actualizadas más recientemente.</p>}
   </section>}
   {!loading&&detail&&<section className="ia-support-card" aria-labelledby="incident-title">
    <div className="ia-support-heading"><h2 id="incident-title">{REPORT_KINDS[detail.targetKind]} · seguimiento</h2><span className="ia-support-tag">{INCIDENT_STATUSES[detail.status]}</span></div>
    <p>{detail.assigned?'Hay un revisor asignado.':'Pendiente de asignación a un revisor autorizado.'}</p>
    {detail.description&&<div><h3>Reporte original · privado</h3><p className="ia-support-text">{detail.description}</p></div>}
    {detail.sharedSummary&&<div><h3>Resumen compartido por el equipo</h3><p className="ia-support-text">{detail.sharedSummary}</p></div>}
    {detail.resolution&&<div><h3>Resolución comunicada</h3><p className="ia-support-text">{detail.resolution}</p></div>}
    <h3>Historial del seguimiento</h3><ol className="ia-support-timeline">{detail.events.map(event=><li key={event.id}><strong>{event.actor}</strong> · <time dateTime={event.createdAt}>{format(event.createdAt)}</time><p className="ia-support-text">{event.body}</p></li>)}</ol>
    {detail.canClaim&&<button type="button" disabled={busy} onClick={()=>act('claim','')}>Asumir revisión{detail.appealUsed?' de apelación':''}</button>}
    {detail.role!=='reviewer'&&['open','under_review','awaiting_reply','appealed'].includes(detail.status)&&<form onSubmit={e=>{e.preventDefault();void act('reply');}}>
     <label>Antecedentes para el equipo<textarea rows={4} minLength={10} maxLength={4000} required value={draft} onChange={e=>setDraft(e.target.value)}/></label><p>Este mensaje queda privado entre tú y los revisores. No se comparte directamente con la otra persona.</p><button type="submit" disabled={busy||draft.trim().length<10}>Enviar al equipo</button>
    </form>}
    {detail.canAppeal&&!(context?.hasMeasure&&detail.role==='reporter')&&<form onSubmit={e=>{e.preventDefault();void act('appeal');}}><label>Motivo de la apelación<textarea rows={4} required minLength={20} maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)}/></label><p>Puedes apelar una vez. La solicitud quedará pendiente de otro revisor autorizado.</p><button type="submit" disabled={busy||draft.trim().length<20}>Solicitar revisión independiente</button></form>}
    {detail.role==='reviewer'&&detail.assignedToMe&&['under_review','awaiting_reply'].includes(detail.status)&&<>
     <label>Mensaje que se compartirá con las partes<textarea rows={4} maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)}/></label><p>Comparte solo el resumen necesario y una explicación de la decisión. No incluyas la identidad de quien reportó.</p>
     <div className="ia-support-actions">{([['request_reply','Compartir resumen y pedir respuesta'],['resolve','Comunicar resolución'],['close','Cerrar con explicación']] as const).map(([action,label])=><button key={action} type="button" disabled={busy||draft.trim().length<20||!!context?.needsMeasureAppeal&&action!=='request_reply'} onClick={()=>act(action)}>{label}</button>)}</div>
     <label>Nota interna del equipo<textarea rows={3} maxLength={4000} value={internal} onChange={e=>setInternal(e.target.value)}/></label><button type="button" disabled={busy||internal.trim().length<10} onClick={()=>act('note',internal)}>Guardar nota interna</button>
    </>}
    {context&&<CaseModerationPanel key={detail.id+':'+detail.revision} detail={detail} context={context} onChanged={refresh}/>}
   </section>}
  </>}
 </div>;
}
