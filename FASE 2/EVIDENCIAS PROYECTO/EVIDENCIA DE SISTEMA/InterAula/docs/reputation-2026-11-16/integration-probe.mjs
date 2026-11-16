// Real Express -> ephemeral PostgreSQL. All identities, reviews and confirmations are synthetic.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
await import('../../backend/dist/tests/setup.js');
const {createTestPostgres}=await import('../../backend/dist/tests/helpers/postgres.js');
const {env}=await import('../../backend/dist/config/env.js');
const {app}=await import('../../backend/dist/app.js');
const {supabasePublic}=await import('../../backend/dist/lib/supabase.js');
const {tutoringBackendService}=await import('../../backend/dist/services/tutoring.service.js');
const {createRequire}=await import('node:module');
const require=createRequire(new URL('../../backend/package.json',import.meta.url)),request=require('supertest');
assert.equal(env.nodeEnv,'test');assert.equal(env.supabaseUrl,'http://127.0.0.1:9');env.corsOrigins.push('http://127.0.0.1:5175');
globalThis.fetch=async()=>{throw Error('External network blocked in reputation fixture');};
const db=await createTestPostgres(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tutor=id(501),students=Array.from({length:5},(_,i)=>id(510+i)),session=id(900);
for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
for(const actor of[tutor,...students])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,actor+'@example.test']);
const subject=(await db.query('SELECT id FROM public.subjects LIMIT 1')).rows[0].id;
await db.exec('SET session_replication_role=replica');
await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[tutor,subject]);
for(let i=0;i<10;i++){
 const s=id(800+i),student=students[i%5];
 await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,completion_verified_at,completion_method,attendance_verified) VALUES($1,$2,$3,$4,now()-make_interval(days=>$5),'completed',now(),'attendance',true)",[s,student,tutor,subject,i+1]);
 await db.query('INSERT INTO public.tutoring_reviews(session_id,student_id,tutor_id,communication_score,knowledge_score,punctuality_score) VALUES($1,$2,$3,$4,$4,$4)',[s,student,tutor,i===0?9:10]);
}
await db.query("INSERT INTO public.user_badges(profile_id,badge_id) SELECT $1,id FROM public.badges WHERE code IN('tutoring_1','tutoring_10')",[tutor]);
await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,modality) VALUES($1,$2,$3,$4,now()-interval '3 hours','accepted','in_person')",[session,students[0],tutor,subject]);
await db.exec('SET session_replication_role=origin');
const actors={'qa-tutor':tutor,'qa-student':students[0]};
supabasePublic.auth.getUser=async token=>({data:{user:actors[token]?{id:actors[token],user_metadata:{},app_metadata:{}}:null},error:actors[token]?null:Error('Unknown fixture token')});
tutoringBackendService.getSessionById=async(user,_token,s)=>{
 const row=(await db.query('SELECT * FROM public.tutoring_sessions WHERE id=$1',[s])).rows[0];
 if(!row||![row.tutor_id,row.student_id].includes(user.id))throw Error('Forbidden fixture session');
 row.review=(await db.query('SELECT * FROM public.tutoring_reviews WHERE session_id=$1',[s])).rows[0]||null;
 return {...row,subject:{id:subject,name:'Matemáticas DEMO'},tutor:{id:tutor,display_name:'Tutor DEMO'},student:{id:students[0],display_name:'Estudiante DEMO'}};
};
Object.getPrototypeOf(supabasePublic).rpc=async function(name,args){
 assert.equal(name,'confirm_tutoring_completion');
 try{return {data:(await db.query('SELECT public.confirm_tutoring_completion($1) AS value',[args.p_session_id])).rows[0].value,error:null};}
 catch(error){return {data:null,error:{code:error.code}};}
};
Object.getPrototypeOf(supabasePublic).from=function(table){
 assert.ok(['tutor_reputation_public','tutoring_reviews'].includes(table));let profileId,payload;
 const q={select(){return q;},eq(_key,value){profileId=value;return q;},insert(value){payload=value;return q;},async maybeSingle(){
  return {data:(await db.query('SELECT * FROM public.tutor_reputation_public WHERE profile_id=$1',[profileId])).rows[0]||null,error:null};},async single(){
   try{const data=(await db.query('INSERT INTO public.tutoring_reviews(session_id,student_id,tutor_id,communication_score,knowledge_score,punctuality_score,comment) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[payload.session_id,payload.student_id,payload.tutor_id,payload.communication_score,payload.knowledge_score,payload.punctuality_score,payload.comment])).rows[0];return {data,error:null};}
   catch(error){return {data:null,error:{code:error.code}};}
  }};return q;
};
// Serialize requests so SQL SET ROLE/auth.uid belong to exactly one fixture request.
let queue=Promise.resolve();
const server=http.createServer((req,res)=>{
 const previous=queue;let release;queue=new Promise(resolve=>release=resolve);
 previous.then(async()=>{
  const token=(req.headers.authorization||'').replace(/^Bearer /,''),actor=actors[token]||'';
  await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');
  res.on('finish',release);res.on('close',release);app(req,res);
 }).catch(error=>{console.error('Fixture request failed',error.code);res.statusCode=500;res.end();release();});
});
const call=(method,url,token)=>request(server)[method](url).set('Authorization','Bearer '+token);
assert.equal((await request(server).post(`/api/tutoring/sessions/${session}/confirm-completion`).send({})).status,401);
assert.equal((await call('get','/api/tutoring/reputation/'+tutor,'qa-student')).body.data.reputation.communication_highlight,true);
const first=await call('post',`/api/tutoring/sessions/${session}/confirm-completion`,'qa-tutor').send({});assert.equal(first.body.data.status,'accepted');
const second=await call('post',`/api/tutoring/sessions/${session}/confirm-completion`,'qa-student').send({});assert.equal(second.body.data.status,'completed');
const review=await call('post',`/api/tutoring/sessions/${session}/reviews`,'qa-student').send({communication_score:1,knowledge_score:1,punctuality_score:1,comment:'Datos ficticios de prueba'});assert.equal(review.status,201);
const rep=(await call('get','/api/tutoring/reputation/'+tutor,'qa-student')).body.data.reputation;
assert.equal(rep.communication_highlight,false);assert.equal(rep.valid_sessions,11);assert.equal(rep.recent_reviews,11);
await db.exec('RESET ROLE');assert.equal((await db.query('SELECT * FROM public.user_badges WHERE profile_id=$1',[tutor])).rows.length,2);
fs.writeFileSync('docs/reputation-2026-11-16/integration-verification.json',JSON.stringify({passed:true,firstConfirmation:'accepted',secondConfirmation:'completed',poorReviewRemovesQuality:true,milestonesPreserved:2,scope:'Real HTTP Express to ephemeral PostgreSQL with synthetic accounts only. No Supabase, Gemini, emails or real credentials.'},null,2));
// Reset the fixture by deleting only synthetic pending-session evidence; not a real database.
await db.exec('SET session_replication_role=replica');await db.query('DELETE FROM public.tutoring_reviews WHERE session_id=$1',[session]);
await db.query("UPDATE public.tutoring_sessions SET status='accepted',completion_verified_at=NULL,completion_method=NULL,tutor_completion_confirmed_at=NULL,student_completion_confirmed_at=NULL WHERE id=$1",[session]);await db.exec('SET session_replication_role=origin');
console.log(JSON.stringify({passed:true,tutor,student:students[0],session}));
if(process.argv.includes('--serve'))server.listen(3002,'127.0.0.1',()=>console.log('Synthetic reputation API on 127.0.0.1:3002'));
else{server.close();await db.close();}
