import {useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import type {OrientationStep} from '../../content/orientationFlows';
import {positionOrientationTour,type SpotlightRect} from '../../utils/orientationSpotlight';
import {focusOrientationTarget} from '../../hooks/useOrientationTarget';
import {XIcon} from '../common/Icons';

interface Props{
 step:OrientationStep;flowTitle:string;index:number;total:number;atStep:boolean;
 target:{element:HTMLElement|null;rect:SpotlightRect|null;waiting:boolean};
 heading:RefObject<HTMLHeadingElement|null>;audio:ReactNode;
 close:()=>void;pause:()=>void;back:()=>void;next:()=>void;returnToStep:()=>void;
}
export default function OrientationTour({step,flowTitle,index,total,atStep,target,heading,audio,close,pause,back,next,returnToStep}:Props){
 const card=useRef<HTMLElement>(null),[height,setHeight]=useState(430);
 const readViewport=()=>({width:document.documentElement.clientWidth,height:window.visualViewport?.height||window.innerHeight});
 const [viewport,setViewport]=useState(readViewport);
 useLayoutEffect(()=>{
  const update=()=>setViewport(readViewport());
  window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);
  return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};
 },[]);
 useLayoutEffect(()=>{
  const element=card.current;if(!element)return;
  const update=()=>{const value=element.getBoundingClientRect().height;if(value>0)setHeight(previous=>Math.abs(previous-value)<1?previous:value);};
  update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
 },[]);
 const layout=positionOrientationTour(atStep?target.rect:null,viewport,height);
 const hole=layout.hole,disabled=Boolean(target.element?.matches(':disabled,[aria-disabled="true"]'));
 const mask=hole?'M0 0H'+viewport.width+'V'+viewport.height+'H0Z M'+hole.left+' '+hole.top+'v'+hole.height+'h'+hole.width+'v-'+hole.height+'Z':'';
 return <div className="ia-orientation-tour" data-placement={layout.placement}>
  {hole&&<svg className="ia-orientation-scrim" width={viewport.width} height={viewport.height} viewBox={'0 0 '+viewport.width+' '+viewport.height} aria-hidden="true" data-testid="orientation-spotlight">
   <path d={mask} fillRule="evenodd"/>
   <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="7" className="ia-orientation-hole"/>
  </svg>}
  <aside id="ia-orientation-panel" ref={card} className="ia-orientation-panel ia-orientation-callout" aria-labelledby="ia-orientation-title" style={{left:layout.left,top:layout.top,width:layout.width,maxHeight:layout.maxHeight}} data-placement={layout.placement}>
   {hole&&!['overlap','center'].includes(layout.placement)&&<span aria-hidden="true" className="ia-orientation-arrow" style={layout.placement==='top'||layout.placement==='bottom'?{left:layout.arrow}:{top:layout.arrow}}/>}
   <header><div><span className="ia-orientation-label">{flowTitle} · Paso {index+1} de {total}</span><h2 id="ia-orientation-title" ref={heading} tabIndex={-1}>{step.title}</h2></div><button type="button" className="ia-orientation-close" aria-label="Cerrar orientador" onClick={close}><XIcon size={18} aria-hidden="true"/>Cerrar</button></header>
   <div className="ia-orientation-content">
    <p className="ia-orientation-instruction" role="status">{step.instruction}</p>
    {!atStep?<div className="ia-orientation-notice">Estás en otra sección. Puedes volver al paso o pausar el recorrido.<button type="button" onClick={returnToStep}>Volver al paso</button></div>:!target.element?<p className="ia-orientation-notice" role="status">{target.waiting?'Buscando el control en esta pantalla…':step.missing}</p>:<>
     {hole?<p className="ia-orientation-target-status">Área señalada: <strong>{step.control}</strong>.</p>:<p className="ia-orientation-notice">El control quedó fuera de vista. Usa “Llevar el foco al control” para volver a verlo.</p>}
     {disabled&&<p className="ia-orientation-notice">Ese control todavía no está disponible. Revisa los avisos de la pantalla o termina la actividad en curso.</p>}
     <button type="button" className="ia-orientation-focus" disabled={disabled} onClick={()=>focusOrientationTarget(target.element!)}>Llevar el foco al control</button>
    </>}
    {audio}
   </div>
   <footer><div className="ia-orientation-step-actions"><button type="button" disabled={index===0} onClick={back}>Anterior</button><button type="button" className="ia-btn-primary" onClick={next}>{index===total-1?'Terminar recorrido':'Siguiente paso'}</button></div><button type="button" onClick={pause}>Pausar recorrido y volver al chat</button></footer>
  </aside>
 </div>;
}
