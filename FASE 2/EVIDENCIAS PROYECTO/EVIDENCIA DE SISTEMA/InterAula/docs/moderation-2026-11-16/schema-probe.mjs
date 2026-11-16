// Structure only: no real measures, incidents, reviewers or account details are read.
import {getAdminSupabase} from './dist/lib/supabase.js';
const client=getAdminSupabase(),checks=[];
for(const [table,fields]of[
 ['community_reviewers','profile_id,can_sanction,can_suspend_accounts'],
 ['moderation_findings','id,incident_id,severity,strike_expires_at,overturned_at'],
 ['moderation_measures','id,scope,subject_course_id,ends_at,revoked_at'],
 ['moderation_case_links','incident_id,finding_id'],
 ['moderation_appeal_reviews','incident_id,outcome,expected_revision'],
 ['tutor_availability_limits','profile_id,tutoring_unavailable,subject_ids'],
]){
 const {data,error}=await client.from(table).select(fields).limit(0);checks.push({table,available:!error,recordsRead:data?.length||0,errorCode:error?.code||null});
}
console.log(JSON.stringify({activationReady:checks.every(c=>c.available),checks,scope:'Remote structure only, limit(0). No role assignments, sanctions or other writes.'},null,2));
