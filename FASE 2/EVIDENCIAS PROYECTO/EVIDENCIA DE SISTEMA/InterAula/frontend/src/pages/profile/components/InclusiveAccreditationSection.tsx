import {useEffect,useState} from 'react';
import {verificationService} from '../../../services/verification.service';
import type {InclusiveTutorAccreditation,InclusiveVerificationChecks} from '../../../types/tutoring';
import {ShieldCheckIcon} from '../../../components/common/Icons';

const EMPTY_CHECKS:InclusiveVerificationChecks={identity_matches:false,issuer_verified:false,training_relevant:false,practical_passed:false};
const CHECK_LABELS:Record<keyof InclusiveVerificationChecks,string>={
 identity_matches:'El certificado corresponde a la persona solicitante',
 issuer_verified:'Verifiqué la autenticidad con el emisor y el código del certificado',
 training_relevant:'La formación es pertinente al acompañamiento inclusivo universitario',
 practical_passed:'El caso propone apoyos concretos, respeta la autonomía y los límites del rol académico',
};
const STATUS={pending:'Pendiente de revisión',approved:'Aprobada',rejected:'Requiere correcciones',revoked:'Revocada'};

function EvidenceLinks({item}:{item:InclusiveTutorAccreditation}) {
 const [link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setLink('');},[item.document_path]);
 useEffect(()=>{if(!link)return;const timer=setTimeout(()=>setLink(''),110_000);return()=>clearTimeout(timer);},[link]);
 return <div className="ia-inclusive-evidence-links">
  {item.verification_url?.startsWith('https://')&&<a href={item.verification_url} target="_blank" rel="noopener noreferrer">Verificación del emisor ↗</a>}
  {item.document_path&&(link?<a href={link} target="_blank" rel="noopener noreferrer" onClick={()=>setTimeout(()=>setLink(''),1000)}>Abrir PDF privado ↗</a>:<button type="button" className="ia-btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{setLink(await verificationService.inclusiveEvidenceUrl(item.document_path!));}catch(cause){setError(cause instanceof Error?cause.message:'No se pudo abrir el documento.');}finally{setBusy(false);}}}>{busy?'Preparando PDF…':'Consultar certificado privado'}</button>)}
  {error&&<p role="alert">{error}</p>}
 </div>;
}

function Review({item,onUpdated}:{item:InclusiveTutorAccreditation;onUpdated:(item:InclusiveTutorAccreditation)=>void}) {
 const [checks,setChecks]=useState<InclusiveVerificationChecks>(EMPTY_CHECKS),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function decide(status:'approved'|'rejected'|'revoked'){
  setBusy(true);setError('');
  try {onUpdated(await verificationService.reviewInclusiveAccreditation(item.id,{status,reviewer_notes:notes,verification_checks:checks,expected_updated_at:item.updated_at}));}
  catch(cause){setError(cause instanceof Error?cause.message:'No se pudo guardar el dictamen.');}finally{setBusy(false);}
 }
 return <article className="ia-inclusive-review">
  <h4>{item.profile?.display_name||[item.profile?.first_name,item.profile?.last_name].filter(Boolean).join(' ')||'Solicitante'} · {STATUS[item.status]}</h4>
  <p><strong>{item.training_name}</strong> · {item.issuer_name||'Emisor pendiente'}</p>
  <p>Código: {item.credential_code||'Sin respaldo verificable'} · Finalización: {item.completed_on||'Sin fecha'}</p>
  <EvidenceLinks item={item}/>
  <details><summary>Leer caso práctico</summary><p className="ia-inclusive-case">{item.evidence_notes}</p></details>
  {item.status!=='approved'&&<fieldset disabled={busy||item.proof_version!==2}><legend>Comprobaciones del revisor</legend>
   {(Object.keys(CHECK_LABELS) as (keyof InclusiveVerificationChecks)[]).map(key=><label key={key}><input type="checkbox" checked={checks[key]} onChange={e=>setChecks({...checks,[key]:e.target.checked})}/>{CHECK_LABELS[key]}</label>)}
  </fieldset>}
  {item.proof_version!==2&&<p>La solicitud anterior necesita un nuevo certificado y caso práctico antes de aprobarse.</p>}
  <label>Justificación del dictamen<textarea className="ia-input" minLength={30} maxLength={2500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Registra cómo verificaste la evidencia o qué debe corregirse." disabled={busy}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="ia-inclusive-actions">{item.status==='approved'?<button type="button" disabled={busy||notes.trim().length<30} onClick={()=>void decide('revoked')}>Revocar con justificación</button>:<>
   <button type="button" className="ia-btn-primary" disabled={busy||item.proof_version!==2||notes.trim().length<30||!Object.values(checks).every(Boolean)} onClick={()=>void decide('approved')}>Aprobar evidencia y caso</button>
   <button type="button" className="ia-btn-secondary" disabled={busy||notes.trim().length<30} onClick={()=>void decide('rejected')}>Solicitar correcciones</button>
  </>}</div>
 </article>;
}

export default function InclusiveAccreditationSection({userId}:{userId:string}) {
 const [mine,setMine]=useState<InclusiveTutorAccreditation|null>(null),[reviews,setReviews]=useState<InclusiveTutorAccreditation[]>([]);
 const [status,setStatus]=useState<{schemaReady:boolean;hasReviewer:boolean}|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [editing,setEditing]=useState(false),[file,setFile]=useState<File|null>(null);
 const [form,setForm]=useState({training_name:'',issuer_name:'',completed_on:'',credential_code:'',verification_url:'',evidence_notes:''});
 const [uploaded,setUploaded]=useState<{document_path:string;document_filename:string;document_size_bytes:number}|null>(null);
 async function refresh(){
  const [availability,own,validator]=await Promise.all([verificationService.inclusiveStatus(),verificationService.getMyInclusiveAccreditation(),verificationService.isCurrentAcademicValidator()]);
  setStatus(availability);setMine(own);
  setReviews(validator?await verificationService.getInclusiveAccreditationsForValidator():[]);
 }
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setMine(null);setReviews([]);setStatus(null);setMessage('');setEditing(false);setFile(null);setUploaded(null);
  setForm({training_name:'',issuer_name:'',completed_on:'',credential_code:'',verification_url:'',evidence_notes:''});
  Promise.all([verificationService.inclusiveStatus(),verificationService.getMyInclusiveAccreditation(),verificationService.isCurrentAcademicValidator()])
   .then(async([availability,own,validator])=>{const list=validator?await verificationService.getInclusiveAccreditationsForValidator():[];if(live){setStatus(availability);setMine(own);setReviews(list);}})
   .catch(()=>{if(live)setError('No pudimos cargar la acreditación. Reintenta.');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[userId]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try {
   if(!file&&!uploaded)throw new Error('Adjunta el certificado PDF de la formación.');
   const document=uploaded||await verificationService.uploadInclusiveEvidence(file!);setUploaded(document);
   const created=await verificationService.requestInclusiveAccreditation({...form,...document});
   setMine(created);setEditing(false);setUploaded(null);setFile(null);
   setMessage('Solicitud registrada. El sello se activará únicamente tras la revisión independiente.');
  }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo enviar la solicitud.');}finally{setBusy(false);}
 }
 const approved=mine?.status==='approved'&&(mine.proof_version||1)>=2;
 const showForm=!approved&&(!mine||mine.status!=='pending'||editing||mine.proof_version!==2);
 const field=(name:keyof typeof form,value:string)=>setForm({...form,[name]:value});
 return <section className="ia-card ia-inclusive-accreditation">
  <header><div><h3><ShieldCheckIcon size={20}/>Formación en acompañamiento inclusivo</h3><p>Certificado verificable + caso práctico + revisión de una persona autorizada.</p></div>
   {mine&&<span className={'ia-badge '+(approved?'ia-badge-success':'ia-badge-primary')}>{mine.proof_version!==2?'Actualizar respaldo':STATUS[mine.status]}</span>}
  </header>
  {loading&&<p role="status">Cargando tu acreditación…</p>}
  {error&&<p role="alert" className="ia-inclusive-error">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {!loading&&<>
   {!status?.schemaReady&&<p role="status">La nueva verificación documental aún no está habilitada. Tus datos anteriores se conservan.</p>}
   {status?.schemaReady&&!status.hasReviewer&&!approved&&<p className="ia-inclusive-pending">Aún no hay un revisor independiente disponible. Puedes enviar tu evidencia; permanecerá pendiente y no se otorgará el sello automáticamente.</p>}
   {mine&&<div className="ia-inclusive-ticket"><strong>{mine.training_name}</strong>{mine.issuer_name&&<span> · {mine.issuer_name}</span>}
    {mine.verified_at&&approved&&<p>Revisión registrada el {new Date(mine.verified_at).toLocaleDateString('es-CL')}.</p>}
    {mine.reviewer_notes&&<p>Dictamen: {mine.reviewer_notes}</p>}
    <EvidenceLinks item={mine}/>
    {mine.status==='pending'&&mine.proof_version===2&&!editing&&<button type="button" className="ia-btn-secondary" onClick={()=>setEditing(true)}>Actualizar documentación</button>}
   </div>}
   {showForm&&<form onSubmit={event=>void submit(event)} className="ia-inclusive-form">
    <fieldset disabled={busy||!status?.schemaReady}><legend>1. Respaldo de formación</legend>
     <label>Curso o formación<input className="ia-input" required minLength={3} maxLength={200} value={form.training_name} onChange={e=>field('training_name',e.target.value)}/></label>
     <label>Institución o entidad emisora<input className="ia-input" required minLength={3} maxLength={200} value={form.issuer_name} onChange={e=>field('issuer_name',e.target.value)}/></label>
     <div className="ia-inclusive-grid"><label>Fecha de finalización<input type="date" className="ia-input" required max={new Date().toISOString().slice(0,10)} value={form.completed_on} onChange={e=>field('completed_on',e.target.value)}/></label>
      <label>Código o folio del certificado<input className="ia-input" required minLength={2} maxLength={150} value={form.credential_code} onChange={e=>field('credential_code',e.target.value)}/></label></div>
     <label>Enlace HTTPS para verificar con el emisor<input type="url" className="ia-input" required placeholder="https://entidad.cl/verificar" maxLength={1000} value={form.verification_url} onChange={e=>field('verification_url',e.target.value)}/></label>
     <label>Certificado PDF privado · máximo 5 MB<input type="file" accept="application/pdf,.pdf" required={!uploaded} onChange={e=>{setFile(e.target.files?.[0]||null);setUploaded(null);}}/></label>
    </fieldset>
    <fieldset disabled={busy||!status?.schemaReady}><legend>2. Caso práctico de apoyo académico</legend>
     <p>En una tutoría universitaria, una persona se sobrecarga con instrucciones extensas y prefiere participar por chat. Explica cómo prepararías la sesión, adaptarías la actividad y comprobarías que puede continuar, respetando sus decisiones.</p>
     <label>Tu propuesta<textarea className="ia-input" required minLength={100} maxLength={3000} rows={5} value={form.evidence_notes} onChange={e=>field('evidence_notes',e.target.value)} placeholder="Describe acciones concretas. No incluyas diagnósticos ni datos de otras personas."/></label>
    </fieldset>
    <p className="ia-inclusive-caption">El PDF y tu propuesta solo los consultan tú y los revisores autorizados. Este sello reconoce formación para apoyo académico; no habilita atención clínica.</p>
    <button type="submit" className="ia-btn-primary" disabled={busy||!status?.schemaReady}>{busy?'Guardando evidencia…':'Enviar para revisión independiente'}</button>
   </form>}
   <button type="button" className="ia-btn-secondary" disabled={busy} onClick={async()=>{setError('');try{await refresh();}catch{setError('No pudimos actualizar el estado.');}}}>Actualizar estado</button>
   {reviews.filter(item=>item.tutor_id!==userId).length>0&&<details className="ia-inclusive-review-queue"><summary>Panel de revisión independiente ({reviews.filter(item=>item.tutor_id!==userId).length})</summary>
    {reviews.filter(item=>item.tutor_id!==userId).map(item=><Review key={item.id+item.updated_at} item={item} onUpdated={updated=>setReviews(previous=>previous.map(row=>row.id===updated.id?updated:row))}/>)}
   </details>}
  </>}
 </section>;
}
