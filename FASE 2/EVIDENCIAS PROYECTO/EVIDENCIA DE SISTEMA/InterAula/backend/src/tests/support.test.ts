import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';
import {supportService} from '../services/support.service.js';
import {createTestPostgres} from './helpers/postgres.js';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('PostgreSQL: reporte privado, revisión independiente, historial, apelación y bandeja por destinatario',async()=>{
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 const reporter=id(600),respondent=id(601),reviewer=id(602),second=id(603),outsider=id(604),session=id(610);
 const as=async(actor:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');};
 const owner=async()=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");};
 const value=async(sql:string,params:any[]=[])=> (await db.query<any>(sql,params)).rows[0].value;
 const get=(caseId:string)=>value('SELECT public.get_incident($1) AS value',[caseId]);
 const act=async(c:any,action:string,message='')=>value('SELECT public.act_on_incident($1,$2,$3,$4) AS value',[c.id,action,message,c.revision]);
 try{
  for(const file of(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
  for(const actor of[reporter,respondent,reviewer,second,outsider])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,actor+'@example.test']);
  const subject=(await db.query<any>('SELECT id FROM public.subjects LIMIT 1')).rows[0].id;
  await db.exec('SET session_replication_role=replica');
  await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status) VALUES($1,$2,$3,$4,now()-interval '2 hours','accepted')",[session,reporter,respondent,subject]);await db.exec('SET session_replication_role=origin');
  await as(reporter);
  assert.equal(await value('SELECT public.can_review_incidents() AS value'),false);
  await assert.rejects(db.query('INSERT INTO public.community_reviewers(profile_id) VALUES($1)',[reporter]));
  await assert.rejects(db.query("SELECT public.list_incidents('review')"));
  let c=await value("SELECT public.create_incident('session',$1,'agreement',$2) AS value",[session,'PRIVATE_REPORT_MARKER: no se respetaron los acuerdos de la sesión.']);
  assert.equal(c.role,'reporter');assert.equal(c.status,'open');assert.equal(c.assigned,false);
  const duplicate=await value("SELECT public.create_incident('session',$1,'agreement',$2) AS value",[session,'Segundo envío válido por un reintento de red.']);assert.equal(duplicate.id,c.id);
  await as(respondent);await assert.rejects(get(c.id));
  assert.equal((await value("SELECT public.list_incidents('mine') AS value")).items.length,0);
  await as(outsider);await assert.rejects(get(c.id));await assert.rejects(db.query("SELECT public.create_incident('session',$1,'other','Reporte de una sesión ajena que no debe aceptarse')",[session]));
  await as(reporter);await assert.rejects(act(c,'claim'));await assert.rejects(db.query('SELECT * FROM public.community_incidents'));
  await owner();await db.query('INSERT INTO public.community_reviewers(profile_id) VALUES($1),($2)',[reviewer,second]);
  await as(reviewer);c=await get(c.id);assert.equal(c.canClaim,true);assert.ok(c.events.some((e:any)=>e.actor==='Quien reporta'));c=await act(c,'claim');assert.equal(c.assignedToMe,true);
  c=await act(c,'note','PRIVATE_INTERNAL_MARKER: antecedente reservado del equipo.');
  c=await act(c,'request_reply','Resumen revisado: necesitamos aclarar los acuerdos de horario de esta sesión.');
  await as(respondent);let theirs=await get(c.id);assert.equal(theirs.description,null);assert.equal(theirs.role,'respondent');
  assert.doesNotMatch(JSON.stringify(theirs),/PRIVATE_REPORT_MARKER|PRIVATE_INTERNAL_MARKER|reporter_id|actor_id/);
  theirs=await act(theirs,'reply','PRIVATE_RESPONSE_MARKER: mi versión de lo ocurrido para el equipo.');
  await as(reporter);let mine=await get(c.id);assert.doesNotMatch(JSON.stringify(mine),/PRIVATE_RESPONSE_MARKER|PRIVATE_INTERNAL_MARKER/);
  await as(second);await assert.rejects(act(await get(c.id),'resolve','No puedo resolver un expediente que ya tiene otro revisor asignado.'));
  await as(reviewer);c=await get(c.id);
  await assert.rejects(value('SELECT public.act_on_incident($1,$2,$3,$4) AS value',[c.id,'resolve','Resolución desde una versión antigua del expediente.',1]));
  c=await act(c,'resolve','Se aclararon los acuerdos. Se propone coordinar una nueva sesión, sin sanción automática.');
  await as(reporter);mine=await get(c.id);assert.equal(mine.canAppeal,true);mine=await act(mine,'appeal','Solicito revisar la resolución porque falta considerar un antecedente.');assert.equal(mine.status,'appealed');
  await as(reviewer);c=await get(c.id);assert.equal(c.canClaim,false);await assert.rejects(act(c,'claim'));
  await as(second);c=await get(c.id);assert.equal(c.canClaim,true);c=await act(c,'claim');c=await act(c,'close','Revisión independiente finalizada. Se explican los antecedentes y el acuerdo de cierre.');
  await as(respondent);theirs=await get(c.id);assert.equal(theirs.canAppeal,false);assert.equal(theirs.appealUsed,true);await assert.rejects(act(theirs,'appeal','No se permiten apelaciones sucesivas indefinidas en esta primera versión.'));
  await as(reporter);let inbox=await value('SELECT public.get_my_inbox(true) AS value');assert.ok(inbox.unreadCount>0);
  assert.doesNotMatch(JSON.stringify(inbox),/PRIVATE_REPORT_MARKER|PRIVATE_INTERNAL_MARKER|PRIVATE_RESPONSE_MARKER/);
  const notice=inbox.items[0];await as(outsider);await db.query('SELECT public.read_my_notice($1)',[notice.id]);
  await as(reporter);inbox=await value('SELECT public.get_my_inbox(false) AS value');assert.ok(inbox.unreadCount>0);
  await db.query('SELECT public.read_my_notice(NULL)');assert.equal((await value('SELECT public.get_my_inbox(false) AS value')).unreadCount,0);
  await assert.rejects(db.query("SELECT public.enqueue_user_notice($1,'fake','fake','fake','/support')",[reporter]));
  await assert.rejects(db.query("INSERT INTO public.user_notifications(recipient_id,event_key,title,body,href) VALUES($1,'fake','fake','fake','/support')",[reporter]));
  await owner();const migration=await fs.readFile(path.join(dir,'027_incidents_and_inbox.sql'),'utf8');await db.exec(migration);await db.exec(migration);
  await db.exec(await fs.readFile(path.join(dir,'../ACTIVAR_INCIDENCIAS_Y_AVISOS.sql'),'utf8'));
  await as(reporter);assert.equal((await get(c.id)).status,'closed');
  await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(db.query('SELECT public.get_my_inbox(true)'));
 }finally{await db.close();}
});

