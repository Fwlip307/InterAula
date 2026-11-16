// Inside the backend container: schema only (limit 0); no records or RPC execution.
import {getAdminSupabase} from './dist/lib/supabase.js';
const client=getAdminSupabase(),checks=[];
for(const [table,fields]of[
 ['tutor_reputation_public','profile_id,valid_sessions,legacy_sessions,recent_reviews,recent_reviewers,communication_adjusted,communication_highlight,knowledge_highlight,punctuality_highlight'],
 ['tutoring_sessions','completion_policy_version,completion_verified_at,completion_method,tutor_completion_confirmed_at,student_completion_confirmed_at'],
]){
 const {data,error}=await client.from(table).select(fields).limit(0);
 checks.push({table,available:!error,recordsRead:data?.length||0,errorCode:error?.code||null});
}
if(checks.some(c=>!c.available))process.exitCode=1;
console.log(JSON.stringify({passed:checks.every(c=>c.available),checks,scope:'Configured Supabase schema only, SELECT limit(0). No records, writes, RPCs or secret output.'},null,2));
