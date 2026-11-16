import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useLocation} from 'react-router-dom';
import {useOrientation} from '../../context/OrientationContext';
import {ORIENTATION_CHOICES,ORIENTATION_FLOWS,ORIENTATION_FOLLOW_UPS,isOrientationLocation} from '../../content/orientationFlows';
import {useOrientationTarget} from '../../hooks/useOrientationTarget';
import {isSpeechSynthesisSupported,speakText,stopSpeech,pauseSpeech,resumeSpeech,type SpeechSpeed} from '../../utils/speechReader';
import OrientationTour from './OrientationTour';
import {CompassIcon,XIcon,Volume2Icon} from '../common/Icons';
import '../../styles/orientation.css';

export function OrientationEntry(){
 const {open,state}=useOrientation();
 return <section className="ia-orientation-entry" aria-labelledby="orientation-entry-title">
  <span className="ia-orientation-entry-icon"><CompassIcon size={26} aria-hidden="true"/></span>
  <div><span className="ia-guided-eyebrow">Ayuda opcional, a tu ritmo</span><h2 id="orientation-entry-title">¿Te acompaño paso a paso?</h2><p>Cuéntame qué necesitas. Puedo orientarte, señalar dónde hacer clic y leer las instrucciones en voz alta.</p></div>
  <button type="button" className="ia-btn-primary" onClick={open} aria-controls="ia-orientation-panel" aria-expanded={state.open}>Abrir orientador</button>
 </section>;
}

