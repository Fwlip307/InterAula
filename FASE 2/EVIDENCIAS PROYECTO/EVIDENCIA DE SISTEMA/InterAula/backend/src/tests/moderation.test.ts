import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';
import {moderationService} from '../services/moderation.service.js';
import {tutoringBackendService} from '../services/tutoring.service.js';
import {postgresQuery} from './helpers/postgrest.js';
import {createTestPostgres} from './helpers/postgres.js';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const reporter=id(800),member=id(801),reviewer=id(802),second=id(803),ordinary=id(804),student=id(805);
const reason='Se revisaron los antecedentes y la respuesta de la persona involucrada; consta el incumplimiento de acuerdos.';
const message='El equipo revisó los antecedentes y comunica una decisión fundamentada para este expediente.';
async function fixture(){
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 for(const file of(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
 for(const actor of[reporter,member,reviewer,second,ordinary,student])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,actor+'@example.test']);
 await db.query('INSERT INTO public.community_reviewers(profile_id,can_sanction,can_suspend_accounts) VALUES($1,true,true),($2,true,true),($3,false,false)',[reviewer,second,ordinary]);
 const subjects=(await db.query<any>('SELECT id FROM public.subjects ORDER BY id LIMIT 2')).rows.map(r=>r.id);
 await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[member]);
 await db.exec('SET session_replication_role=replica');
 for(const subject of subjects)await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[member,subject]);
 await db.exec('SET session_replication_role=origin');
 const as=async(actor:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');};
 const owner=async()=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");};
 const value=async(sql:string,args:any[]=[])=> (await db.query<any>(sql,args)).rows[0].value;
 const get=(caseId:string)=>value('SELECT public.get_incident($1) AS value',[caseId]);
 const act=(c:any,action:string,text='')=>value('SELECT public.act_on_incident($1,$2,$3,$4) AS value',[c.id,action,text,c.revision]);
 const claimed=async()=>{await as(reporter);const c=await value("SELECT public.create_incident('profile',$1,'agreement',$2) AS value",[member,'Descripción privada de un nuevo hecho para el equipo de revisión.']);await as(reviewer);return act(await get(c.id),'claim');};
 const decide=(c:any,document:Record<string,unknown>)=>value('SELECT public.decide_moderation_measure($1,$2,$3::jsonb) AS value',[c.id,c.revision,JSON.stringify({severity:'minor',reason,message,distinctFact:true,...document})]);
 const summary=()=>value('SELECT public.get_my_measures() AS value');
 return {db,dir,as,owner,value,get,act,claimed,decide,summary,subjects};
}
test('Moderación SQL: hechos confirmados, escala, reservas, duplicados y apelación independiente',async()=>{
 const f=await fixture(),{db}=f;
 try{
  let c=await f.claimed();await f.as(member);assert.equal((await f.summary()).strikes,0);
  await assert.rejects(db.query('SELECT * FROM public.moderation_findings'));
  await assert.rejects(db.query('UPDATE public.community_reviewers SET can_sanction=true WHERE profile_id=$1',[member]));
  await f.as(ordinary);await assert.rejects(f.decide(c,{}));
  await f.as(reviewer);let decision=await f.decide(c,{});assert.equal(decision.measures[0].scope,'warning');const first=decision.finding.id;
  await f.as(member);let own=await f.summary();assert.equal(own.strikes,1);assert.equal(own.summary.tutoring,false);assert.ok(own.items[0].endsAt);
  await f.as(reporter);const visible=await f.value('SELECT public.moderation_case_context($1) AS value',[c.id]);assert.equal(visible.measures.length,0);assert.equal(visible.finding,null);
  await assert.rejects(f.act(await f.get(c.id),'appeal','Otra persona no puede consumir la apelación de la medida.'));
  await f.as(student);const booking=(await db.query<any>("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '3 days') RETURNING id",[student,member,f.subjects[0]])).rows[0].id;
  await f.owner();const workshop=(await db.query<any>("INSERT INTO public.tutoring_workshops(tutor_id,subject_id,title,scheduled_at) VALUES($1,$2,'Taller ficticio',now()+interval '5 days') RETURNING id",[member,f.subjects[0]])).rows[0].id;
  await f.as(student);await db.query('INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES($1,$2)',[workshop,student]);
  c=await f.claimed();decision=await f.decide(c,{});assert.equal(decision.measures[0].scope,'tutoring');
  assert.equal(await f.value('SELECT to_jsonb(status) AS value FROM public.tutoring_workshops WHERE id=$1',[workshop]),'cancelled');
  assert.ok(Math.abs((Date.parse(decision.measures[0].endsAt)-Date.parse(decision.measures[0].startsAt))/86400000-7)<.01);
  await f.as(member);own=await f.summary();assert.equal(own.strikes,2);assert.equal(own.summary.tutoring,true);
  assert.equal(await f.value('SELECT to_jsonb(status) AS value FROM public.tutoring_sessions WHERE id=$1',[booking]),'cancelled');
  await assert.rejects(db.query("UPDATE public.profile_offered_subjects SET level='basic' WHERE profile_id=$1",[member]));
  await db.query('UPDATE public.profiles SET available_for_tutoring=false WHERE id=$1',[member]);
  await assert.rejects(db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[member]));
  // Reading/studying and private support remain available; qualifications are not erased.
  assert.equal((await db.query<any>('SELECT is_verified FROM public.profile_offered_subjects WHERE profile_id=$1',[member])).rows[0].is_verified,true);
  await db.query("UPDATE public.profiles SET display_name='Nombre de prueba' WHERE id=$1",[member]);
  await f.as(student);await assert.rejects(db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '5 days')",[student,member,f.subjects[0]]));
  const inbox=await f.value('SELECT public.get_my_inbox(true) AS value');assert.ok(inbox.items.some((n:any)=>n.title==='Cambio en una tutoría'||n.title==='Tutoría cancelada'));
  const secondCase=c.id;
  c=await f.claimed();await f.decide(c,{duplicateOf:first});await f.as(member);assert.equal((await f.summary()).strikes,2);
  c=await f.claimed();const thirdCase=c.id;decision=await f.decide(c,{});assert.ok(Math.abs((Date.parse(decision.measures[0].endsAt)-Date.parse(decision.measures[0].startsAt))/86400000-30)<.01);
  await f.as(member);assert.equal((await f.summary()).strikes,3);c=await f.act(await f.get(secondCase),'appeal','Solicito revisión independiente con antecedentes nuevos sobre la sesión.');
  await f.as(reviewer);await assert.rejects(f.act(await f.get(c.id),'claim'));
  await f.as(ordinary);await assert.rejects(f.act(await f.get(c.id),'claim'));
  await f.as(second);c=await f.act(await f.get(c.id),'claim');await assert.rejects(f.act(c,'resolve',message));
  await assert.rejects(f.value('SELECT public.decide_measure_appeal($1,$2,$3,$4,$5) AS value',[c.id,1,'overturn',reason,message]));
  decision=await f.value('SELECT public.decide_measure_appeal($1,$2,$3,$4,$5) AS value',[c.id,c.revision,'overturn',reason,message]);assert.ok(decision.measures[0].revokedAt);
  const recalculated=await f.value('SELECT public.moderation_case_context($1) AS value',[thirdCase]);assert.ok(Math.abs((Date.parse(recalculated.measures[0].endsAt)-Date.parse(recalculated.measures[0].startsAt))/86400000-7)<.01);
  await f.as(member);assert.equal((await f.summary()).strikes,2);assert.equal(await f.value('SELECT to_jsonb(status) AS value FROM public.tutoring_sessions WHERE id=$1',[booking]),'cancelled');
  await f.owner();await db.exec(await fs.readFile(path.join(f.dir,'../ACTIVAR_MEDIDAS_CONVIVENCIA.sql'),'utf8')); // repeatable atomic activation
  await f.as(member);assert.equal((await f.summary()).strikes,2);
 }finally{await db.close();}
});
test('Moderación SQL: alcance por materia, comunidad, cuenta, prevención y vencimiento',async t=>{
 const f=await fixture(),{db}=f;
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
  const query=postgresQuery(db,table),select=query.select;query.select=(fields:string)=>select(fields.replace('*,subject:subjects(*)','profile_id,subject_id,is_verified,subject:subjects(name)'));return query;
 });
 try{
  await f.as(student);assert.equal((await tutoringBackendService.getAvailableTutors()).length,1);
  let c=await f.claimed();let decision=await f.decide(c,{severity:'precaution',scope:'subject',subjectId:f.subjects[0],days:1});
  await f.as(member);assert.equal((await f.summary()).strikes,0);assert.equal((await f.summary()).summary.tutoring,false);assert.equal((await f.get(c.id)).canAppeal,true);
  const catalog=await tutoringBackendService.getAvailableTutors();assert.equal(catalog.length,1);assert.deepEqual(catalog[0].profile_offered_subjects.map((o:any)=>o.subject_id),[f.subjects[1]]);
  await f.as(student);await assert.rejects(db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '5 days')",[student,member,f.subjects[0]]));
  await db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '5 days')",[student,member,f.subjects[1]]);
  await f.owner();await db.query("UPDATE public.moderation_measures SET starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' WHERE id=$1",[decision.measures[0].id]);
  await f.as(student);await db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '6 days')",[student,member,f.subjects[0]]);
  c=await f.claimed();await f.decide(c,{severity:'serious',scope:'community',days:7});await f.as(member);
  await assert.rejects(db.query("INSERT INTO public.forum_posts(author_id,title,description) VALUES($1,'Título de prueba','Una descripción de prueba')",[member]));
  await db.query("UPDATE public.profiles SET display_name='Se conserva el estudio' WHERE id=$1",[member]);assert.equal((await f.summary()).summary.community,true);
  await f.owner();await db.query('UPDATE public.community_reviewers SET can_suspend_accounts=false WHERE profile_id=$1',[reviewer]);
  c=await f.claimed();await assert.rejects(f.decide(c,{severity:'serious',scope:'account',days:7}));
  await f.owner();await db.query('UPDATE public.community_reviewers SET can_suspend_accounts=true WHERE profile_id=$1',[reviewer]);await f.as(reviewer);
  await f.owner();await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[reviewer]);
  await db.exec('SET session_replication_role=replica');await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[reviewer,f.subjects[0]]);await db.exec('SET session_replication_role=origin');
  const otherWorkshop=(await db.query<any>("INSERT INTO public.tutoring_workshops(tutor_id,subject_id,title,scheduled_at) VALUES($1,$2,'Otro taller ficticio',now()+interval '5 days') RETURNING id",[reviewer,f.subjects[0]])).rows[0].id;
  await f.as(member);await db.query('INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES($1,$2)',[otherWorkshop,member]);
  await f.as(reviewer);await f.decide(c,{severity:'serious',scope:'account',days:7});
  assert.equal((await db.query('SELECT id FROM public.workshop_enrollments WHERE workshop_id=$1',[otherWorkshop])).rows.length,0);await f.as(member);assert.equal((await f.summary()).summary.account,true);
  await assert.rejects(db.query("UPDATE public.profiles SET display_name='Intento restringido' WHERE id=$1",[member]));
  c=await f.act(await f.get(c.id),'appeal','Pido revisar la restricción de cuenta para presentar nuevos antecedentes.');assert.equal(c.status,'appealed');
  await f.as(second);c=await f.act(await f.get(c.id),'claim');await f.value('SELECT public.decide_measure_appeal($1,$2,$3,$4,$5) AS value',[c.id,c.revision,'overturn',reason,message]);
  await f.as(member);assert.equal((await f.summary()).summary.account,false);assert.equal((await f.summary()).summary.community,true);
  await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(db.query('SELECT public.get_my_measures()'));await assert.rejects(db.query('SELECT * FROM public.moderation_measures'));
  const publicData=JSON.stringify((await db.query('SELECT * FROM public.tutor_availability_limits')).rows);assert.doesNotMatch(publicData,/reason|strike|severity|incident|reporter/);
 }finally{await db.close();}
});
test('Moderación HTTP: cuenta restringida conserva ayuda y decisiones requieren contratos estrictos',async t=>{
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:member,user_metadata:{role:'admin'}}},error:null}));
 t.mock.method(moderationService,'summary',async()=>({enabled:true,account:true,tutoring:true,community:true}));
 t.mock.method(moderationService,'mine',async()=>({items:[],strikes:0}));
 assert.equal((await request(app).get('/api/moderation/mine')).status,401);
 assert.equal((await request(app).get('/api/moderation/mine').set('Authorization','Bearer fixture')).status,200);
 const blocked=await request(app).get('/api/recommendations/feed').set('Authorization','Bearer fixture');assert.equal(blocked.status,403);assert.equal(blocked.body.code,'ACCOUNT_RESTRICTED');
 assert.equal((await request(app).post('/api/moderation/cases/'+id(810)+'/decision').set('Authorization','Bearer fixture').send({revision:1,document:{severity:'minor',reason,message,subject_id:member}})).status,400);
});
