import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {verificationService,type ServerAssessment,type ServerAssessmentAnswer,type AssessmentQuestion} from '../../../services/verification.service';
import type {AcademicLevel} from '../../../types/profile';
import {XIcon,ShieldCheckIcon} from '../../../components/common/Icons';
import {ReadAloudControls} from '../../../components/common/ReadAloudControls';
import {assessmentSubjectChoices} from '../../../utils/assessmentSubjects';
import AssessmentSubjectPicker from './AssessmentSubjectPicker';
import AssessmentLoading from './AssessmentLoading';
import {useCalmMode} from '../../../context/CalmModeContext';
import {stopSpeech} from '../../../utils/speechReader';
interface Props {
 isOpen:boolean;onClose:()=>void;onSuccess:(subjectId:string,subjectName:string,level?:AcademicLevel)=>void;
 availableSubjects:{id:string;name:string}[];defaultSubjectId?:string;userInstitution?:string;userCareer?:string;
 userId?:string;verifiedSubjectNames?:string[];
}
type EventType='fullscreen_exit'|'visibility_hidden'|'window_blur'|'copy_attempt'|'paste_attempt'|'abandon';
const formatTime=(seconds:number)=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
const NO_VERIFIED_NAMES:string[]=[];
const PAUSE_TIPS=['Mira un punto fijo y relaja las manos.','Lee a tu ritmo. Puedes escuchar la próxima pregunta.','Una pregunta a la vez. Continúa cuando estés listo.'];
type LoadingStep='checking'|'preparing'|'saving'|'next'|'recovering'|'certifying'|null;
const LOADING_TITLES={checking:'Comprobando disponibilidad',preparing:'Preparando tu evaluación',saving:'Guardando tu respuesta',next:'Preparando la siguiente pregunta',recovering:'Recuperando tu evaluación',certifying:'Confirmando tu acreditación'};
export default function TutorValidationBotModal({isOpen,onClose,onSuccess,availableSubjects,defaultSubjectId,userId,verifiedSubjectNames=NO_VERIFIED_NAMES}:Props) {
 const {isCalmMode}=useCalmMode();
 const choices=useMemo(()=>assessmentSubjectChoices(availableSubjects,verifiedSubjectNames),[availableSubjects,verifiedSubjectNames]);
 const [subjectId,setSubjectId]=useState(''),[timeMode,setTimeMode]=useState<'standard'|'extended'>('standard');
 const [attempt,setAttempt]=useState<ServerAssessment|null>(null),[question,setQuestion]=useState<AssessmentQuestion|null>(null);
 const [answer,setAnswer]=useState(''),[feedback,setFeedback]=useState<ServerAssessmentAnswer|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [fullscreen,setFullscreen]=useState(false),[confirmExit,setConfirmExit]=useState(false);
 const [remaining,setRemaining]=useState(0),[totalRemaining,setTotalRemaining]=useState(0);
 const [pauseRemaining,setPauseRemaining]=useState(0),[loading,setLoading]=useState<LoadingStep>('checking');
 const [calmView,setCalmView]=useState(true),[largeText,setLargeText]=useState(false),[hideTimer,setHideTimer]=useState(false);
 const [privacyHidden,setPrivacyHidden]=useState(false),[captureCover,setCaptureCover]=useState(false);
 const [status,setStatus]=useState<{serverConfigured:boolean;schemaReady?:boolean;generationConfigured:boolean;catalogSubjects:number}|null>(null);
 const overlay=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDivElement>(null),opened=useRef<string|null>(null);
 const current=useRef<ServerAssessment|null>(null),busyRef=useRef(false),previousFocus=useRef<HTMLElement|null>(null);
 const clock=useRef({server:Date.now(),client:performance.now()}),timeoutSent=useRef(''),lastIncident=useRef(0);
 const pendingEvents=useRef<{id:string;type:EventType}[]>([]),eventQueue=useRef<Promise<void>>(Promise.resolve());
 const submitRef=useRef<(timedOut?:boolean)=>Promise<void>>(async()=>{});
 const storageKey=userId?'interaula_assessment_v2_'+userId:null;
 const initial=useRef({choices,defaultSubjectId});initial.current={choices,defaultSubjectId};
 function working(value:boolean,step:Exclude<LoadingStep,null>='saving'){busyRef.current=value;setBusy(value);setLoading(value?step:null);}
 function clockSync(serverNow:string){clock.current={server:Date.parse(serverNow),client:performance.now()};}
 function receive(value:ServerAssessment){current.current=value;setAttempt(value);setQuestion(value.question);setFeedback(null);clockSync(value.serverNow);timeoutSent.current='';}
 function remember(id:string|null){if(storageKey)try{if(id)localStorage.setItem(storageKey,id);else localStorage.removeItem(storageKey);}catch{/* optional browser storage */}}
 async function enterFullscreen(){
  if(!overlay.current?.requestFullscreen)throw new Error('Este navegador no admite pantalla completa para evaluar. Usa un navegador compatible o solicita revisión docente.');
  await overlay.current.requestFullscreen();setFullscreen(true);dialog.current?.focus();
  setPrivacyHidden(false);delete overlay.current.dataset.obscured;
 }
 async function exitFullscreen(){if(document.fullscreenElement===overlay.current)try{await document.exitFullscreen();}catch{/* already exited */}}
 function flushEvents() {
  eventQueue.current=eventQueue.current.catch(()=>{}).then(async()=>{
   while(pendingEvents.current.length&&current.current) {
    const event=pendingEvents.current[0],id=current.current.id;
    const state=await verificationService.reportAssessmentEvent(id,event.type,event.id);
    pendingEvents.current.shift();
    if(current.current?.id===id) {
     current.current={...current.current,integrityCount:state.integrityCount,state:state.state as ServerAssessment['state']};
     setAttempt(current.current);
     if(state.state==='failed'){setQuestion(null);setNotice(event.type==='abandon'?'Abandonaste este intento.':'El intento terminó al alcanzar tres incidencias. Puedes repasar y volver a intentarlo.');}
    }
   }
  });
  return eventQueue.current;
 }
 function report(type:EventType) {
  if(!current.current||current.current.state!=='pending')return;
  const now=performance.now();
  if(type!=='abandon'&&now-lastIncident.current<1500)return;
  lastIncident.current=now;
  pendingEvents.current.push({id:crypto.randomUUID(),type});
  setNotice(type==='copy_attempt'||type==='paste_attempt'?'Copiar y pegar están bloqueados. Incidencia registrada.':'Salida registrada. Vuelve para continuar; el tiempo sigue contando.');
  void flushEvents().catch(()=>setError('No pudimos registrar la incidencia. Al continuar se reintentará antes de enviar la respuesta.'));
 }
 useEffect(()=>{
  if(!isOpen){opened.current=null;return;}
  if(opened.current===(storageKey||'temporary'))return;opened.current=storageKey||'temporary';
  current.current=null;setAttempt(null);setQuestion(null);setFeedback(null);setAnswer('');setError('');setNotice('');setConfirmExit(false);setStatus(null);setLoading('checking');setPrivacyHidden(false);setCaptureCover(false);setFullscreen(!!overlay.current&&document.fullscreenElement===overlay.current);
  pendingEvents.current=[];lastIncident.current=Number.NEGATIVE_INFINITY;timeoutSent.current='';
  const values=initial.current;
  setSubjectId(values.choices.find(s=>(s.id===values.defaultSubjectId||s.id==='catalog:'+values.defaultSubjectId)&&!s.verified)?.id||values.choices.find(s=>!s.verified)?.id||'');
  let live=true;
  verificationService.assessmentStatus().then(value=>{if(live)setStatus(value);}).catch(()=>{if(live)setError('No pudimos comprobar la disponibilidad del servidor. Cierra y vuelve a abrir la evaluación.');}).finally(()=>{if(live&&!busyRef.current)setLoading(null);});
  let saved:string|null=null;try{saved=storageKey?localStorage.getItem(storageKey):null;}catch{/* optional */}
  if(saved) {
   working(true,'recovering');
   verificationService.getAssessment(saved).then(value=>{if(live)receive(value);})
    .catch(cause=>{if(live){remember(null);setError(cause instanceof Error?cause.message:'No pudimos recuperar el intento.');}})
    .finally(()=>{if(live)working(false);});
  }
  return()=>{live=false;opened.current=null;};
 },[isOpen,storageKey]);
 useEffect(()=>{
  if(!isOpen)return;
  previousFocus.current=document.activeElement as HTMLElement|null;dialog.current?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{current.current=null;void exitFullscreen();document.body.style.overflow=overflow;previousFocus.current?.focus();};
 },[isOpen]);
 useEffect(()=>{
  const changed=()=>setFullscreen(document.fullscreenElement===overlay.current);
  document.addEventListener('fullscreenchange',changed);
  return()=>document.removeEventListener('fullscreenchange',changed);
 },[]);
 useEffect(()=>{
  if(!isOpen||attempt?.state!=='pending')return;
  const conceal=()=>{setPrivacyHidden(true);if(overlay.current)overlay.current.dataset.obscured='true';stopSpeech();};
  const reveal=()=>{if(!document.hidden&&document.hasFocus()&&document.fullscreenElement===overlay.current){setPrivacyHidden(false);if(overlay.current)delete overlay.current.dataset.obscured;}};
  const hidden=()=>{if(document.hidden){conceal();report('visibility_hidden');}else reveal();};
  const blur=()=>{conceal();report('window_blur');};
  const full=()=>{if(document.fullscreenElement!==overlay.current){conceal();report('fullscreen_exit');}else reveal();};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);document.addEventListener('fullscreenchange',full);
  window.addEventListener('focus',reveal);
  return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);document.removeEventListener('fullscreenchange',full);window.removeEventListener('focus',reveal);};
 },[isOpen,attempt?.id,attempt?.state]);
 useEffect(()=>{
  if(!captureCover)return;
  const timer=setTimeout(()=>setCaptureCover(false),1800);return()=>clearTimeout(timer);
 },[captureCover]);
 useEffect(()=>{
  if(!isOpen||!question||busy||privacyHidden||captureCover||!fullscreen)return;
  dialog.current?.querySelector<HTMLElement>('#assessment-question-title')?.focus();
 },[isOpen,question?.id,busy,privacyHidden,captureCover,fullscreen]);
 useEffect(()=>{
  if(!isOpen)return;
  const handle=(event:KeyboardEvent)=>{
   if(current.current?.state==='pending'&&(event.key==='PrintScreen'||(event.metaKey&&event.shiftKey&&['3','4','5','s'].includes(event.key.toLowerCase())))) {
    event.preventDefault();setCaptureCover(true);stopSpeech();setNotice('Contenido protegido mientras cambias de herramienta. El tiempo continúa.');return;
   }
   if(event.key==='Escape'&&(event.target as HTMLElement)?.matches('[role="combobox"][aria-expanded="true"]'))return;
   if(current.current?.state==='pending'&&(event.ctrlKey||event.metaKey)&&['k','p','s','u'].includes(event.key.toLowerCase())) {
    event.preventDefault();event.stopImmediatePropagation();setNotice('Este atajo está deshabilitado durante la evaluación.');return;
   }
   if(event.key==='Escape'){if(current.current?.state==='pending'){event.preventDefault();setNotice('Para salir, usa Cerrar evaluación y confirma el abandono.');}else if(!busyRef.current)onClose();}
   if(event.key!=='Tab')return;
   const controls=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
   if(!controls?.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',handle,true);return()=>document.removeEventListener('keydown',handle,true);
 },[isOpen,onClose]);
 useEffect(()=>{
  if(!isOpen||!attempt||attempt.state!=='pending')return;
  const tick=()=>{
   const now=clock.current.server+performance.now()-clock.current.client;
   const total=Math.max(0,Math.ceil((Date.parse(attempt.expiresAt)-now)/1000));setTotalRemaining(total);
   const left=attempt.questionExpiresAt?Math.max(0,Math.ceil((Date.parse(attempt.questionExpiresAt)-now)/1000)):0;setRemaining(left);
   setPauseRemaining(attempt.pauseEndsAt?Math.max(0,Math.ceil((Date.parse(attempt.pauseEndsAt)-now)/1000)):0);
   if(total===0){current.current={...attempt,state:'failed'};setAttempt(current.current);setQuestion(null);setNotice('El tiempo total terminó. Puedes iniciar un nuevo intento.');return;}
   if(question&&!feedback&&left===0&&!busyRef.current&&timeoutSent.current!==question.id){timeoutSent.current=question.id;void submitRef.current(true);}
  };
  tick();const timer=setInterval(tick,250);return()=>clearInterval(timer);
 },[isOpen,attempt,question,feedback]);
 async function start(){
  if(busyRef.current||!subjectId)return;working(true,'preparing');setError('');setNotice('');
  try {
   await enterFullscreen();
   const value=await verificationService.startAssessment(subjectId,timeMode);
   receive(value);remember(value.id);
  } catch(cause){setError(cause instanceof Error?cause.message:'No se pudo preparar la evaluación.');await exitFullscreen();}
  finally{working(false);}
 }
 async function submit(timedOut=false){
  const value=current.current;
  if(!value||!question||busyRef.current||(!timedOut&&!answer.trim()))return;
  working(true);setError('');
  try {
   await flushEvents();if(current.current?.state!=='pending')return;
   const next=await verificationService.answerAssessment(value.id,question.id,timedOut?'':answer,timedOut);
   setFeedback(next);setQuestion(null);setAnswer('');
   if(next.serverNow)clockSync(next.serverNow);
   current.current={...value,answered:next.answered,question:null,questionExpiresAt:null,needsNext:!next.finished,state:next.finished?(next.passed?'passed':'failed'):'pending',score:next.score,integrityCount:current.current.integrityCount,pauseEndsAt:next.pauseEndsAt||null,pauseSeconds:next.pauseSeconds||0,terminationReason:next.terminationReason};
   setNotice('');
   setAttempt(current.current);
   if(next.finished&&!next.passed){remember(null);await exitFullscreen();}
  } catch(cause){timeoutSent.current='';setError(cause instanceof Error?cause.message:'No se pudo guardar. Reintenta.');}
  finally{working(false);}
 }
 submitRef.current=submit;
 async function nextQuestion(){
  const value=current.current;if(!value||busyRef.current||pauseRemaining>0)return;
  working(true,'next');setError('');setNotice('');
  try {
   await enterFullscreen();await flushEvents();if(current.current?.state!=='pending')return;
   const next=await verificationService.nextAssessmentQuestion(value.id);
   receive({...current.current,answered:next.answered,question:next.question,questionExpiresAt:next.questionExpiresAt,serverNow:next.serverNow,needsNext:false});setAnswer('');
  } catch(cause){setError(cause instanceof Error?cause.message:'No se pudo abrir la siguiente pregunta.');}
  finally{working(false);}
 }
 async function certify(){
  const value=current.current;if(!value||busyRef.current)return;working(true,'certifying');setError('');
  try {
   await flushEvents();if(current.current?.state!=='passed')return;
   const grant=await verificationService.botGrant({attempt_id:value.id});remember(null);current.current=null;await exitFullscreen();
   onSuccess(grant.subject_id,value.subjectName,grant.level);onClose();
  } catch(cause){setError(cause instanceof Error?cause.message:'No se pudo confirmar. Puedes reintentar sin repetir la prueba.');}
  finally{working(false);}
 }
 async function close(abandon=false){
  if(current.current?.state==='pending'&&!abandon){setConfirmExit(true);return;}
  if(abandon&&current.current){working(true);try{pendingEvents.current.push({id:crypto.randomUUID(),type:'abandon'});await flushEvents();}catch{setError('No se pudo confirmar el abandono. Reintenta.');working(false);return;}working(false);}
  remember(null);current.current=null;await exitFullscreen();onClose();
 }
 function reset(){remember(null);current.current=null;setAttempt(null);setQuestion(null);setFeedback(null);setAnswer('');setError('');setNotice('');void exitFullscreen();}
 if(!isOpen)return null;
 const selected=choices.find(s=>s.id===subjectId);
 const pending=attempt?.state==='pending';
 const paused=pending&&(!!feedback||attempt.needsNext);
 const shielded=pending&&(!fullscreen||privacyHidden||captureCover);
 const progress=attempt?Math.round(attempt.answered/attempt.totalQuestions*100):0;
 const supportControls=<details className="ia-assessment-supports">
  <summary>Apoyos de lectura y concentración</summary>
  <div>
   <label><input type="checkbox" checked={calmView} onChange={e=>setCalmView(e.target.checked)}/> Vista tranquila</label>
   <label><input type="checkbox" checked={largeText} onChange={e=>setLargeText(e.target.checked)}/> Texto más grande</label>
   <label><input type="checkbox" checked={hideTimer} onChange={e=>setHideTimer(e.target.checked)}/> Ocultar cuenta regresiva</label>
  </div>
 </details>;
 return createPortal(<div ref={overlay} className="ia-assessment-overlay" data-calm={calmView||isCalmMode} data-large-text={largeText}
   onCopy={e=>{if(pending){e.preventDefault();report('copy_attempt');}}}
   onCut={e=>{if(pending){e.preventDefault();report('copy_attempt');}}}
   onPaste={e=>{if(pending){e.preventDefault();report('paste_attempt');}}}
   onDragStart={e=>{if(pending)e.preventDefault();}}
   onContextMenu={e=>{if(pending)e.preventDefault();}}>
  <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="assessment-title" aria-busy={!!loading} className="ia-assessment-dialog">
   <header className="ia-assessment-heading">
    <div className="ia-assessment-brand"><span aria-hidden="true"><ShieldCheckIcon size={24}/></span><div>
     <small>{attempt?'Tu espacio de concentración':'Acreditación básica'}</small>
     <h2 id="assessment-title">{attempt?.subjectName||'Prepara tu evaluación'}</h2>
    </div></div>
    <button type="button" onClick={()=>void close()} disabled={busy} className="ia-assessment-close" aria-label="Cerrar evaluación"><XIcon size={20}/></button>
   </header>
   {error&&<div role="alert" className="ia-assessment-error"><p>{error}</p>{attempt&&<button type="button" disabled={busy} onClick={async()=>{
      working(true,'recovering');try{await flushEvents();receive(await verificationService.getAssessment(attempt.id));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'No se pudo recuperar el intento.');}finally{working(false);}
    }}>Recuperar estado del intento</button>}</div>}
   {notice&&<p role="status" className="ia-assessment-notice">{notice}</p>}
   {confirmExit&&<div role="alertdialog" aria-label="Confirmar abandono" className="ia-assessment-notice"><p>Si abandonas, este intento termina sin acreditación.</p><button type="button" className="ia-btn-secondary" onClick={()=>setConfirmExit(false)}>Continuar</button> <button type="button" disabled={busy} onClick={()=>void close(true)}>Abandonar intento</button></div>}
   {loading?<AssessmentLoading title={LOADING_TITLES[loading]}/>:!attempt?<section className="ia-assessment-setup">
    <p className="ia-assessment-lead">Una pregunta a la vez. Elige tu materia y tu ritmo.</p>
    <AssessmentSubjectPicker choices={choices} value={subjectId} onChange={setSubjectId} disabled={busy}/>
    <div className="ia-assessment-time-cards" aria-label="Tiempo por tipo de pregunta">
     <div><strong>Alternativas</strong><span>{timeMode==='extended'?40:20} segundos</span></div>
     <div><strong>Desarrollo breve</strong><span>{timeMode==='extended'?80:40} segundos</span></div>
    </div>
    <label htmlFor="assessment-time">Tu ritmo</label>
    <select id="assessment-time" className="ia-input" value={timeMode} onChange={e=>setTimeMode(e.target.value as 'standard'|'extended')} disabled={busy}>
      <option value="standard">Estándar · pausas de 5 segundos</option><option value="extended">Tiempo extendido · pausas de 10 segundos</option>
    </select>
    {supportControls}
    <details className="ia-assessment-rules"><summary>Cómo funciona y reglas de la evaluación</summary>
     <ul><li>Debes responder todas correctamente. Un error o agotar el tiempo termina el intento. Solo se acredita el nivel básico.</li><li>Al iniciar un nuevo intento se preparan preguntas nuevas y se evitan las de tus intentos recientes.</li><li>Pantalla completa. Copiar y pegar están bloqueados; tres salidas o incidencias terminan el intento.</li><li>Hay una pausa entre preguntas. La siguiente empieza cuando tú continúas.</li><li>Las capturas del sistema y las fotos con otro dispositivo no se pueden impedir desde una web. Evita compartir el contenido.</li><li>Las preguntas usan IA cuando está disponible. También puedes solicitar revisión docente.</li><li>Al comenzar se registra la materia que quieres ofrecer; se acredita solo si apruebas.</li></ul>
    </details>
    <p className="ia-assessment-caption">Todas correctas para aprobar · El primer error termina el intento</p>
    {status&&(!status.serverConfigured||status.schemaReady===false)&&<p role="alert" className="ia-assessment-error">La evaluación aún no está habilitada en el servidor. Tus materias siguen disponibles.</p>}
    <button type="button" className="ia-btn-primary ia-assessment-main-action" onClick={()=>void start()} disabled={!subjectId||selected?.verified||busy||!status?.serverConfigured||status.schemaReady===false}>Comenzar en pantalla completa</button>
   </section>:<section className="ia-assessment-session">
    <div className="ia-assessment-session-meta">
     <span>Pregunta {paused?attempt.answered:Math.min(attempt.answered+1,attempt.totalQuestions)} de {attempt.totalQuestions}</span>
     {pending&&!paused&&<output role="timer" aria-live="off" aria-label={hideTimer?'Cuenta regresiva oculta':'Tiempo restante por pregunta'} className="ia-assessment-clock">{hideTimer?'Tiempo oculto':formatTime(remaining)}</output>}
     {paused&&<span className="ia-assessment-pause-tag">En pausa</span>}
    </div>
    <progress className="ia-assessment-completion" value={attempt.answered} max={attempt.totalQuestions} aria-label="Preguntas respondidas">{progress}%</progress>
    {shielded?<section className="ia-assessment-stage ia-assessment-privacy" role="status">
      <ShieldCheckIcon size={32}/><h3>La pregunta está protegida</h3>
      <p>{captureCover?'El contenido se ocultó temporalmente.':'Vuelve a la evaluación para continuar.'} El tiempo sigue contando.</p>
      {!fullscreen&&<button type="button" className="ia-btn-primary" onClick={()=>void enterFullscreen().catch(cause=>setError(cause.message))}>Volver a pantalla completa</button>}
    </section>:<>
     {pending&&question&&!feedback&&<form className="ia-assessment-question ia-assessment-sensitive" onSubmit={e=>{e.preventDefault();void submit();}}>
      <p className="ia-assessment-question-type">{question.type==='choice'?'Selecciona una respuesta':'Escribe una respuesta breve'}</p>
      <h3 id="assessment-question-title" tabIndex={-1}>{question.prompt}</h3>
      {question.codeSnippet&&<pre>{question.codeSnippet}</pre>}
      <ReadAloudControls text={[question.prompt,...(question.options||[]).map(o=>o.text)].join('. ')} compact label="Escuchar pregunta"/>
      {question.type==='choice'?<fieldset disabled={busy||!fullscreen||confirmExit}><legend className="ia-assessment-sr-only">Selecciona una respuesta</legend>{question.options?.map((o,index)=><label key={o.id} className="ia-assessment-option" data-selected={answer===o.id}><input type="radio" name="assessment-answer" value={o.id} checked={answer===o.id} onChange={()=>setAnswer(o.id)}/><span className="ia-assessment-option-letter" aria-hidden="true">{String.fromCharCode(65+index)}</span><span>{o.text}</span></label>)}</fieldset>:<><label htmlFor="assessment-answer">Respuesta breve</label><textarea id="assessment-answer" className="ia-input" value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={1500} autoComplete="off" spellCheck={false} placeholder="Escribe un concepto o resultado corto" disabled={busy||!fullscreen||confirmExit}/></>}
      <button type="submit" className="ia-btn-primary ia-assessment-main-action" disabled={busy||!answer.trim()||!fullscreen||confirmExit}>Enviar respuesta</button>
      <small className="ia-assessment-watermark" aria-hidden="true">InterAula · Evaluación personal</small>
     </form>}
     {paused&&<section className="ia-assessment-stage ia-assessment-break">
      <span className="ia-assessment-stage-symbol" aria-hidden="true">✓</span>
      <p className="ia-assessment-eyebrow">{feedback?.correct?'Respuesta correcta':feedback?'Respuesta guardada':'Intento recuperado'}</p>
      <h3>Un momento para ti</h3>
      <p>{PAUSE_TIPS[(attempt.answered-1+PAUSE_TIPS.length)%PAUSE_TIPS.length]}</p>
      {feedback&&<details className="ia-assessment-feedback"><summary>Ver explicación de la respuesta</summary><p>{feedback.feedback}</p></details>}
      <span className="ia-assessment-break-count" aria-hidden="true">{pauseRemaining>0?pauseRemaining:'Listo'}</span>
      <p className="ia-assessment-caption" role="status">{pauseRemaining>0?'Pausa breve. La siguiente pregunta todavía no comienza.':'La siguiente pregunta empieza cuando tú continúas. El límite total del intento sigue contando.'}</p>
      <button type="button" className="ia-btn-primary ia-assessment-main-action" onClick={()=>void nextQuestion()} disabled={busy||confirmExit||pauseRemaining>0}>{pauseRemaining>0?'Pausa en curso':'Siguiente pregunta'}</button>
     </section>}
    </>}
    {(attempt.state==='passed'||attempt.state==='granted')&&<section className="ia-assessment-stage ia-assessment-result">
      <span className="ia-assessment-stage-symbol" aria-hidden="true">✓</span><h3>Evaluación aprobada</h3><strong className="ia-assessment-score">{attempt.score}%</strong><p>Ya puedes confirmar tu acreditación básica.</p>
      <button type="button" className="ia-btn-primary ia-assessment-main-action" onClick={()=>void certify()} disabled={busy}>Confirmar acreditación básica</button>
    </section>}
    {attempt.state==='failed'&&<section className="ia-assessment-stage ia-assessment-result">
      <h3>Este intento terminó</h3>{attempt.terminationReason?<p>{attempt.terminationReason==='time_expired'?'Se agotó el tiempo de respuesta.':'La respuesta no fue correcta.'} Puedes repasar y comenzar con preguntas nuevas.</p>:<p>Puedes repasar y volver a intentarlo.</p>}
      <button type="button" className="ia-btn-secondary" onClick={reset} disabled={busy}>Volver a elegir materia</button>
    </section>}
    {pending&&<footer className="ia-assessment-session-footer">{supportControls}<details className="ia-assessment-rules"><summary>Estado del intento</summary>
      <p>Incidencias: {attempt.integrityCount} / {attempt.integrityLimit}. Tiempo total restante: {formatTime(totalRemaining)}.</p>
      <p>{attempt.source==='reviewed'?'Banco de preguntas revisado.':'Preguntas específicas generadas con IA.'}</p>
    </details></footer>}
   </section>}
  </div>
 </div>,document.body);
}
