import {useEffect,useState} from 'react';
import type {OrientationStep} from '../content/orientationFlows';

type Target={element:HTMLElement|null;rect:{left:number;top:number;width:number;height:number}|null;waiting:boolean};
const EMPTY:Target={element:null,rect:null,waiting:false};
/** Highlights only. Never clicks, enters values, submits, or advances a workflow. */
export function useOrientationTarget(step:OrientationStep|null,active:boolean){
 const [target,setTarget]=useState<Target>(EMPTY);
 useEffect(()=>{
  if(!active||!step){setTarget(EMPTY);return;}
  let element:HTMLElement|null=null,scrolled=false,expired=false,frame=0;
  setTarget({...EMPTY,waiting:true});
  const restore=()=>{element?.removeAttribute('data-orientation-active');};
  const update=()=>{
   frame=0;
   const found=[...document.querySelectorAll<HTMLElement>(step.selector)].find(item=>item.getClientRects().length>0&&item.getBoundingClientRect().width>0)||null;
   if(found!==element){if(element)sizeObserver.unobserve(element);restore();element=found;if(element)sizeObserver.observe(element);scrolled=false;}
   if(!element){setTarget({element:null,rect:null,waiting:!expired});return;}
   element.setAttribute('data-orientation-active','true');
   if(!scrolled){scrolled=true;element.scrollIntoView({block:'start',behavior:'auto'});}
   const rect=element.getBoundingClientRect();
   setTarget({element,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},waiting:false});
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const sizeObserver=new ResizeObserver(schedule);
  const observer=new MutationObserver(schedule);
  const main=document.getElementById('ia-main-content');
  observer.observe(main?.closest('.ia-layout')||main||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','style','class']});
  const timeout=window.setTimeout(()=>{expired=true;schedule();},1800);
  const resized=()=>{scrolled=false;schedule();};
  window.addEventListener('resize',resized);window.addEventListener('scroll',schedule,true);
  schedule();
  return()=>{restore();observer.disconnect();sizeObserver.disconnect();clearTimeout(timeout);cancelAnimationFrame(frame);window.removeEventListener('resize',resized);window.removeEventListener('scroll',schedule,true);};
 },[step,active]);
 return target;
}
export function focusOrientationTarget(element:HTMLElement){
 const control=element.matches('input,select,textarea,button,a[href]')?element:element.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),a[href]');
 if(control){control.scrollIntoView({block:'start',behavior:'auto'});control.focus({preventScroll:true});return;}
 element.scrollIntoView({block:'start',behavior:'auto'});
 const original=element.getAttribute('tabindex');element.setAttribute('tabindex','-1');element.focus({preventScroll:true});
 element.addEventListener('blur',()=>{if(original===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',original);},{once:true});
}
