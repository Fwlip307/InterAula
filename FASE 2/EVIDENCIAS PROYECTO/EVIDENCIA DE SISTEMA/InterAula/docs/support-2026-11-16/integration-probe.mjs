// Real HTTP Express -> ephemeral PostgreSQL/RLS. Synthetic accounts only.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
await import('../../backend/dist/tests/setup.js');
const {env}=await import('../../backend/dist/config/env.js'),{app}=await import('../../backend/dist/app.js'),{supabasePublic}=await import('../../backend/dist/lib/supabase.js'),{createTestPostgres}=await import('../../backend/dist/tests/helpers/postgres.js');
assert.equal(env.nodeEnv,'test');assert.equal(env.supabaseUrl,'http://127.0.0.1:9');env.corsOrigins.push('http://127.0.0.1:5175');
globalThis.fetch=async()=>{throw Error('External network blocked in synthetic support fixture');};
const require=createRequire(new URL('../../backend/package.json',import.meta.url)),request=require('supertest'),db=await createTestPostgres();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actors={'qa-reporter':id(600),'qa-respondent':id(601),'qa-reviewer':id(602),'qa-appeal':id(603),'qa-outsider':id(604)},target=id(610);
for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
for(const actor of Object.values(actors))await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,actor+'@example.test']);
const subject=(await db.query('SELECT id FROM public.subjects LIMIT 1')).rows[0].id;
await db.exec('SET session_replication_role=replica');await db.query("INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status) VALUES($1,$2,$3,$4,now()-interval '2 hours','accepted')",[target,actors['qa-reporter'],actors['qa-respondent'],subject]);await db.exec('SET session_replication_role=origin');
// Appointment is restricted to this in-memory fixture; no real reviewer account is assigned.
await db.query('INSERT INTO public.community_reviewers(profile_id) VALUES($1),($2)',[actors['qa-reviewer'],actors['qa-appeal']]);
supabasePublic.auth.getUser=async token=>({data:{user:actors[token]?{id:actors[token],email:'qa@example.test',user_metadata:{},app_metadata:{}}:null},error:actors[token]?null:Error('Invalid fixture token')});
const signatures={get_my_inbox:['p_include_items'],read_my_notice:['p_id'],list_incidents:['p_queue'],get_incident:['p_id'],create_incident:['p_kind','p_target','p_category','p_description'],act_on_incident:['p_id','p_action','p_message','p_revision']};
Object.getPrototypeOf(supabasePublic).rpc=async function(name,args){
 assert.ok(name in signatures,'Unexpected RPC '+name);const keys=signatures[name];
 try{const data=(await db.query('SELECT public.'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') AS value',keys.map(k=>args[k]))).rows[0].value;return {data,error:null};}
 catch(error){return {data:null,error:{code:error.code}};}
};
let queue=Promise.resolve();const server=http.createServer((req,res)=>{const previous=queue;let release;queue=new Promise(resolve=>release=resolve);previous.then(async()=>{
 const token=(req.headers.authorization||'').replace(/^Bearer /,''),actor=actors[token]||'';await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');
 res.on('finish',release);res.on('close',release);app(req,res);
}).catch(error=>{console.error('Fixture request failed',error.code);res.statusCode=500;res.end();release();});});
const call=(method,url,token)=>request(server)[method]('/api/support'+url).set('Authorization','Bearer '+token);
assert.equal((await request(server).get('/api/support/inbox')).status,401);
const body={kind:'session',targetId:target,category:'agreement',description:'PRIVATE_REPORT_MARKER: descripción ficticia de un acuerdo no respetado.'};
let response=await call('post','/cases','qa-reporter').send(body);assert.equal(response.status,200);let c=response.body.data;
assert.equal((await call('get','/cases/'+c.id,'qa-respondent')).status,403);assert.equal((await call('get','/cases/'+c.id,'qa-outsider')).status,403);
assert.equal((await call('get','/cases?queue=review','qa-reporter')).status,403);
const action=async(token,action,message='')=>{const r=await call('post','/cases/'+c.id+'/actions',token).send({action,message,revision:c.revision});assert.equal(r.status,200);c=r.body.data;};
await action('qa-reviewer','claim');await action('qa-reviewer','note','PRIVATE_INTERNAL_MARKER: nota interna ficticia.');await action('qa-reviewer','request_reply','Resumen ficticio revisado: se necesita aclarar el acuerdo de horario.');
const respondent=await call('get','/cases/'+c.id,'qa-respondent');assert.equal(respondent.body.data.description,null);assert.doesNotMatch(JSON.stringify(respondent.body),/PRIVATE_REPORT_MARKER|PRIVATE_INTERNAL_MARKER/);
await action('qa-respondent','reply','PRIVATE_RESPONSE_MARKER: versión ficticia para el equipo.');await action('qa-reviewer','resolve','Resolución ficticia explicada con los antecedentes disponibles, sin medidas automáticas.');
await action('qa-reporter','appeal','Solicitud ficticia de revisión independiente por antecedentes adicionales.');
assert.equal((await call('post','/cases/'+c.id+'/actions','qa-reviewer').send({action:'claim',message:'',revision:c.revision})).status,403);
await action('qa-appeal','claim');await action('qa-appeal','close','Revisión independiente ficticia terminada con una explicación de cierre.');
const inbox=(await call('get','/inbox','qa-reporter')).body.data;assert.ok(inbox.unreadCount>0);assert.doesNotMatch(JSON.stringify(inbox),/PRIVATE_REPORT_MARKER|PRIVATE_INTERNAL_MARKER|PRIVATE_RESPONSE_MARKER/);
await call('post','/inbox/read','qa-reporter').send({});assert.equal((await call('get','/inbox?summary=true','qa-reporter')).body.data.unreadCount,0);
fs.writeFileSync('docs/support-2026-11-16/integration-verification.json',JSON.stringify({passed:true,privateReport:true,privateTeamNotes:true,independentAppeal:true,ownInbox:true,scope:'Real HTTP Express and real SQL/RLS over in-memory PostgreSQL. Synthetic identities only; no real Supabase, email or Gemini requests.'},null,2));
console.log(JSON.stringify({passed:true,target}));
if(process.argv.includes('--serve'))server.listen(3002,'127.0.0.1',()=>console.log('Synthetic support API on 127.0.0.1:3002'));else{server.close();await db.close();}
