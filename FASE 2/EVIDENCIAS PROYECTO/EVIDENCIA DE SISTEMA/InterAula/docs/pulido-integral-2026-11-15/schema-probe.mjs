// Read-only schema checks: every SELECT uses limit(0); no user records are downloaded.
import {config} from '../../backend/node_modules/dotenv/lib/main.js';
import {createRequire} from 'node:module';
import fs from 'node:fs';
config({path:'backend/.env'});
const {createClient}=createRequire(new URL('../../backend/package.json',import.meta.url))('@supabase/supabase-js');
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key||!process.env.SUPABASE_URL)throw Error('Falta la configuración privada local para comprobar el esquema.');
const client=createClient(process.env.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const tables=[
 ['profiles','id,community_preferences'],['subjects','id,name'],
 ['tutoring_sessions','id,status'],['tutoring_reviews','id,communication_score,knowledge_score,punctuality_score,overall_score'],
 ['tutor_statistics_view','profile_id,avg_communication,avg_knowledge,avg_punctuality,overall_rating'],
 ['badges','code'],['user_badges','profile_id'],['academic_notes','id'],['forum_posts','id'],
 ['projects','id'],['project_positions','id'],['project_deliverables','id'],
 ['tutoring_workshops','id'],['workshop_enrollments','workshop_id'],['recommendation_topics','id'],
 ['inclusive_tutor_accreditations','id,proof_version'],['tutor_assessment_attempts','id,question_deadline'],
 ['adaptive_skill_mastery','user_id'],['adaptive_practice_attempts','id'],
];
const checks=[];
for(const [table,columns]of tables){
 try{
  const {data,error,status}=await client.from(table).select(columns).limit(0);
  checks.push({table,ready:!error,status,code:error?.code||null,rowsRead:data?.length||0});
 }catch{checks.push({table,ready:false,status:0,code:'CONNECTION_FAILED',rowsRead:0});}
}
const result={checkedAt:new Date().toISOString(),readOnly:true,scope:'SELECT limit(0), no records, no RPC, no changes.',checks};
fs.writeFileSync('docs/pulido-integral-2026-11-15/supabase-schema.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(checks.some(check=>!check.ready||check.rowsRead!==0))process.exitCode=1;
