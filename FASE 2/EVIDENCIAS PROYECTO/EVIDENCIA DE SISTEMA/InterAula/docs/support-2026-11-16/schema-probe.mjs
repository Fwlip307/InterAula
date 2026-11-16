// Execute in backend container: structure only. No incident text, notifications or role rows read.
import {getAdminSupabase} from './dist/lib/supabase.js';
const client=getAdminSupabase(),checks=[];
for(const [table,fields]of[
 ['community_incidents','id,target_kind,target_id,status,revision,appeal_used'],
 ['community_incident_events','id,incident_id,audience'],['community_reviewers','profile_id,active'],['user_notifications','id,recipient_id,read_at'],
]){
 const {data,error}=await client.from(table).select(fields).limit(0);checks.push({table,available:!error,recordsRead:data?.length||0,errorCode:error?.code||null});
}
console.log(JSON.stringify({passed:checks.every(c=>c.available),checks,scope:'Configured Supabase structure only, SELECT limit(0); no records, writes, reviewer assignments or RPCs.'},null,2));
if(checks.some(c=>!c.available))process.exitCode=1;