test('PostgreSQL: avisos de tutorías y recordatorio deduplicado sin exponer notas privadas',async()=>{
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations'),student=id(650),tutor=id(651);
 const as=async(actor:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');};
 const inbox=async()=> (await db.query<any>('SELECT public.get_my_inbox(true) AS value')).rows[0].value;
 try{
  for(const file of(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
  for(const actor of[student,tutor])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,actor+'@example.test']);
  const subject=(await db.query<any>('SELECT id FROM public.subjects LIMIT 1')).rows[0].id;
  await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[tutor]);
  await db.exec('SET session_replication_role=replica');await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[tutor,subject]);await db.exec('SET session_replication_role=origin');
  await as(student);const session=(await db.query<any>("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,notes) VALUES($1,$2,$3,now()+interval '3 hours','PRIVATE_SESSION_NOTES') RETURNING id",[student,tutor,subject])).rows[0].id;
  await as(tutor);let notices=await inbox();assert.ok(notices.items.some((n:any)=>n.title==='Nueva solicitud de tutoría'));assert.doesNotMatch(JSON.stringify(notices),/PRIVATE_SESSION_NOTES/);
  await db.query("UPDATE public.tutoring_sessions SET status='accepted' WHERE id=$1",[session]);
  await as(student);notices=await inbox();assert.ok(notices.items.some((n:any)=>n.title==='Tutoría aceptada'));assert.ok(notices.items.some((n:any)=>n.title==='Tutoría en las próximas 24 horas'));
  const count=notices.items.length;assert.equal((await inbox()).items.length,count);
  await db.query('SELECT public.read_my_notice(NULL)');assert.equal((await inbox()).unreadCount,0);
 }finally{await db.close();}
});

test('Soporte HTTP: autenticación, identidad del token y rechazo de roles o campos de resolución inyectados',async t=>{
 const actor=id(600),target=id(601);
 for(const route of['/inbox','/cases','/cases/'+id(610)])assert.equal((await request(app).get('/api/support'+route)).status,401);
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:actor,user_metadata:{role:'admin'}}},error:null}));
 const calls:any[]=[];t.mock.method(supportService,'create',async(...args:any[])=>{calls.push(args);return {id:id(620)};});
 const body={kind:'profile',targetId:target,category:'other',description:'Descripción válida del problema para su revisión privada.'};
 assert.equal((await request(app).post('/api/support/cases').set('Authorization','Bearer token-fixture').send({...body,reporter_id:target,status:'resolved'})).status,400);
 assert.equal((await request(app).post('/api/support/cases').set('Authorization','Bearer token-fixture').send(body)).status,200);assert.equal(calls[0][0],'token-fixture');assert.deepEqual(calls[0][1],body);
 assert.equal((await request(app).post('/api/support/cases/'+id(620)+'/actions').set('Authorization','Bearer token-fixture').send({action:'suspend',message:'Arbitrary sanction',revision:1})).status,400);
});
