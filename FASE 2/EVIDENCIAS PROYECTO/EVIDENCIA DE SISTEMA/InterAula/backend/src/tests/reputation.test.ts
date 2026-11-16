import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';
import {reputationService} from '../services/reputation.service.js';
import {tutoringBackendService} from '../services/tutoring.service.js';
import {createTestPostgres} from './helpers/postgres.js';

const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('PostgreSQL: cierre con evidencia, privacidad, hitos históricos y calidad dinámica sin sanción por una nota',async()=>{
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 const tutor=id(501),students=Array.from({length:6},(_,i)=>id(510+i)),outsider=id(530);
 const as=async(actor:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');};
 const owner=async()=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");};
 let serial=700,subject:string;
 const seed=async(student=students[0],future=false,attendance=false)=>{
  await owner();await db.exec('SET session_replication_role=replica');const session=id(++serial);
  await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,duration_minutes,modality,status,attendance_verified) VALUES($1,$2,$3,$4,now()+make_interval(hours=>$5),60,'in_person','accepted',$6)",[session,student,tutor,subject,future?24:-serial,attendance]);
  await db.exec('SET session_replication_role=origin');return session;
 };
 const confirm=async(session:string,student:string)=>{await as(tutor);await db.query('SELECT public.confirm_tutoring_completion($1)',[session]);await as(student);await db.query('SELECT public.confirm_tutoring_completion($1)',[session]);};
 const review=async(session:string,student:string,score:number)=>{await as(student);await db.query('INSERT INTO public.tutoring_reviews(session_id,student_id,tutor_id,communication_score,knowledge_score,punctuality_score) VALUES($1,$2,$3,$4,$4,$4)',[session,student,tutor,score]);};
 const reputation=async()=>{await as(students[0]);return (await db.query<any>('SELECT * FROM public.tutor_reputation_public WHERE profile_id=$1',[tutor])).rows[0];};
 try{
  for(const file of(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,3))<=25).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
  for(const actor of[tutor,...students,outsider])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,actor+'@example.test']);
  subject=(await db.query<any>('SELECT id FROM public.subjects LIMIT 1')).rows[0].id;
  await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[tutor]);
  await db.exec('SET session_replication_role=replica');
  await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[tutor,subject]);
  const historical=id(699);
  await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status) VALUES($1,$2,$3,$4,now()-interval '3 days','completed')",[historical,students[0],tutor,subject]);
  await db.query('INSERT INTO public.tutoring_reviews(session_id,student_id,tutor_id,communication_score,knowledge_score,punctuality_score) VALUES($1,$2,$3,10,10,10)',[historical,students[0],tutor]);
  await db.query("INSERT INTO public.user_badges(profile_id,badge_id) SELECT $1,id FROM public.badges WHERE code='tutoring_10'",[tutor]);
  await db.exec('SET session_replication_role=origin');
  const migration=await fs.readFile(path.join(dir,'026_valid_sessions_and_reputation.sql'),'utf8');
  await db.exec(migration);await db.exec(migration);
  await db.exec(await fs.readFile(path.join(dir,'../ACTIVAR_REPUTACION.sql'),'utf8'));
  let rep=await reputation();assert.equal(rep.legacy_sessions,1);assert.equal(rep.valid_sessions,0);assert.equal(rep.recent_reviews,0);
  assert.equal((await db.query('SELECT * FROM public.user_badges WHERE profile_id=$1',[tutor])).rows.length,1);
  const session=await seed();await as(tutor);
  await assert.rejects(db.query("UPDATE public.tutoring_sessions SET status='completed' WHERE id=$1",[session]));
  await assert.rejects(db.query('UPDATE public.tutoring_sessions SET completion_verified_at=now() WHERE id=$1',[session]));
  await as(outsider);await assert.rejects(db.query('SELECT public.confirm_tutoring_completion($1)',[session]));
  const future=await seed(students[0],true);await as(tutor);await assert.rejects(db.query('SELECT public.confirm_tutoring_completion($1)',[future]));
  await db.query('SELECT public.confirm_tutoring_completion($1)',[session]);
  let row=(await db.query<any>('SELECT * FROM public.tutoring_sessions WHERE id=$1',[session])).rows[0];assert.equal(row.status,'accepted');assert.ok(row.tutor_completion_confirmed_at);assert.equal(row.completion_verified_at,null);
  const original=row.tutor_completion_confirmed_at;await db.query('SELECT public.confirm_tutoring_completion($1)',[session]);
  assert.equal(String((await db.query<any>('SELECT tutor_completion_confirmed_at FROM public.tutoring_sessions WHERE id=$1',[session])).rows[0].tutor_completion_confirmed_at),String(original));
  await as(students[0]);await db.query('SELECT public.confirm_tutoring_completion($1)',[session]);
  row=(await db.query<any>('SELECT * FROM public.tutoring_sessions WHERE id=$1',[session])).rows[0];assert.equal(row.status,'completed');assert.equal(row.completion_method,'both_confirmed');assert.ok(row.completion_verified_at);
  await db.query('SELECT public.confirm_tutoring_completion($1)',[session]);await review(session,students[0],9);
  rep=await reputation();assert.equal(rep.valid_sessions,1);assert.equal(rep.recent_reviews,1);assert.equal(rep.recent_reviewers,1);assert.equal(rep.communication_highlight,false);
  assert.equal(Number(rep.communication_adjusted),7.33);
  await as(outsider);assert.equal((await db.query('SELECT * FROM public.tutoring_sessions WHERE id=$1',[session])).rows.length,0);
  assert.ok((await db.query('SELECT * FROM public.tutor_reputation_public WHERE profile_id=$1',[tutor])).rows.length);
  const online=await seed(students[0],false,true);await as(tutor);await db.query('SELECT public.confirm_tutoring_completion($1)',[online]);
  assert.equal((await db.query<any>('SELECT completion_method FROM public.tutoring_sessions WHERE id=$1',[online])).rows[0].completion_method,'attendance');
  for(let i=0;i<9;i++){const student=students[i%5],s=await seed(student);await confirm(s,student);await review(s,student,10);}
  rep=await reputation();assert.equal(rep.recent_reviews,10);assert.equal(rep.recent_reviewers,5);assert.equal(rep.communication_highlight,true);assert.equal(rep.knowledge_highlight,true);assert.equal(rep.punctuality_highlight,true);
  const poor=await seed(students[5]);await confirm(poor,students[5]);await review(poor,students[5],1);
  rep=await reputation();assert.equal(rep.communication_highlight,false);assert.equal(rep.valid_sessions,12);assert.equal(rep.legacy_sessions,1);
  await as(tutor);assert.equal((await db.query<any>('SELECT available_for_tutoring FROM public.profiles WHERE id=$1',[tutor])).rows[0].available_for_tutoring,true);
  assert.equal((await db.query('SELECT * FROM public.user_badges WHERE profile_id=$1',[tutor])).rows.length,2);
  await owner();await db.exec('SET session_replication_role=replica');await db.query("UPDATE public.tutoring_reviews SET created_at=now()-interval '91 days' WHERE tutor_id=$1",[tutor]);await db.exec('SET session_replication_role=origin');
  rep=await reputation();assert.equal(rep.recent_reviews,0);assert.equal(rep.communication_highlight,false);assert.equal(rep.valid_sessions,12);
  await owner();await db.exec(migration);await db.exec(migration);rep=await reputation();assert.equal(rep.valid_sessions,12);assert.equal(rep.legacy_sessions,1);
  await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(db.query('SELECT public.confirm_tutoring_completion($1)',[session]));
 }finally{await db.close();}
});

