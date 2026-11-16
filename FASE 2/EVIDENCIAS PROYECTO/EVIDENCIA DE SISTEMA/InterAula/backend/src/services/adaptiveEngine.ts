import {adaptiveSkills,DEFAULT_GOAL,type AdaptiveSkill} from '../data/adaptiveCurriculum.js';
export const MODEL={version:'bkt-calculo-v1',prior:0.2,learn:0.1,guess:0.25,slip:0.1,threshold:0.85,minDistinctCorrect:3} as const;
export interface MasteryRecord {skill_id:string;mastery:number;attempts:number;correct_count:number;independent_correct_ids:string[];last_correct:boolean|null;updated_at?:string}
export const initialMastery=(skillId:string):MasteryRecord=>({skill_id:skillId,mastery:MODEL.prior,attempts:0,correct_count:0,independent_correct_ids:[],last_correct:null});
export function bktUpdate(prior:number,correct:boolean,hintUsed=false) {
 if(!Number.isFinite(prior)||prior<0||prior>1)throw new Error('Probabilidad fuera de rango');
 const predictedCorrect=prior*(1-MODEL.slip)+(1-prior)*MODEL.guess;
 const evidence=hintUsed?prior:correct?prior*(1-MODEL.slip)/predictedCorrect:prior*MODEL.slip/(prior*MODEL.slip+(1-prior)*(1-MODEL.guess));
 return {predictedCorrect,posterior:hintUsed?prior:evidence+(1-evidence)*MODEL.learn};
}
export function validateKnowledgeGraph(skills:AdaptiveSkill[]) {
 const byId=new Map(skills.map(s=>[s.id,s]));
 if(byId.size!==skills.length)throw new Error('Conceptos duplicados');
 const seen=new Set<string>(),visiting=new Set<string>(),ordered:string[]=[];
 function visit(id:string){if(visiting.has(id))throw new Error('El grafo contiene un ciclo');if(seen.has(id))return;const skill=byId.get(id);if(!skill)throw new Error('Prerrequisito inexistente');visiting.add(id);skill.prerequisites.forEach(visit);visiting.delete(id);seen.add(id);ordered.push(id);}
 skills.forEach(s=>visit(s.id));return ordered;
}
validateKnowledgeGraph(adaptiveSkills);
export function isMastered(record:MasteryRecord){return record.mastery>=MODEL.threshold&&new Set(record.independent_correct_ids).size>=MODEL.minDistinctCorrect;}
export function recommendNext(records:MasteryRecord[],goalId=DEFAULT_GOAL) {
 const byId=new Map(adaptiveSkills.map(s=>[s.id,s])),states=new Map(records.map(r=>[r.skill_id,r]));
 const goal=byId.get(goalId);if(!goal)throw new Error('Objetivo no disponible');
 const state=(id:string)=>states.get(id)||initialMastery(id);
 const relevant=new Set<string>();
 function collect(id:string){relevant.add(id);byId.get(id)!.prerequisites.forEach(collect);}collect(goalId);
 function frontier(id:string,path:string[]=[]):{id:string;path:string[]} {
  const missing=byId.get(id)!.prerequisites.filter(p=>!isMastered(state(p)));
  if(!missing.length)return {id,path:[...path,id]};
  missing.sort((a,b)=>state(a).mastery-state(b).mastery||a.localeCompare(b));
  return frontier(missing[0],[...path,id]);
 }
 let chosen=goalId,kind:'diagnostic'|'practice'|'reinforce'|'complete'='practice',path=[goalId];
 const goalState=state(goalId);
 if(isMastered(goalState))kind='complete';
 else if(goalState.attempts===0)kind='diagnostic';
 else if(goalState.last_correct===false){
  const next=frontier(goalId);chosen=next.id;path=next.path;kind='reinforce';
 } else {
  const unresolved=[...relevant].filter(id=>state(id).attempts>0&&!isMastered(state(id)));
  const last=unresolved.sort((a,b)=>(state(b).updated_at||'').localeCompare(state(a).updated_at||''))[0];
  if(last&&last!==goalId){const next=frontier(last);chosen=next.id;path=next.path;kind=chosen===last?'practice':'reinforce';}
  else {chosen=goalId;}
 }
 // After prerequisites consolidate, return to the most advanced ready concept on the goal path.
 if(kind==='reinforce'&&isMastered(state(chosen))) {chosen=goalId;kind='practice';path=[goalId];}
 const skill=byId.get(chosen)!;
 const reason=kind==='complete'?'Completaste al menos tres ejercicios distintos sin pista y alcanzaste el umbral estimado de este concepto.'
 :kind==='diagnostic'?'Comencemos con una comprobación breve de tu objetivo. No hay evidencia previa de este concepto.'
 :chosen!==goalId?'Para avanzar en '+goal.name+', conviene reforzar '+skill.name+': es un prerrequisito de la ruta y todavía no hay evidencia suficiente de dominio.'
 :goalState.last_correct===false?'Probemos otra actividad del mismo concepto y revisemos la explicación. Un error no termina la práctica.'
 :'Vamos a comprobar el concepto con otro ejercicio. Una sola respuesta no basta para estimar dominio.';
 return {kind,skillId:chosen,goalId,reason,prerequisitePath:path,goalName:goal.name,skillName:skill.name,
  relevantSkillIds:[...relevant],evidence:{attempts:state(chosen).attempts,distinctIndependentCorrect:new Set(state(chosen).independent_correct_ids).size}};
}
export function publicMastery(records:MasteryRecord[],goalId=DEFAULT_GOAL){
 const states=new Map(records.map(r=>[r.skill_id,r])),recommendation=recommendNext(records,goalId);
 return adaptiveSkills.map(skill=>{
  const state=states.get(skill.id)||initialMastery(skill.id);
  return {...skill,attempts:state.attempts,correctCount:state.correct_count,mastery:state.attempts?state.mastery:null,
   distinctIndependentCorrect:new Set(state.independent_correct_ids).size,
   status:isMastered(state)?'consolidated':!state.attempts?'unexplored':state.last_correct===false?'reinforce':'practicing',
   relevant:recommendation.relevantSkillIds.includes(skill.id),recommended:recommendation.kind!=='complete'&&recommendation.skillId===skill.id};
 });
}

