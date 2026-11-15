import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';
import {tutoringBackendService} from '../services/tutoring.service.js';
import {createTestPostgres} from './helpers/postgres.js';

const scores={communication_score:9,knowledge_score:8,punctuality_score:7};
const ids={tutor:'00000000-0000-4000-8000-000000000091',student:'00000000-0000-4000-8000-000000000092',other:'00000000-0000-4000-8000-000000000093',session:'00000000-0000-4000-8000-000000000094'};

test('HTTP → PostgreSQL en memoria: valoración 1–10, promedio, participantes, duplicados e insignias 1/10/25/50',async t=>{
 assert.equal(process.env.NODE_ENV,'test');
 assert.equal(process.env.SUPABASE_URL,'http://127.0.0.1:9');
 assert.equal(process.env.SUPABASE_SECRET_KEY,'');
 assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY,'');
 // createTestPostgres uses new PGlite() with no URL or path: ephemeral WASM PostgreSQL.
 const db=await createTestPostgres();
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Network disabled in isolated quality test');});
 const migrations=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 try{
  for(const name of (await fs.readdir(migrations)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(migrations,name),'utf8'));
  await db.exec(await fs.readFile(path.join(migrations,'../ACTIVAR_RESERVAS_ACREDITADAS.sql'),'utf8')); // Repeatable activation.
  for(const [name,id]of Object.entries(ids).filter(([name])=>name!=='session'))await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,name+'@example.test']);
  const subject=(await db.query<any>('SELECT id FROM public.subjects ORDER BY name LIMIT 1')).rows[0].id;
  await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[ids.tutor]);
  // Trusted fixtures: seed an accredited subject and a session whose start time has passed.
  await db.exec('SET session_replication_role=replica');
  await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[ids.tutor,subject]);
  await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,duration_minutes,modality,status) VALUES($1,$2,$3,$4,now()-interval '2 hours',60,'online','accepted')",[ids.session,ids.student,ids.tutor,subject]);
  await db.exec('SET session_replication_role=origin');
  const as=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('SET ROLE authenticated');};
  await as(ids.student);
  await assert.rejects(db.query("UPDATE public.tutoring_sessions SET status='completed' WHERE id=$1",[ids.session]));
  await as(ids.tutor);
  await db.query("UPDATE public.tutoring_sessions SET status='completed' WHERE id=$1",[ids.session]);
  await as(ids.student);
  t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:ids.student,user_metadata:{},app_metadata:{}}},error:null} as any));
  t.mock.method(tutoringBackendService,'getSessionById',async()=>({id:ids.session,student_id:ids.student,tutor_id:ids.tutor,status:'completed'}));
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
   assert.equal(table,'tutoring_reviews');let payload:any;
   const query:any={insert(value:any){payload=value;return query;},select(){return query;},single:async()=>{
    try{const result=await db.query('INSERT INTO public.tutoring_reviews(session_id,student_id,tutor_id,communication_score,knowledge_score,punctuality_score,comment) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[payload.session_id,payload.student_id,payload.tutor_id,payload.communication_score,payload.knowledge_score,payload.punctuality_score,payload.comment]);return {data:result.rows[0],error:null};}
    catch(cause:any){return {data:null,error:{code:cause.code,message:cause.message}};}
   }};return query;
  });
  const body={...scores,comment:null};
  const review=await request(app).post('/api/tutoring/sessions/'+ids.session+'/reviews').set('Authorization','Bearer fixture').send(body);
  assert.equal(review.status,201);assert.equal(Number(review.body.data.overall_score),8);assert.equal(review.body.data.knowledge_score,8);
  const duplicate=await request(app).post('/api/tutoring/sessions/'+ids.session+'/reviews').set('Authorization','Bearer fixture').send(body);
  assert.equal(duplicate.status,409);
  const injected=await request(app).post('/api/tutoring/sessions/'+ids.session+'/reviews').set('Authorization','Bearer fixture').send({...body,tutor_id:ids.other,overall_score:10});
  assert.equal(injected.status,400);
  await as(ids.tutor);
  const stats=(await db.query<any>('SELECT * FROM public.tutor_statistics_view WHERE profile_id=$1',[ids.tutor])).rows[0];
  assert.equal(Number(stats.avg_communication),9);assert.equal(Number(stats.avg_knowledge),8);assert.equal(Number(stats.avg_punctuality),7);assert.equal(Number(stats.overall_rating),8);assert.equal(Number(stats.total_reviews_received),1);
  await db.exec('RESET ROLE;SET session_replication_role=replica');
  await db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes,modality,status) SELECT $1,$2,$3,now()-make_interval(days=>n),60,'online','accepted' FROM generate_series(1,49) n",[ids.student,ids.tutor,subject]);
  await db.exec('SET session_replication_role=origin');await as(ids.tutor);
  await db.query("UPDATE public.tutoring_sessions SET status='completed' WHERE tutor_id=$1 AND status='accepted'",[ids.tutor]);
  const badges=await db.query<any>('SELECT b.code FROM public.user_badges u JOIN public.badges b ON b.id=u.badge_id WHERE profile_id=$1 ORDER BY b.required_count',[ids.tutor]);
  assert.deepEqual(badges.rows.map(row=>row.code),['tutoring_1','tutoring_10','tutoring_25','tutoring_50']);
  assert.equal(Number((await db.query<any>('SELECT total_completed_tutorings FROM public.tutor_statistics_view WHERE profile_id=$1',[ids.tutor])).rows[0].total_completed_tutorings),50);
  // A caller using Supabase directly cannot book an unaccredited subject either.
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level) VALUES($1,$2,'basic')",[ids.other,subject]);
  await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[ids.other]);await as(ids.student);
  await assert.rejects(db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes) VALUES($1,$2,$3,now()+interval '1 day',60)",[ids.student,ids.other,subject]),/acreditada/);
  const booking=await db.query<any>("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes) VALUES($1,$2,$3,now()+interval '2 days',60) RETURNING status",[ids.student,ids.tutor,subject]);
  assert.equal(booking.rows[0].status,'pending');
  await assert.rejects(db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes) VALUES($1,$2,$3,now()+interval '2 days',60)",[ids.student,ids.tutor,subject]),/coincide/);
 }finally{await db.close();}
});
