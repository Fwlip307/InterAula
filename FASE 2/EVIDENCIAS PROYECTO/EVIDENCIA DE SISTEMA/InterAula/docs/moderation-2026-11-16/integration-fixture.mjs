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
await db.query('INSERT INTO public.community_reviewers(profile_id,can_sanction,can_suspend_accounts) VALUES($1,true,true),($2,true,true)',[actors['qa-reviewer'],actors['qa-appeal']]);
supabasePublic.auth.getUser=async token=>({data:{user:actors[token]?{id:actors[token],email:'qa@example.test',user_metadata:{},app_metadata:{}}:null},error:actors[token]?null:Error('Invalid fixture token')});
const {moderationService}=await import('../../backend/dist/services/moderation.service.js');
moderationService.summary=async()=> (await db.query('SELECT public.get_my_moderation_summary() AS value')).rows[0].value;
const signatures={get_my_moderation_summary:[],get_my_measures:[],moderation_case_context:['p_id'],decide_moderation_measure:['p_id','p_revision','p_document'],decide_measure_appeal:['p_id','p_revision','p_outcome','p_reason','p_message'],get_my_inbox:['p_include_items'],read_my_notice:['p_id'],list_incidents:['p_queue'],get_incident:['p_id'],create_incident:['p_kind','p_target','p_category','p_description'],act_on_incident:['p_id','p_action','p_message','p_revision']};
Object.getPrototypeOf(supabasePublic).rpc=async function(name,args){
 assert.ok(name in signatures,'Unexpected RPC '+name);const keys=signatures[name];
 try{const data=(await db.query('SELECT public.'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') AS value',keys.map(k=>k==='p_document'?JSON.stringify(args[k]):args?.[k]))).rows[0].value;return {data,error:null};}
 catch(error){return {data:null,error:{code:error.code}};}
};
let queue=Promise.resolve();const server=http.createServer((req,res)=>{const previous=queue;let release;queue=new Promise(resolve=>release=resolve);previous.then(async()=>{
 const token=(req.headers.authorization||'').replace(/^Bearer /,''),actor=actors[token]||'';await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actor]);await db.exec('SET ROLE authenticated');
 res.on('finish',release);res.on('close',release);app(req,res);
}).catch(error=>{console.error('Fixture request failed',error.code);res.statusCode=500;res.end();release();});});

server.listen(3002,'127.0.0.1',()=>console.log('Synthetic moderation API: isolated SQL, no real users'));
