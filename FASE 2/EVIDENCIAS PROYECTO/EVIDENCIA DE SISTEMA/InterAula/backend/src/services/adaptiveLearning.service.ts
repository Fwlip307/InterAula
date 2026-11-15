import {z} from 'zod';
import {getAdminSupabase,getAuthenticatedSupabase} from '../lib/supabase.js';
import {HttpError} from '../lib/httpError.js';
import {result} from './remote/database.js';
import {adaptiveSkills,COURSE_ID,DEFAULT_GOAL,createPracticeExercise,type PracticeExercise} from '../data/adaptiveCurriculum.js';
import {MODEL,recommendNext,publicMastery,type MasteryRecord} from './adaptiveEngine.js';

export const adaptiveGoalSchema=z.object({goal_skill_id:z.enum(adaptiveSkills.map(s=>s.id) as [string,...string[]])}).strict();
export const adaptiveAnswerSchema=z.object({answer:z.enum(['a','b','c','d','skip'])}).strict();
export const adaptiveAttemptId=z.string().uuid();
const course={id:COURSE_ID,name:'Cálculo: de álgebra a derivadas',pilot:true,contentStatus:'Piloto editorial pendiente de validación docente externa'};
function publicExercise(row:any){if(!row)return null;const q=row.exercise as PracticeExercise;return {attemptId:row.id,skillId:row.skill_id,templateId:row.template_id,prompt:q.prompt,options:q.options,hintUsed:row.hint_used,hint:row.hint_used?q.hint:undefined};}
async function read(userId:string) {
 const admin=getAdminSupabase();
 const [records,goals,history]=await Promise.all([
  result(admin.from('adaptive_skill_mastery').select('*').eq('user_id',userId).eq('course_id',COURSE_ID)),
  result(admin.from('adaptive_learning_goals').select('goal_skill_id').eq('user_id',userId).eq('course_id',COURSE_ID).maybeSingle()),
  result(admin.from('adaptive_practice_attempts').select('*').eq('user_id',userId).eq('course_id',COURSE_ID).order('created_at',{ascending:false}).limit(200)),
 ]);
 return {records:records as MasteryRecord[],goalId:goals?.goal_skill_id||DEFAULT_GOAL,history:history as any[]};
}
function overview(data:{records:MasteryRecord[];goalId:string;history:any[]},ready=true){
 const independent=data.history.filter(a=>a.answered_at&&!a.hint_used&&typeof a.predicted_correct==='number');
 const metrics=independent.length?{
  count:independent.length,
  brier:independent.reduce((sum,a)=>sum+(a.predicted_correct-(a.correct?1:0))**2,0)/independent.length,
  logLoss:independent.reduce((sum,a)=>{const p=Math.max(.000001,Math.min(.999999,a.predicted_correct));return sum-(a.correct?Math.log(p):Math.log(1-p));},0)/independent.length,
 }:null;
 return {ready,course,model:MODEL,goalId:data.goalId,skills:publicMastery(data.records,data.goalId),
  recommendation:recommendNext(data.records,data.goalId),activeExercise:publicExercise(data.history.find(a=>!a.answered_at)),
  metrics,answeredCount:data.records.reduce((sum,r)=>sum+r.attempts,0)};
}
async function ownedAttempt(userId:string,id:string){
 const row=await result(getAdminSupabase().from('adaptive_practice_attempts').select('*').eq('id',id).eq('user_id',userId).maybeSingle());
 if(!row)throw new HttpError(404,'Ejercicio no encontrado.');return row;
}
export const adaptiveLearningService={
 async getOverview(userId:string){
  try {
   const probe=await getAdminSupabase().from('adaptive_practice_attempts').select('id,model_version,hint_used,response_snapshot').limit(0);
   if(probe.error&&['PGRST205','PGRST204','42P01','42703'].includes(probe.error.code))return overview({records:[],goalId:DEFAULT_GOAL,history:[]},false);
   if(probe.error)throw new HttpError(503,'No se pudo consultar tu progreso adaptativo.');
   return overview(await read(userId));
  }catch(error){if(error instanceof HttpError&&error.code==='ASSESSMENT_NOT_CONFIGURED')return overview({records:[],goalId:DEFAULT_GOAL,history:[]},false);throw error;}
 },
 async setGoal(userId:string,goalId:string){
  const admin=getAdminSupabase(),data=await read(userId);
  if(data.history.some(a=>!a.answered_at))throw new HttpError(409,'Responde el ejercicio en curso antes de cambiar de objetivo.');
  await result(admin.from('adaptive_learning_goals').upsert({user_id:userId,course_id:COURSE_ID,goal_skill_id:goalId,updated_at:new Date().toISOString()},{onConflict:'user_id,course_id'}));
  return this.getOverview(userId);
 },
 async start(userId:string){
  const admin=getAdminSupabase(),data=await read(userId);
  const pending=data.history.find(a=>!a.answered_at);if(pending)return publicExercise(pending);
  const next=recommendNext(data.records,data.goalId);
  if(next.kind==='complete')throw new HttpError(409,'Ya consolidaste este objetivo en el piloto. Elige otro para continuar.');
  const exercise=createPracticeExercise(next.skillId,data.history.filter(a=>a.skill_id===next.skillId).map(a=>a.template_id));
  const created=await admin.from('adaptive_practice_attempts').insert({user_id:userId,course_id:COURSE_ID,skill_id:exercise.skillId,template_id:exercise.templateId,model_version:MODEL.version,exercise}).select('*').single();
  if(created.error?.code==='23505'){const current=await read(userId);return publicExercise(current.history.find(a=>!a.answered_at));}
  return publicExercise(await result(Promise.resolve(created)));
 },
 async hint(userId:string,id:string){
  const current=await ownedAttempt(userId,id);if(current.answered_at)throw new HttpError(409,'Ese ejercicio ya terminó.');
  const updated=await result(getAdminSupabase().from('adaptive_practice_attempts').update({hint_used:true}).eq('id',id).eq('user_id',userId).is('answered_at',null).select('id').maybeSingle());
  if(!updated)throw new HttpError(409,'El ejercicio cambió. Actualiza tu progreso.');
  return {hint:current.exercise.hint};
 },
 async answer(userId:string,token:string,id:string,answer:string){
  await ownedAttempt(userId,id);
  const feedback=await result(getAuthenticatedSupabase(token).rpc('submit_adaptive_practice',{p_attempt_id:id,p_answer:answer}),'No se pudo guardar tu respuesta. Si ya respondiste, recupera el estado.');
  return {feedback,overview:await this.getOverview(userId)};
 },
 demo(){
  const root=adaptiveSkills.find(s=>s.id==='equations')!;
  const records:MasteryRecord[]=[{skill_id:DEFAULT_GOAL,mastery:.12,attempts:1,correct_count:0,independent_correct_ids:[],last_correct:false,updated_at:'2026-01-01T00:00:00Z'}];
  return {label:'Simulación: no modifica tu progreso',before:overview({records:[],goalId:DEFAULT_GOAL,history:[]}),after:overview({records,goalId:DEFAULT_GOAL,history:[]}),examplePrerequisite:root.name};
 },
};

