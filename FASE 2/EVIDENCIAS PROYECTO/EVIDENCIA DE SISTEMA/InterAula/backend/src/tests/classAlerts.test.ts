import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestPostgres} from './helpers/postgres.js';
import {supabasePublic} from '../lib/supabase.js';
import {env} from '../config/env.js';
import {classEmailService,classEmailConfig,renderClassEmail,sendClassEmail,EmailProviderError,type ClassEmailJob} from '../services/classEmail.service.js';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),student=id(900),tutor=id(901),unverified=id(902);
async function fixture(){
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 for(const file of(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
 for(const actor of[student,tutor,unverified])await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)',[actor,actor+'@example.test',actor===unverified?null:new Date().toISOString()]);
 const subject=(await db.query<any>('SELECT id FROM public.subjects LIMIT 1')).rows[0].id;
 await db.query('UPDATE public.profiles SET available_for_tutoring=true WHERE id=$1',[tutor]);
 await db.exec('SET session_replication_role=replica');await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,is_verified) VALUES($1,$2,'basic',true)",[tutor,subject]);await db.exec('SET session_replication_role=origin');
 const as=async(actor:string|null)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[actor||'',actor?'authenticated':'service_role']);if(actor)await db.exec('SET ROLE authenticated');};
 const value=async(sql:string,args:any[]=[])=> (await db.query<any>(sql,args)).rows[0].value;
 const create=async(who=student)=>{await as(who);return (await db.query<any>("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,notes) VALUES($1,$2,$3,now()+make_interval(mins=>$4),'PRIVATE_AGREEMENT_MARKER') RETURNING id",[who,tutor,subject,who===unverified?360:180])).rows[0].id;};
 const claim=()=>value('SELECT public.claim_class_email() AS value');
 return {db,dir,subject,as,value,create,claim};
}
test('Alertas SQL: avisos para ambos, recordatorios deduplicados, preferencias, verificación y privacidad',async()=>{
 const f=await fixture(),{db}=f;
 try{
  const session=await f.create();await f.as(tutor);let inbox=await f.value('SELECT public.get_my_inbox(true) AS value');assert.ok(inbox.items.some((n:any)=>n.title==='Nueva solicitud de tutoría'));
  await f.as(student);assert.ok((await f.value('SELECT public.get_my_inbox(true) AS value')).items.some((n:any)=>n.title==='Solicitud de tutoría enviada'));
  for(const sql of['SELECT * FROM public.email_notification_outbox','SELECT public.claim_class_email()','SELECT public.generate_class_reminders(NULL)'])await assert.rejects(db.query(sql));
  await f.as(tutor);await db.query("UPDATE public.tutoring_sessions SET status='accepted' WHERE id=$1",[session]);
  await f.as(null);assert.equal(await f.value('SELECT public.generate_class_reminders(NULL) AS value'),2);assert.equal(await f.value('SELECT public.generate_class_reminders(NULL) AS value'),0);
  let job=await f.claim();assert.ok(job);assert.ok(!JSON.stringify(job).includes('PRIVATE_AGREEMENT_MARKER'));assert.ok(job.payload.title!=='Nueva solicitud de tutoría');
  // Opt out after the lease is taken: prepare checks again before provider transmission.
  await db.query("UPDATE public.profiles SET accessibility_preferences=jsonb_build_object('emailTutoring',false) WHERE id=$1",[job.to.split('@')[0]]);
  assert.equal(await f.value('SELECT public.prepare_class_email($1,$2) AS value',[job.id,job.lease]),null);
  let eligible=0;for(let n=0;n<10;n++){job=await f.claim();if(!job)break;assert.ok(job.to.endsWith('@example.test'));eligible++;assert.equal(await f.value("SELECT public.finish_class_email($1,$2,'accepted','provider-fixture',NULL) AS value",[job.id,job.lease]),true);}
  assert.ok(eligible>=1);assert.equal(await f.claim(),null);
  await db.query("UPDATE public.profiles SET accessibility_preferences=jsonb_build_object('emailTutoring',true,'emailClassReminders',false) WHERE id=$1",[student]);
  await f.as(student);const near=(await db.query<any>("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '30 minutes') RETURNING id",[student,tutor,f.subject])).rows[0].id;
  await f.as(tutor);await db.query("UPDATE public.tutoring_sessions SET status='accepted' WHERE id=$1",[near]);await f.as(null);
  await f.value('SELECT public.generate_class_reminders(NULL) AS value');assert.equal(await f.value('SELECT public.generate_class_reminders(NULL) AS value'),0);
  assert.equal((await db.query<any>("SELECT count(*)::int AS value FROM public.email_notification_outbox WHERE recipient_id=$1 AND event_name='session-class-reminder1'",[student])).rows[0].value,0);
  await f.as(student);inbox=await f.value('SELECT public.get_my_inbox(true) AS value');assert.ok(inbox.items.some((n:any)=>n.title.includes('menos de una hora')));
  await f.as(null);await db.query("UPDATE public.profiles SET accessibility_preferences='{}' WHERE id IN($1,$2)",[student,tutor]);
  const before=(await db.query<any>('SELECT count(*)::int AS value FROM public.email_notification_outbox')).rows[0].value;
  await db.query("SELECT public.enqueue_user_notice($1,'incident-private:fixture','Información privada','PRIVATE_REPORT_MARKER','/support')",[student]);
  assert.equal((await db.query<any>('SELECT count(*)::int AS value FROM public.email_notification_outbox')).rows[0].value,before);
  await f.create(unverified);await f.as(null);for(let n=0;n<15;n++){job=await f.claim();if(!job)break;assert.notEqual(job.to,unverified+'@example.test');await db.query("SELECT public.finish_class_email($1,$2,'accepted','fixture',NULL)",[job.id,job.lease]);}
  assert.equal((await db.query('SELECT id FROM public.email_notification_outbox WHERE recipient_id=$1',[unverified])).rows.length,0);
  await db.exec('RESET ROLE');await db.exec(await fs.readFile(path.join(f.dir,'../ACTIVAR_ALERTAS_DE_CLASES.sql'),'utf8')); // no historical backfill
  await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.prepare_class_email($1,$2)',[id(910),id(911)]));
 }finally{await db.close();}
});
test('Alertas SQL: talleres, cupos, cancelación, horario nuevo y transacciones sin envíos fantasma',async()=>{
 const f=await fixture(),{db}=f;
 try{
  await f.as(tutor);const workshop=(await db.query<any>("INSERT INTO public.tutoring_workshops(tutor_id,subject_id,title,scheduled_at) VALUES($1,$2,'Taller de prueba',now()+interval '4 hours') RETURNING id",[tutor,f.subject])).rows[0].id;
  await f.as(student);await db.query('INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES($1,$2)',[workshop,student]);
  let inbox=await f.value('SELECT public.get_my_inbox(true) AS value');assert.ok(inbox.items.some((n:any)=>n.title==='Tu cupo en el taller está reservado'));
  await f.as(tutor);await db.query("UPDATE public.tutoring_workshops SET scheduled_at=now()+interval '5 hours' WHERE id=$1",[workshop]);
  await f.as(null);await f.value('SELECT public.generate_class_reminders(NULL) AS value');
  await f.as(tutor);await db.query("UPDATE public.tutoring_workshops SET status='cancelled' WHERE id=$1",[workshop]);
  await f.as(null);let count=0;for(let n=0;n<12;n++){const job=await f.claim();if(!job)break;assert.equal(job.payload.title,'Cambio en un taller');count++;await db.query("SELECT public.finish_class_email($1,$2,'accepted','fixture',NULL)",[job.id,job.lease]);}assert.equal(count,2);
  await f.as(student);await db.query('DELETE FROM public.workshop_enrollments WHERE workshop_id=$1 AND student_id=$2',[workshop,student]);
  inbox=await f.value('SELECT public.get_my_inbox(true) AS value');assert.ok(inbox.items.some((n:any)=>n.title==='Inscripción al taller cancelada'));
  await f.as(null);const before=(await db.query<any>('SELECT count(*)::int AS value FROM public.email_notification_outbox')).rows[0].value;
  await db.exec('BEGIN');await db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '6 hours')",[student,tutor,f.subject]);await db.exec('ROLLBACK');
  assert.equal((await db.query<any>('SELECT count(*)::int AS value FROM public.email_notification_outbox')).rows[0].value,before);
 }finally{await db.close();}
});
test('SQL: descarta el recordatorio de 24 horas atrasado y el de quien ya dejó el taller',async()=>{
 const f=await fixture(),{db}=f;
 try{
  await f.as(student);const session=(await db.query<any>("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at) VALUES($1,$2,$3,now()+interval '30 minutes') RETURNING id",[student,tutor,f.subject])).rows[0].id;
  await f.as(tutor);await db.query("UPDATE public.tutoring_sessions SET status='accepted' WHERE id=$1",[session]);await f.as(null);
  await db.query("SELECT public.enqueue_user_notice($1,$2,'Recordatorio atrasado','Consulta tu agenda','/my-tutoring')",[student,'session-class-reminder24:'+session+':fixture']);
  assert.equal(await f.value("SELECT public.email_job_is_current(o) AS value FROM public.email_notification_outbox o WHERE resource_id=$1 AND event_name='session-class-reminder24'",[session]),false);
  await f.as(tutor);const workshop=(await db.query<any>("INSERT INTO public.tutoring_workshops(tutor_id,subject_id,title,scheduled_at) VALUES($1,$2,'Otro taller de prueba',now()+interval '4 hours') RETURNING id",[tutor,f.subject])).rows[0].id;
  await f.as(student);await db.query('INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES($1,$2)',[workshop,student]);await f.as(null);await f.value('SELECT public.generate_class_reminders(NULL) AS value');
  assert.equal(await f.value("SELECT public.email_job_is_current(o) AS value FROM public.email_notification_outbox o WHERE resource_id=$1 AND recipient_id=$2 AND event_name='workshop-class-reminder24'",[workshop,student]),true);
  await f.as(student);await db.query('DELETE FROM public.workshop_enrollments WHERE workshop_id=$1 AND student_id=$2',[workshop,student]);await f.as(null);
  assert.equal(await f.value("SELECT public.email_job_is_current(o) AS value FROM public.email_notification_outbox o WHERE resource_id=$1 AND recipient_id=$2 AND event_name='workshop-class-reminder24'",[workshop,student]),false);
  assert.equal(await f.value("SELECT public.email_job_is_current(o) AS value FROM public.email_notification_outbox o WHERE resource_id=$1 AND recipient_id=$2 AND event_name='workshop-class-reminder24'",[workshop,tutor]),true);
 }finally{await db.close();}
});
test('Correo: plantillas accesibles, escape HTML, enlaces propios y respuestas del proveedor',async t=>{
 const job:ClassEmailJob={id:id(920),lease:id(921),attempt:1,to:'student@example.test',payload:{title:'Clase <script>alert(1)</script>',body:'Texto & detalle',href:'//other.example/path',scheduledAt:'2026-11-17T15:00:00Z',kind:'session'}};
 const rendered=renderClassEmail(job,'https://interaula.example');assert.ok(rendered.html.includes('&lt;script&gt;'));assert.ok(!rendered.html.includes('<script>'));assert.ok(rendered.text.includes('https://interaula.example/support'));assert.ok(rendered.text.includes('America/Santiago'));
 const config={enabled:true,ready:true,apiKey:'test-private-key',from:'InterAula <clases@example.test>',publicUrl:'https://interaula.example',reason:'configured'};
 const calls:any[]=[];t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{calls.push({url,options});return new Response(JSON.stringify({id:'provider-id'}),{status:200});});
 assert.equal(await sendClassEmail(job,config),'provider-id');assert.equal(calls[0].url,'https://api.resend.com/emails');assert.equal(calls[0].options.headers['Idempotency-Key'],'interaula-class/'+job.id);assert.deepEqual(JSON.parse(calls[0].options.body).to,['student@example.test']);
 t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:429}));await assert.rejects(sendClassEmail(job,config),(e:any)=>e instanceof EmailProviderError&&e.retryable);
 t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:403}));await assert.rejects(sendClassEmail(job,config),(e:any)=>e instanceof EmailProviderError&&!e.retryable);
});
test('Trabajador: sin configuración no envía; reintento tras fallo de confirmación conserva cuerpo y clave',async t=>{
 const f=await fixture(),{db}=f,previousKey=env.supabaseServiceRoleKey;
 try{
  await f.create();await f.as(null);env.supabaseServiceRoleKey='private-test-fixture';
  const signatures:Record<string,string[]>={generate_class_reminders:['p_actor'],claim_class_email:[],prepare_class_email:['p_id','p_lease'],finish_class_email:['p_id','p_lease','p_state','p_provider_id','p_error_code']};
  let failAck=false;t.mock.method(Object.getPrototypeOf(supabasePublic),'rpc',async(name:string,args:any={})=>{
   assert.ok(signatures[name]);if(name==='finish_class_email'&&failAck){failAck=false;return {data:null,error:{code:'UNAVAILABLE'}};}
   try{return {data:await f.value('SELECT public.'+name+'('+signatures[name].map((_,i)=>'$'+(i+1)).join(',')+') AS value',signatures[name].map(k=>args[k])),error:null};}catch(e:any){return {data:null,error:{code:e.code}};}
  });
  const calls:any[]=[];t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>{calls.push(options);return new Response(JSON.stringify({id:'provider-id'}),{status:200});});
  await classEmailService.runOnce();assert.equal(calls.length,0);assert.equal(classEmailConfig().ready,false);
  process.env.EMAIL_ENABLED='true';process.env.RESEND_API_KEY='private-test-fixture';process.env.EMAIL_FROM='InterAula <clases@example.test>';process.env.APP_PUBLIC_URL='https://interaula.example';
  failAck=true;await assert.rejects(classEmailService.runOnce(),/ALERTS_DATABASE_UNAVAILABLE/);assert.equal(calls.length,1);
  await db.query("UPDATE public.email_notification_outbox SET lease_until=now()-interval '1 second' WHERE state='processing'");
  await classEmailService.runOnce();assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);assert.equal(calls[0].body,calls[1].body);
  const count=calls.length;await classEmailService.runOnce();assert.equal(calls.length,count);
 }finally{env.supabaseServiceRoleKey=previousKey;process.env.EMAIL_ENABLED='false';process.env.RESEND_API_KEY='';process.env.EMAIL_FROM='';process.env.APP_PUBLIC_URL='';await db.close();}
});