test('Reputación HTTP: sesión requerida, identidad validada y campos privilegiados rechazados',async t=>{
 const session=id(800),actor=id(501);
 assert.equal((await request(app).get('/api/tutoring/reputation/'+actor)).status,401);
 assert.equal((await request(app).post('/api/tutoring/sessions/'+session+'/confirm-completion').send({})).status,401);
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:actor}},error:null}));
 assert.equal((await request(app).get('/api/tutoring/reputation/not-an-id').set('Authorization','Bearer fixture')).status,400);
 assert.equal((await request(app).post('/api/tutoring/sessions/'+session+'/confirm-completion').set('Authorization','Bearer fixture').send({user_id:actor,verified:true})).status,400);
 const calls:any[]=[];t.mock.method(tutoringBackendService,'confirmCompletion',async(...args:any[])=>{calls.push(args);return {id:session,status:'accepted'};});
 const reply=await request(app).post('/api/tutoring/sessions/'+session+'/confirm-completion').set('Authorization','Bearer fixture').send({});
 assert.equal(reply.status,200);assert.equal(calls[0][0].id,actor);assert.equal(calls[0][1],'fixture');assert.equal(calls[0][2],session);
});

test('Activación pendiente y error de red no se convierten en reputación inventada',async t=>{
 let error:any={code:'PGRST205'};
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error})}));
 assert.equal((await reputationService.read(id(501),'fixture')).status,'activation_required');
 error={code:'NETWORK'};await assert.rejects(reputationService.read(id(501),'fixture'));
 t.mock.method(Object.getPrototypeOf(supabasePublic),'rpc',async()=>({error:{code:'PGRST202'}}));
 await assert.rejects(reputationService.confirm(id(801),'fixture'),(e:any)=>e.status===503&&e.code==='REPUTATION_NOT_READY'||e.status===503);
});
