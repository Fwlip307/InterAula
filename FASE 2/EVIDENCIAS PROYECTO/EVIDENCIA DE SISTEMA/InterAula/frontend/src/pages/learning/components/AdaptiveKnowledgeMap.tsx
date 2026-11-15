import {useId} from 'react';
import type {AdaptiveSkillView} from '../../../types/adaptiveLearning';
const positions:Record<string,[number,number]>={equations:[100,70],powers:[100,310],functions:[305,70],factoring:[305,310],limits:[510,100],indeterminate:[510,310],definition:[715,310],'power-rule':[715,100],chain:[920,100],optimization:[920,310]};
export const SKILL_STATUS={consolidated:'Consolidado en el piloto',unexplored:'Sin práctica',reinforce:'Para reforzar',practicing:'En práctica'};
export default function AdaptiveKnowledgeMap({skills,selected,onSelect}:{skills:AdaptiveSkillView[];selected:string|null;onSelect:(id:string)=>void}){
 const marker=useId().replaceAll(':','');
 const content=(skill:AdaptiveSkillView)=><><span className="ia-adaptive-node-title">{skill.name}</span><small>{skill.recommended?'Próximo paso · ':''}{SKILL_STATUS[skill.status]}</small>{skill.mastery!==null&&<span className="ia-adaptive-node-estimate">{Math.round(skill.mastery*100)}% estimado</span>}</>;
 return <div>
  <p className="ia-adaptive-map-help">Las flechas conectan los conceptos previos con los que los utilizan. Selecciona un concepto para ver su explicación.</p>
  <div className="ia-adaptive-map-desktop"><div className="ia-adaptive-map-canvas">
   <svg viewBox="0 0 1020 405" aria-hidden="true"><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker></defs>
    {skills.flatMap(skill=>skill.prerequisites.map(prerequisite=>{
     const a=positions[prerequisite],b=positions[skill.id];if(!a||!b)return null;
     const x1=a[0]+82,y1=a[1]+25,x2=b[0]-82,y2=b[1]+25;
     return <path key={prerequisite+'-'+skill.id} d={'M'+x1+','+y1+' C'+(x1+48)+','+y1+' '+(x2-48)+','+y2+' '+x2+','+y2} fill="none" stroke="currentColor" strokeWidth="1.6" markerEnd={'url(#'+marker+')'} opacity={skill.relevant ? .7 : .25}/>;
    }))}
   </svg>
   {skills.map(skill=><button type="button" key={skill.id} className="ia-adaptive-node" data-state={skill.status} data-recommended={skill.recommended} data-relevant={skill.relevant} aria-pressed={selected===skill.id} onClick={()=>onSelect(skill.id)} style={{left:positions[skill.id][0]-82,top:positions[skill.id][1]-14}}>{content(skill)}</button>)}
  </div></div>
  <ol className="ia-adaptive-map-mobile">{skills.map(skill=><li key={skill.id}><button type="button" data-state={skill.status} data-recommended={skill.recommended} aria-pressed={selected===skill.id} onClick={()=>onSelect(skill.id)}>{content(skill)}<small>Previos: {skill.prerequisites.map(id=>skills.find(s=>s.id===id)?.name).join(', ')||'Punto de partida'}</small></button></li>)}</ol>
 </div>;
}

