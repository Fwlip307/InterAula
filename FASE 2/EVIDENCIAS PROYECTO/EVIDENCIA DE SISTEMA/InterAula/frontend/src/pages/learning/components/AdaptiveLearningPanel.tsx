import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {adaptiveLearningService as service} from '../../../services/adaptiveLearning.service';
import type {AdaptiveOverview,AdaptiveExercise,AdaptiveFeedback,AdaptiveDemo} from '../../../types/adaptiveLearning';
import {ReadAloudControls} from '../../../components/common/ReadAloudControls';
import {CompassIcon,LayersIcon,LightbulbIcon,ArrowRightIcon,CheckCircleIcon} from '../../../components/common/Icons';
import AdaptiveKnowledgeMap,{SKILL_STATUS} from './AdaptiveKnowledgeMap';
import '../../../styles/adaptiveLearning.css';

export default function AdaptiveLearningPanel({userId}:{userId:string}){
 const [data,setData]=useState<AdaptiveOverview|null>(null),[exercise,setExercise]=useState<AdaptiveExercise|null>(null),[feedback,setFeedback]=useState<AdaptiveFeedback|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[answer,setAnswer]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[demo,setDemo]=useState<AdaptiveDemo|null>(null),[demoOpen,setDemoOpen]=useState(false),[largeText,setLargeText]=useState(false);
 const busyRef=useRef(false),practiceHeading=useRef<HTMLHeadingElement>(null);
 function working(value:boolean){busyRef.current=value;setBusy(value);}
 function receive(value:AdaptiveOverview){setData(value);setExercise(value.activeExercise);setAnswer('');}
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setData(null);setExercise(null);setFeedback(null);setDemoOpen(false);setDemo(null);setSelected(null);
  service.overview().then(value=>{if(live)receive(value);}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'No pudimos consultar tu ruta.');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[userId]);
 useEffect(()=>{if(exercise||feedback){practiceHeading.current?.focus({preventScroll:true});practiceHeading.current?.scrollIntoView({block:'start',behavior:'auto'});}},[exercise?.attemptId,feedback?.attemptId]);
 async function refresh(){working(true);setError('');try{receive(await service.overview());setFeedback(null);}catch(cause){setError(cause instanceof Error?cause.message:'No pudimos recuperar tu progreso.');}finally{working(false);}}
 async function start(){if(busyRef.current)return;working(true);setError('');try{const value=await service.start();setExercise(value);setFeedback(null);setAnswer('');}catch(cause){setError(cause instanceof Error?cause.message:'No pudimos preparar el ejercicio.');}finally{working(false);}}
 async function submit(value=answer){if(!exercise||!value||busyRef.current)return;working(true);setError('');
  try{const result=await service.answer(exercise.attemptId,value);receive(result.overview);setFeedback(result.feedback);}
  catch(cause){setError(cause instanceof Error?cause.message:'No se pudo guardar. Puedes reintentar sin duplicar el avance.');}finally{working(false);}
 }
 async function hint(){if(!exercise||busyRef.current)return;working(true);setError('');try{const result=await service.hint(exercise.attemptId);setExercise({...exercise,hintUsed:true,hint:result.hint});}catch(cause){setError(cause instanceof Error?cause.message:'No se pudo abrir la pista.');}finally{working(false);}}
 if(loading)return <section className="ia-adaptive-loading" role="status"><CompassIcon size={26}/><p>Preparando tu mapa de aprendizaje…</p></section>;
 const next=data?.recommendation,selectedSkill=data?.skills.find(skill=>skill.id===selected);
 const exerciseSkill=data?.skills.find(skill=>skill.id===exercise?.skillId);
 return <section className="ia-adaptive" aria-label="Ruta adaptativa" data-large-text={largeText}>
  <header className="ia-adaptive-hero" hidden={!!exercise || !!feedback}><div><span className="ia-adaptive-eyebrow"><CompassIcon size={16}/> Piloto de Cálculo</span><h2>Una pregunta a la vez</h2><p>Practica sin prisa. Puedes pedir una pista cuando lo necesites.</p></div><span className="ia-adaptive-pilot">Práctica sin cronómetro</span></header>
  {error&&<div role="alert" className="ia-adaptive-error"><p>{error}</p><button type="button" className="ia-btn-secondary" disabled={busy} onClick={()=>void refresh()}>Recuperar mi progreso</button></div>}
  {data&&<>
   {!data.ready&&<p role="status" className="ia-adaptive-notice">La práctica con guardado todavía se está habilitando. Puedes explorar el mapa y probar la simulación.</p>}
   <div className="ia-adaptive-top" hidden={!!exercise}>
    <article className="ia-adaptive-next"><div className="ia-adaptive-section-label"><LightbulbIcon size={18}/>Recomendación para ti</div>
     <h3>{next?.kind==='complete'?'Objetivo consolidado en el piloto':next?.skillName}</h3><p>{next?.reason}</p>
     {next&&next.prerequisitePath.length>1&&<p className="ia-adaptive-path">{next.prerequisitePath.map(id=>data.skills.find(s=>s.id===id)?.name).join(' → ')}</p>}
     {!exercise&&!feedback&&next?.kind!=='complete'&&<button type="button" className="ia-btn-primary" disabled={busy||!data.ready} data-orientation="adaptive-start" onClick={()=>void start()}>{busy?'Preparando…':'Practicar este concepto'}<ArrowRightIcon size={16}/></button>}
     {exercise&&<p className="ia-adaptive-caption">Tienes un ejercicio en curso. Puedes continuarlo más abajo.</p>}
     {next?.kind==='complete'&&<p>Elige otro objetivo para seguir practicando. Esto no otorga acreditación como tutor.</p>}
    </article>
    <aside className="ia-adaptive-goal"><h3>Mi objetivo y mi progreso</h3><label htmlFor="adaptive-goal">¿Qué quieres llegar a resolver?</label>
     <select id="adaptive-goal" className="ia-input" value={data.goalId} disabled={busy||!!exercise||!data.ready} onChange={async event=>{
      working(true);setError('');try{receive(await service.goal(event.target.value));setFeedback(null);}catch(cause){setError(cause instanceof Error?cause.message:'No pudimos cambiar el objetivo.');}finally{working(false);}
     }}>{data.skills.map(skill=><option key={skill.id} value={skill.id}>{skill.name}</option>)}</select>
     <div className="ia-adaptive-stat-row"><strong>{data.answeredCount}</strong><span>ejercicios respondidos</span></div>
     <div className="ia-adaptive-stat-row"><strong>{data.skills.filter(s=>s.status==='consolidated').length}<small> / {data.skills.length}</small></strong><span>conceptos consolidados en el piloto</span></div>
     <p className="ia-adaptive-caption">Tu progreso es privado. Cambia de objetivo al terminar el ejercicio en curso.</p>
    </aside>
   </div>
   {(exercise||feedback)&&<article data-orientation="adaptive-practice" className="ia-adaptive-practice" aria-busy={busy}>
    <div className="ia-adaptive-practice-top">
     <div className="ia-adaptive-skill-meta">
      <strong>{exerciseSkill?.name||data.skills.find(s=>s.id===feedback?.skillId)?.name}</strong>
      {exerciseSkill&&<span className="ia-adaptive-skill-progress">{exerciseSkill.distinctIndependentCorrect} / 3 hacia consolidación</span>}
     </div>
     <label><input type="checkbox" checked={largeText} onChange={event=>setLargeText(event.target.checked)}/>Texto amplio</label>
    </div>
    <h3 ref={practiceHeading} tabIndex={-1}>{exercise?'Una pregunta a la vez':feedback?.correct?'Buen paso. Sigamos construyendo.':'Vamos a reforzarlo, sin prisa.'}</h3>
    {exercise?<form onSubmit={event=>{event.preventDefault();void submit();}}>
     <p className="ia-adaptive-prompt">{exercise.prompt}</p><ReadAloudControls compact text={[exercise.prompt,...exercise.options.map(option=>option.text)].join('. ')} label="Escuchar ejercicio"/>
     <fieldset disabled={busy}><legend>Elige una alternativa</legend>{exercise.options.map((option,idx)=><label className="ia-adaptive-option" key={option.id} data-selected={answer===option.id}><input type="radio" name="adaptive-answer" value={option.id} checked={answer===option.id} onChange={()=>setAnswer(option.id)}/><span className="ia-adaptive-option-letter" aria-hidden="true">{String.fromCharCode(65+idx)}</span><span className="ia-adaptive-option-text">{option.text}</span></label>)}</fieldset>
     {exercise.hint&&<div className="ia-adaptive-hint" role="status"><strong>Pista</strong><p>{exercise.hint}</p><small>Esta respuesta se registrará como práctica acompañada.</small></div>}
     <div className="ia-adaptive-actions"><button type="submit" className="ia-btn-primary" disabled={busy||!answer}>{busy?'Guardando…':'Comprobar respuesta'}</button>
      <button type="button" className="ia-btn-secondary" disabled={busy||exercise.hintUsed} onClick={()=>void hint()}>{exercise.hintUsed?'Pista consultada':'Necesito una pista'}</button>
      <button type="button" className="ia-btn-secondary" disabled={busy} onClick={()=>void submit('skip')}>No lo sé todavía</button></div>
    </form>:feedback&&<div className="ia-adaptive-feedback" data-correct={feedback.correct} role="status"><p>{feedback.feedback}</p><p className="ia-adaptive-caption">{feedback.hintUsed?'Practicaste con apoyo. Para consolidar también harán falta respuestas sin pista.':'El motor actualizó la estimación con esta respuesta.'}</p><button type="button" className="ia-btn-primary" disabled={busy||next?.kind==='complete'} data-orientation="adaptive-start" onClick={()=>void start()}>{next?.kind==='complete'?'Objetivo consolidado':'Continuar con el siguiente paso'}</button></div>}
   </article>}
   <section className="ia-adaptive-map-card"><h3><LayersIcon size={19}/> Mi mapa de conceptos</h3>
    <AdaptiveKnowledgeMap skills={data.skills} selected={selected} onSelect={setSelected}/>
    {selectedSkill&&<article className="ia-adaptive-concept"><div><h4>{selectedSkill.name}</h4><span>{SKILL_STATUS[selectedSkill.status]}</span></div><p>{selectedSkill.lesson}</p>
     <ReadAloudControls compact text={selectedSkill.lesson}/><p className="ia-adaptive-caption">{selectedSkill.attempts===0?'Aún no hay respuestas de este concepto. No asumimos que no lo sabes.':selectedSkill.distinctIndependentCorrect+' de 3 ejercicios distintos correctos sin pista para aportar evidencia de consolidación.'}</p>
    </article>}
    <p className="ia-adaptive-caption">Los porcentajes son estimaciones del piloto, no notas. Un concepto necesita al menos tres ejercicios distintos correctos sin pista y superar el umbral del modelo para figurar como consolidado.</p>
   </section>
   <details className="ia-adaptive-demo"><summary>Explorar un ejemplo del motor</summary><h3>¿Cómo cambia una recomendación?</h3><p>Compara un ejemplo antes y después de una dificultad. No modifica tu progreso.</p>
    <button type="button" className="ia-btn-secondary" disabled={busy} onClick={async()=>{if(demo){setDemoOpen(!demoOpen);return;}working(true);try{setDemo(await service.demo());setDemoOpen(true);}catch(cause){setError(cause instanceof Error?cause.message:'No se pudo cargar la simulación.');}finally{working(false);}}}>{demoOpen?'Cerrar simulación':'Ver simulación del motor'}</button>
    {demoOpen&&demo&&<div className="ia-adaptive-demo-grid"><article><small>Antes · sin evidencia</small><h4>{demo.before.recommendation.skillName}</h4><p>{demo.before.recommendation.reason}</p></article><article><small>Después · dificultad en el objetivo</small><h4>{demo.after.recommendation.skillName}</h4><p>{demo.after.recommendation.reason}</p></article></div>}
   </details>
   <footer className="ia-adaptive-bottom" hidden={!!exercise}><div><h3><CheckCircleIcon size={18}/> También puedes pedir apoyo humano</h3><p>Busca un tutor acreditado en la materia y comparte tus apoyos solo si tú lo decides.</p></div><Link to="/tutoring?tab=tutors&search=C%C3%A1lculo&verified=1" className="ia-btn-secondary">Buscar apoyo en Cálculo</Link></footer>
   <details className="ia-adaptive-method"><summary>Cómo funciona el motor · BKT y grafo de prerrequisitos</summary>
    <p>Modelo {data.model.version}: estima dominio mediante actualización bayesiana. Parámetros iniciales: prior {data.model.prior}, aprendizaje {data.model.learn}, acierto por azar {data.model.guess}, error pese a saber {data.model.slip}. Umbral: {data.model.threshold}. No está entrenado ni validado con datos reales de estudiantes.</p>
    <p>Las pistas sirven para aprender; una respuesta acompañada no se considera evidencia independiente. Los prerrequisitos y ejercicios son un piloto editorial que requiere validación docente externa.</p>
    {data.metrics?<p>Predicción antes de responder, últimas {data.metrics.count} respuestas sin pista: Brier {data.metrics.brier.toFixed(3)} · pérdida logarítmica {data.metrics.logLoss.toFixed(3)}. Estas métricas describen predicción; no demuestran eficacia educativa.</p>:<p>Las métricas aparecerán cuando respondas sin pista. No hay resultados de ejemplo mezclados con tu avance.</p>}
   </details>
  </>}
 </section>;
}

