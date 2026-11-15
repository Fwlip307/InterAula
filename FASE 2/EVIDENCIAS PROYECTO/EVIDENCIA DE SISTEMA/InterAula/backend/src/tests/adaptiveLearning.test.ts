import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';
import {env} from '../config/env.js';
import {adaptiveLearningService} from '../services/adaptiveLearning.service.js';
import {adaptiveSkills,exerciseTemplates,createPracticeExercise,COURSE_ID} from '../data/adaptiveCurriculum.js';
import {bktUpdate,isMastered,initialMastery,validateKnowledgeGraph,recommendNext} from '../services/adaptiveEngine.js';
import {createTestPostgres} from './helpers/postgres.js';

test('El grafo es acíclico, tiene diez conceptos y cuarenta ejercicios con alternativas únicas',()=>{
 assert.equal(adaptiveSkills.length,10);assert.equal(exerciseTemplates.length,40);
 assert.equal(validateKnowledgeGraph(adaptiveSkills).length,10);
 assert.throws(()=>validateKnowledgeGraph([{...adaptiveSkills[0],prerequisites:['unknown']}]));
 assert.throws(()=>validateKnowledgeGraph([{...adaptiveSkills[0],prerequisites:['equations']}]));
 for(const skill of adaptiveSkills){
  assert.equal(exerciseTemplates.filter(e=>e.skillId===skill.id).length,4);
  const q=createPracticeExercise(skill.id);
  assert.equal(new Set(q.options.map(o=>o.text)).size,4);assert.ok(q.options.some(o=>o.id===q.correctOptionId));
  assert.notEqual(createPracticeExercise(skill.id,[q.templateId]).templateId,q.templateId);
 }
});
test('BKT aplica Bayes, mantiene probabilidades válidas y una pista no simula dominio independiente',()=>{
 const correct=bktUpdate(.2,true),wrong=bktUpdate(.2,false);
 assert.ok(Math.abs(correct.predictedCorrect-.38)<1e-12);
 assert.ok(Math.abs(correct.posterior-(.18/.38*.9+.1))<1e-12);
 assert.ok(wrong.posterior<.2);assert.equal(bktUpdate(.2,true,true).posterior,.2);
 assert.throws(()=>bktUpdate(NaN,true));
 for(const prior of [0,.0001,.2,.8,.9999,1])for(const outcome of [true,false]){const value=bktUpdate(prior,outcome).posterior;assert.ok(value>=0&&value<=1);}
 assert.equal(isMastered({...initialMastery('powers'),mastery:.99,independent_correct_ids:['same','same','same']}),false);
 assert.equal(isMastered({...initialMastery('powers'),mastery:.9,independent_correct_ids:['a','b','c']}),true);
});
test('Dos historiales producen decisiones diferentes y una dificultad conduce a un prerrequisito explicable',()=>{
 const initial=recommendNext([]);assert.equal(initial.kind,'diagnostic');assert.equal(initial.skillId,'chain');
 const weak={...initialMastery('chain'),attempts:1,last_correct:false,mastery:.12};
 const next=recommendNext([weak]);assert.equal(next.kind,'reinforce');assert.notEqual(next.skillId,'chain');
 assert.ok(next.prerequisitePath.includes(next.skillId));assert.ok(next.reason.includes('prerrequisito'));
 const completed=recommendNext([{...weak,mastery:.95,independent_correct_ids:['1','2','3'],last_correct:true}]);
 assert.equal(completed.kind,'complete');
});
test('HTTP: identidad de sesión, respuestas estrictas, sin notas inyectadas y rutas protegidas',async(t)=>{
 const user='00000000-0000-0000-0000-000000000751';
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:user,user_metadata:{},app_metadata:{}}},error:null}));
 t.mock.method(adaptiveLearningService,'getOverview',async(id:string)=>{assert.equal(id,user);return {ready:true};});
 t.mock.method(adaptiveLearningService,'answer',async(id:string,_token:string,attempt:string,answer:string)=>{assert.equal(id,user);assert.equal(answer,'skip');return {feedback:{attemptId:attempt},overview:{ready:true}} as any;});
 assert.equal((await request(app).get('/api/learning-space/adaptive/overview')).status,401);
 const auth=(call:request.Test)=>call.set('Authorization','Bearer fixture');
 assert.equal((await auth(request(app).get('/api/learning-space/adaptive/overview'))).status,200);
 const endpoint='/api/learning-space/adaptive/practice/00000000-0000-0000-0000-000000000752/answer';
 assert.equal((await auth(request(app).post(endpoint)).send({answer:'a',correct:true,mastery:1})).status,400);
 assert.equal((await auth(request(app).post(endpoint)).send({answer:'skip'})).status,200);
 assert.equal((await auth(request(app).put('/api/learning-space/adaptive/goal')).send({goal_skill_id:'inventado'})).status,400);
 assert.equal((await auth(request(app).put('/api/learning-space/adaptive/goal')).send({goal_skill_id:'chain',user_id:'other'})).status,400);
});
test('El servicio recupera el mismo ejercicio sin exponer solución y separa el avance de dos cuentas',async(t)=>{
 const previous=env.supabaseServiceRoleKey;env.supabaseServiceRoleKey='isolated-server-key';t.after(()=>{env.supabaseServiceRoleKey=previous;});
 const tables:Record<string,any[]>={adaptive_practice_attempts:[],adaptive_skill_mastery:[],adaptive_learning_goals:[]};
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
  let action='select',payload:any,single=false,cap=200;const filters:Record<string,any>={};
  const q:any={select:()=>q,order:()=>q,eq:(key:string,value:any)=>{filters[key]=value;return q;},is:(key:string,value:any)=>{filters[key]=value;return q;},limit:(value:number)=>{cap=value;return q;},single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},insert:(value:any)=>{payload=value;action='insert';return q;},update:(value:any)=>{payload=value;action='update';return q;},
   then:(resolve:any)=>{const all=tables[table];let rows=all.filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value));
    if(action==='insert'){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),answered_at:null,hint_used:false,...payload};all.push(row);rows=[row];}
    if(action==='update')rows.forEach(row=>Object.assign(row,payload));
    return Promise.resolve({data:structuredClone(single?(rows[0]||null):rows.slice(0,cap)),error:null}).then(resolve);
   }};return q;
 });
 const first=await adaptiveLearningService.start('owner'),same=await adaptiveLearningService.start('owner');
 assert.equal(first!.attemptId,same!.attemptId);assert.equal(tables.adaptive_practice_attempts.length,1);
 for(const secret of ['correctOptionId','explanation','hint'])assert.equal(JSON.stringify(first).includes('"'+secret+'"'),false);
 await assert.rejects(adaptiveLearningService.hint('other',first!.attemptId),{status:404});
 await assert.rejects(adaptiveLearningService.setGoal('owner','powers'),{status:409});
 const before=await adaptiveLearningService.getOverview('owner');assert.equal(before.activeExercise?.attemptId,first!.attemptId);
 const hint=await adaptiveLearningService.hint('owner',first!.attemptId);assert.ok(hint.hint);
 assert.equal((await adaptiveLearningService.getOverview('owner')).activeExercise?.hintUsed,true);
 assert.equal((await adaptiveLearningService.getOverview('other')).activeExercise,null);
});
test('PostgreSQL: respuestas atómicas, idempotencia, privacidad, pistas y concordancia con BKT',async()=>{
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 const owner='00000000-0000-0000-0000-000000000751',other='00000000-0000-0000-0000-000000000752';
 const as=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('SET ROLE authenticated');};
 async function insert(templateId:string,hint=false){
  await db.exec('RESET ROLE');const q=createPracticeExercise('powers');q.templateId=templateId;
  const row:any=(await db.query('INSERT INTO public.adaptive_practice_attempts(user_id,course_id,skill_id,template_id,exercise,hint_used) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[owner,COURSE_ID,'powers',templateId,JSON.stringify(q),hint])).rows[0];
  return {id:row.id,q};
 }
 try{
  for(const file of (await fs.readdir(dir)).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,3))<=24).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'adaptive1@example.test'),($2,'adaptive2@example.test')",[owner,other]);
  let first=await insert('powers-1');await as(other);
  await assert.rejects(db.query('SELECT public.submit_adaptive_practice($1,$2)',[first.id,first.q.correctOptionId]));
  await as(owner);
  await assert.rejects(db.query('SELECT * FROM public.adaptive_practice_attempts'));
  await assert.rejects(db.query("INSERT INTO public.adaptive_skill_mastery(user_id,course_id,skill_id,mastery) VALUES($1,$2,'powers',1)",[owner,COURSE_ID]));
  await assert.rejects(db.query('SELECT public.submit_adaptive_practice($1,NULL)',[first.id]));
  const grade=async(id:string,answer:string)=>(await db.query<any>('SELECT public.submit_adaptive_practice($1,$2) AS result',[id,answer])).rows[0].result;
  const a=await grade(first.id,first.q.correctOptionId);assert.equal(a.correct,true);
  assert.ok(Math.abs(a.masteryAfter-bktUpdate(.2,true).posterior)<1e-12);
  assert.deepEqual(await grade(first.id,first.q.correctOptionId),a);
  await assert.rejects(grade(first.id,'skip'));
  assert.equal((await db.query<any>('SELECT attempts FROM public.adaptive_skill_mastery')).rows[0].attempts,1);
  const duplicate=await insert('powers-1');await as(owner);const b=await grade(duplicate.id,duplicate.q.correctOptionId);
  assert.equal(b.distinctIndependentCorrect,1);
  const hint=await insert('powers-2',true);await as(owner);const h=await grade(hint.id,hint.q.correctOptionId);
  assert.equal(h.masteryAfter,h.masteryBefore);assert.equal(h.distinctIndependentCorrect,1);
  for(const template of ['powers-2','powers-3']){const next=await insert(template);await as(owner);await grade(next.id,next.q.correctOptionId);}
  const consolidated:any=(await db.query('SELECT * FROM public.adaptive_skill_mastery')).rows[0];
  assert.equal(isMastered(consolidated),true);
  const skipped=await insert('powers-4');await as(owner);const s=await grade(skipped.id,'skip');
  assert.equal(s.correct,false);assert.equal(s.skipped,true);assert.ok(s.masteryAfter<s.masteryBefore);
  await as(other);assert.equal((await db.query('SELECT * FROM public.adaptive_skill_mastery')).rows.length,0);
  await db.exec('RESET ROLE');
  await db.exec(await fs.readFile(path.join(dir,'../ACTIVAR_APRENDIZAJE_ADAPTATIVO.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(dir,'../ACTIVAR_APRENDIZAJE_ADAPTATIVO.sql'),'utf8'));
  const probe:any=(await db.query('SELECT count(*)::int AS n FROM public.adaptive_practice_attempts')).rows[0];assert.equal(probe.n,6);
  assert.equal((await db.query<any>("SELECT has_table_privilege('anon','public.adaptive_practice_attempts','SELECT') AS allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

