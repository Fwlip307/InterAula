import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {moderationService,MEASURE_LABELS,type Measure,type MyMeasures,type CaseMeasures} from '../../services/moderation.service';
import type {Incident} from '../../types/support';
const date=(value:string)=>new Date(value).toLocaleString('es-CL');
function MeasureCard({item}:{item:Measure}){
 const active=item.active===true;
 return <article className="ia-support-card"><div className="ia-support-heading"><h3>{MEASURE_LABELS[item.scope]}{item.subjectName?' · '+item.subjectName:''}</h3><span className="ia-support-tag">{item.revokedAt?'Revocada':active?'Vigente':'Finalizada'}</span></div>
  <p>{item.precautionary?'Medida preventiva: no constituye un incumplimiento confirmado ni suma un strike.':'Decisión tras revisión de antecedentes.'}</p>
  <p className="ia-support-text">{item.reason}</p><p>Desde {date(item.startsAt)} · {item.endsAt?'Hasta '+date(item.endsAt):'Sin vencimiento; puedes solicitar revisión independiente.'}</p>
  {item.revocationReason&&<p className="ia-support-text">Motivo de revocación: {item.revocationReason}</p>}
  {item.caseId&&<Link to={'/support?case='+item.caseId}>Ver resolución y opción de apelación</Link>}
 </article>;
}
export function MyMeasuresPanel(){
 const [data,setData]=useState<MyMeasures|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let live=true;setError('');setData(null);moderationService.mine().then(value=>{if(live)setData(value);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[reload]);
 return <section aria-labelledby="my-measures-title"><h2 id="my-measures-title">Mis medidas de convivencia</h2><p>Este seguimiento es privado. Un reporte o una mala nota no suman strikes. Solo cuentan incumplimientos leves confirmados por una persona autorizada.</p>
  <p>En 90 días: primero, advertencia; segundo, 7 días sin ofrecer tutorías; tercero o siguientes, 30 días. Los hechos graves se revisan según su alcance.</p>
  {error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setReload(n=>n+1)}>Reintentar</button></div>:!data?<p role="status">Cargando tus medidas…</p>:<><p className="ia-support-notice"><strong>{data.strikes} {data.strikes===1?'incumplimiento leve confirmado':'incumplimientos leves confirmados'}</strong> en los últimos {data.windowDays} días.</p>
   {data.summary.account&&<p>Tu acceso se mantiene disponible para consultar ayuda y presentar una apelación.</p>}
   {!data.items.length?<p className="ia-support-card">No tienes medidas registradas.</p>:data.items.map(item=><MeasureCard key={item.id} item={item}/>)}
   {data.items.length===100&&<p>Se muestran las 100 medidas más recientes.</p>}
  </>}
 </section>;
}
export function CaseModerationPanel({detail,context,onChanged}:{detail:Incident;context:CaseMeasures;onChanged:()=>void}){
 const [severity,setSeverity]=useState('minor'),[scope,setScope]=useState('tutoring'),[days,setDays]=useState(7),[subjectId,setSubjectId]=useState(''),[reason,setReason]=useState(''),[message,setMessage]=useState('');
 const [duplicateOf,setDuplicateOf]=useState(''),[distinctFact,setDistinctFact]=useState(false),[confirmed,setConfirmed]=useState(false),[outcome,setOutcome]=useState('uphold'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const decisionAllowed=context.canSanction&&detail.assignedToMe&&['under_review','awaiting_reply'].includes(detail.status);
 const appeal=context.needsMeasureAppeal;
 async function submit(event:FormEvent){event.preventDefault();if(!confirmed||busy)return;setBusy(true);setError('');
  try{if(appeal)await moderationService.appeal(detail.id,detail.revision,outcome,reason,message);
   else await moderationService.decide(detail.id,detail.revision,{severity,reason,message,...(duplicateOf?{duplicateOf}:{}),distinctFact,
    ...(severity!=='minor'?{scope,days,...(scope==='subject'?{subjectId}:{})}:{})});
   window.dispatchEvent(new Event('interaula:moderation-change'));window.dispatchEvent(new Event('interaula:inbox-change'));onChanged();
  }catch(e:any){setError(e.message||'No pudimos registrar la decisión.');}finally{setBusy(false);}
 }
 return <section className="ia-moderation-panel" aria-labelledby="case-measures-title"><h3 id="case-measures-title">Medidas de este expediente</h3>
  {context.measures.map(item=><MeasureCard key={item.id} item={item}/>)}
  {context.finding?.overturnedAt&&<p>El incumplimiento confirmado fue revocado en la revisión independiente.</p>}
  {appeal&&!context.canSanction&&detail.role==='reviewer'&&<p>Esta apelación necesita un revisor con permiso para decidir medidas.</p>}
  {decisionAllowed&&(appeal||!context.hasMeasure&&!context.finding)&&<form onSubmit={submit}>
   <h3>{appeal?'Resolver apelación de la medida':'Decidir una medida tras revisar los antecedentes'}</h3>
   <p>Usa la resolución habitual si no se acredita un incumplimiento. Registra aquí solo decisiones justificadas; las notas bajas no son sanciones.</p>
   {appeal?<label>Resultado de la revisión<select value={outcome} onChange={e=>{setOutcome(e.target.value);setConfirmed(false);}}><option value="uphold">Mantener la decisión</option><option value="overturn">Revocar incumplimiento y medida</option></select></label>:<>
    {!!context.relatedFindings.length&&<label>¿Se está revisando un hecho ya confirmado?<select value={duplicateOf} onChange={e=>{setDuplicateOf(e.target.value);setConfirmed(false);}}><option value="">Hecho distinto: evaluar nuevos antecedentes</option>{context.relatedFindings.map(f=><option key={f.id} value={f.id}>{date(f.confirmedAt)} · {f.reason}{f.overturned?' (revocado)':''}</option>)}</select></label>}
    {!duplicateOf&&<><label>Tipo de decisión<select value={severity} onChange={e=>{setSeverity(e.target.value);setDays(7);setConfirmed(false);}}><option value="minor">Incumplimiento leve confirmado</option><option value="serious">Incumplimiento grave confirmado</option><option value="precaution">Protección preventiva temporal · sin strike</option></select></label>
     {severity==='minor'?<p className="ia-support-notice">Se aplicará la escala según hechos distintos confirmados en 90 días: advertencia → 7 días → 30 días sin ofrecer tutorías. El estudiante conserva su acceso al aprendizaje.</p>:<>
      <label>Alcance<select value={scope} onChange={e=>{setScope(e.target.value);setConfirmed(false);}}><option value="tutoring">Ofrecer tutorías y talleres</option><option value="subject">Solo tutorías de una materia</option><option value="community">Publicar e interactuar en comunidad</option>{context.canSuspendAccounts&&<option value="account">Uso de la cuenta · conserva ayuda y apelación</option>}</select></label>
      {scope==='subject'&&<label>Materia acreditada<select required value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">Selecciona una materia</option>{context.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <label>Duración<select value={days} onChange={e=>{setDays(Number(e.target.value));setConfirmed(false);}}><option value={1}>1 día</option><option value={7}>7 días</option>{severity!=='precaution'&&<><option value={30}>30 días</option><option value={0}>Sin vencimiento · revisión mediante apelación</option></>}</select></label>
     </>}
     {detail.targetKind==='profile'&&!!context.relatedFindings.length&&<label className="ia-support-check"><input type="checkbox" checked={distinctFact} onChange={e=>setDistinctFact(e.target.checked)}/>Revisé los antecedentes anteriores y este es un hecho distinto.</label>}
    </>}
    {duplicateOf&&<p>Se vinculará el expediente al hecho anterior. No se añade otro strike ni otra restricción.</p>}
   </>}
   <label>Motivo privado para la persona afectada<textarea required rows={4} minLength={40} maxLength={4000} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label>
   <label>Resolución que recibirán ambas partes<textarea required rows={4} minLength={20} maxLength={4000} value={message} onChange={e=>{setMessage(e.target.value);setConfirmed(false);}}/></label>
   <p>Una restricción que afecte reservas futuras las cancelará y avisará a sus participantes. Revocarla no reactiva esas reservas.</p>
   <label className="ia-support-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>Revisé los hechos, el alcance y la duración. Confirmo esta decisión.</label>
   {error&&<p role="alert">{error}</p>}<button className="ia-btn-primary" type="submit" disabled={busy||!confirmed||reason.trim().length<40||message.trim().length<20}>{busy?'Registrando…':appeal?'Registrar revisión independiente':duplicateOf?'Vincular sin duplicar medida':'Registrar decisión y notificar'}</button>
  </form>}
 </section>;
}