export default function OrientationAssistant(){
 const guide=useOrientation(),{state,blocked}=guide;
 const location=useLocation(),launcher=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const [draft,setDraft]=useState(''),[automatic,setAutomatic]=useState(false),[speed,setSpeed]=useState<SpeechSpeed>(1);
 const [speech,setSpeech]=useState<'idle'|'speaking'|'paused'>('idle'),[audioError,setAudioError]=useState('');
 const audioToken=useRef(0),conversation=useRef<HTMLDivElement>(null);
 useEffect(()=>{conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:'instant'});},[state.messages,state.busy,state.error]);
 const flow=state.goal?ORIENTATION_FLOWS[state.goal]:null,step=flow?.steps[state.index]||null;
 const atStep=Boolean(step&&isOrientationLocation(location.pathname+location.search,step.href));
 const active=state.open&&state.running&&atStep&&!blocked;
 const target=useOrientationTarget(step,active);
 const narration=state.running&&step?'Paso '+(state.index+1)+' de '+flow!.steps.length+'. '+step.title+'. '+step.instruction:state.reply;
 const supported=isSpeechSynthesisSupported();
 const stop=useCallback(()=>{audioToken.current++;stopSpeech();setSpeech('idle');},[]);
 const play=useCallback(()=>{
  const token=++audioToken.current;setAudioError('');
  speakText(narration,{rate:speed,onStart:()=>{if(audioToken.current===token)setSpeech('speaking');},onEnd:()=>{if(audioToken.current===token)setSpeech('idle');},onError:message=>{if(audioToken.current===token){setSpeech('idle');setAudioError(message);}}});
 },[narration,speed]);
 useEffect(()=>{if(active&&automatic)play();else stop();return()=>{audioToken.current++;stopSpeech();};},[active,automatic,play,stop]);
 useEffect(()=>{
  if(!state.open)return;
  const frame=requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
  return()=>cancelAnimationFrame(frame);
 },[state.open,state.running,state.index,state.goal,state.done]);
 useEffect(()=>{
  document.body.classList.toggle('ia-orientation-guiding',active);
  return()=>document.body.classList.remove('ia-orientation-guiding');
 },[active]);
 const close=useCallback(()=>{guide.close();requestAnimationFrame(()=>launcher.current?.focus({preventScroll:true}));},[guide.close]);
 useEffect(()=>{
  if(!state.open)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!(event.target as HTMLElement)?.closest('dialog,[aria-modal="true"]')){event.preventDefault();close();}};
  document.addEventListener('keydown',escape);
  return()=>document.removeEventListener('keydown',escape);
 },[state.open,close]);
 if(blocked)return null;
 const controls=<div className="ia-orientation-audio" role="group" aria-label="Voz del orientador">
  {speech==='idle'?<button type="button" disabled={!supported||state.busy||!narration} onClick={play}><Volume2Icon size={15} aria-hidden="true"/>Escuchar</button>:<>
   <button type="button" onClick={()=>{if(speech==='speaking'){pauseSpeech();setSpeech('paused');}else{resumeSpeech();setSpeech('speaking');}}}>{speech==='speaking'?'Pausar voz':'Continuar voz'}</button>
   <button type="button" onClick={stop}>Detener voz</button></>}
  <label>Velocidad <select value={speed} disabled={!supported} onChange={event=>{stop();setSpeed(Number(event.target.value) as SpeechSpeed);}}><option value={0.8}>Lenta</option><option value={1}>Normal</option><option value={1.2}>Rápida</option></select></label>
  <label className="ia-orientation-auto"><input type="checkbox" disabled={!supported} checked={automatic} onChange={event=>setAutomatic(event.target.checked)}/>Leer los pasos automáticamente</label>
  {!supported&&<p>La voz no está disponible en este navegador. Puedes seguir todas las instrucciones por escrito.</p>}
  {audioError&&<p role="status">{audioError} Puedes continuar leyendo.</p>}
 </div>;
 return <>
  {!state.open&&<button ref={launcher} type="button" className="ia-orientation-launcher" onClick={guide.open} aria-label="Abrir orientador paso a paso" aria-controls="ia-orientation-panel" aria-expanded={false}><CompassIcon size={20} aria-hidden="true"/><span>Orientador{state.started&&!state.done?' · Pausado':''}</span></button>}
  {state.open&&state.running&&step&&flow?createPortal(<OrientationTour step={step} flowTitle={flow.title} index={state.index} total={flow.steps.length} atStep={atStep} target={target} heading={heading} audio={controls} close={close} pause={guide.pause} back={guide.back} next={guide.next} returnToStep={guide.start}/>,document.body):state.open&&createPortal(<aside id="ia-orientation-panel" className="ia-orientation-panel" aria-labelledby="ia-orientation-title">
   <header><div><span className="ia-orientation-label">Orientación opcional</span><h2 id="ia-orientation-title" ref={heading} tabIndex={-1}>Orientador de InterAula</h2></div><button type="button" className="ia-orientation-close" aria-label="Cerrar orientador" onClick={close}><XIcon size={19} aria-hidden="true"/>Cerrar</button></header>
   <div className="ia-orientation-content">
     <div ref={conversation} className="ia-orientation-conversation" role="log" aria-label="Conversación con el orientador" aria-live="polite" aria-busy={state.busy}>
      {state.messages.map((message,index)=><div key={index} className={message.role==='user'?'ia-orientation-user':'ia-orientation-answer'}><span className="ia-orientation-speaker">{message.role==='user'?'Tú':'Orientador · IA'}</span><p>{message.text}</p></div>)}
      {state.done&&<h3>Recorrido terminado</h3>}
      {state.reply&&state.reply!==state.messages.at(-1)?.text&&<p>{state.reply}</p>}
      {state.busy&&<p className="ia-orientation-thinking" role="status">La IA está preparando una respuesta…</p>}
     </div>
     {state.provider&&<p className="ia-orientation-provider">Respuesta de Google Gemini · Puede equivocarse.</p>}
     {state.error&&<div className="ia-orientation-error" role="alert"><p>{state.error}</p><button type="button" disabled={state.busy} onClick={()=>void guide.retry()}>Reintentar respuesta</button></div>}

     {state.done&&state.goal&&<div className="ia-orientation-choices" aria-label="Opciones para seguir aprendiendo">{ORIENTATION_FOLLOW_UPS[state.goal].map(id=><button key={id} type="button" onClick={()=>guide.choose(id)}>{ORIENTATION_FLOWS[id].title}</button>)}</div>}
     {state.error&&<p className="ia-orientation-counter">Recorridos manuales disponibles:</p>}
     {state.choices.length>0&&<div className="ia-orientation-choices" aria-label="Elige qué necesitas">
      {state.choices.map(id=><button type="button" key={id} onClick={()=>guide.choose(id)}>{ORIENTATION_CHOICES.find(item=>item.id===id)?.label||ORIENTATION_FLOWS[id].title}</button>)}
      {!state.choices.includes('supports')&&<button type="button" onClick={()=>guide.choose('supports')}>Elegir mis apoyos</button>}
     </div>}
     {flow&&!state.done&&<section className="ia-orientation-plan"><h3>{state.started?'Recorrido pausado':flow.title}</h3>
      {state.started?<p>Puedes retomar el paso {state.index+1}: {step?.title}.</p>:<ol>{flow.steps.map(item=><li key={item.title}>{item.title}</li>)}</ol>}
      {state.goal==='projects'&&!state.started&&<div className="ia-orientation-project-choice"><button type="button" onClick={()=>guide.choose('create-project')}>Prefiero crear mi proyecto</button></div>}
      <button type="button" className="ia-btn-primary" onClick={guide.start}>{state.started?'Reanudar recorrido':'Empezar recorrido'}</button>
     </section>}
     <form className="ia-orientation-form" onSubmit={event=>{event.preventDefault();void guide.ask(draft);setDraft('');}}>
      <p id="ia-orientation-scope" className="ia-orientation-scope">Conversamos sobre InterAula y tus estudios. Para responder, se envían tus mensajes recientes a Google Gemini. Evita datos sensibles.</p>
      <label htmlFor="ia-orientation-message">¿Qué necesitas?</label><textarea id="ia-orientation-message" aria-describedby="ia-orientation-scope" rows={2} maxLength={1600} disabled={state.busy} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Por ejemplo: quiero ser tutor, no entiendo derivadas o necesito organizar una tarea."/>
      <button type="submit" className="ia-btn-primary" disabled={state.busy||!draft.trim()}>{state.busy?'Esperando respuesta…':'Conversar con el orientador'}</button>

     </form>
    {controls}
   </div>
   <footer>
    <button type="button" onClick={()=>{stop();setDraft('');setAutomatic(false);guide.clear();}}>Empezar de nuevo y borrar conversación</button>
    <p>Avanzas a tu ritmo y decides qué hacer. El historial del portal se borra al recargar o salir; los mensajes enviados son procesados por Google.</p>
   </footer>
  </aside>,document.body)}

 </>;
}
