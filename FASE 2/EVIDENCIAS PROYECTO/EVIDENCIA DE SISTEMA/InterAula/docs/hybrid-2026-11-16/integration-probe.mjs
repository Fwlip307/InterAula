// Isolated fake identity and RLS-visible metadata; real Express and Python/scikit-learn.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
await import('../../backend/dist/tests/setup.js');
const require=createRequire(new URL('../../backend/package.json',import.meta.url)),request=require('supertest');
const {env}=await import('../../backend/dist/config/env.js');
const {app}=await import('../../backend/dist/app.js');
const {supabasePublic}=await import('../../backend/dist/lib/supabase.js');
const {recommendationService}=await import('../../backend/dist/services/recommendation.service.js');
const {interestDemoFixture}=await import('../../backend/dist/services/interestDemo.service.js');
assert.equal(env.nodeEnv,'test');assert.equal(env.supabaseUrl,'http://127.0.0.1:9');
env.corsOrigins.push('http://127.0.0.1:5175');process.env.ML_SERVICE_URL='http://127.0.0.1:8001';
const actualFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='http://127.0.0.1:8001/interests')throw Error('External network blocked');
 const payload=JSON.parse(options.body);assert.deepEqual(Object.keys(payload),['features']);
 assert.ok(payload.features.flat().every(v=>v===0||v===1));return actualFetch(url,options);
};
const fixture=interestDemoFixture({focus:'data',scope:'all'}),people=fixture.candidates.filter(c=>c.kind==='person');
const actor='00000000-0000-4000-8000-000000000999';
supabasePublic.auth.getUser=async()=>({data:{user:{id:actor}},error:null});
recommendationService.topics=async()=>fixture.topics;
recommendationService.preferences=async()=>fixture.preferences;
const profiles=people.map(p=>({id:p.id,display_name:p.title,first_name:p.title,...p.origin,available_for_projects:true,available_for_tutoring:false,updated_at:p.createdAt}));
const tables={public_profiles:profiles,profiles:[{id:actor,institution:fixture.reference.institution,location:fixture.reference.campus,community_preferences:fixture.community}],
 discoverable_topic_interests:people.flatMap(p=>p.interests.map(i=>({user_id:p.id,...i}))),profile_offered_subjects:[],profile_needed_subjects:[],subjects:[],recommendation_dismissals:[]};
for(const [kind,table]of [['note','academic_notes'],['post','forum_posts'],['project','projects'],['workshop','workshop_summary']]){
 tables[table]=fixture.candidates.filter(c=>c.kind===kind).map((c,i)=>({id:c.id,title:c.title,summary:c.text,description:c.text,
  author_id:people[i*6+(kind==='post'||kind==='workshop'?1:kind==='project'?2:0)].id,
  owner_id:people[i*6+2].id,tutor_id:people[i*6+1].id,created_at:c.createdAt,tags:[],technologies:[],
  is_draft:false,visibility:'public',status:kind==='project'?'open':'scheduled',scheduled_at:'2030-01-01',max_students:10,enrollments_count:0,modality:'online'}));
}
Object.getPrototypeOf(supabasePublic).from=function(table){
 assert.ok(table in tables,'Unexpected table '+table);let rows=[...tables[table]],single=false;
 const query={select(fields){assert.doesNotMatch(fields,/email|phone|diagnosis|learning_preferences|content_html/);return query;},
  eq(field,value){rows=rows.filter(row=>row[field]===value);return query;},neq(field,value){rows=rows.filter(row=>row[field]!==value);return query;},
  in(field,values){rows=rows.filter(row=>values.includes(row[field]));return query;},or(){return query;},order(){return query;},limit(count){rows=rows.slice(0,count);return query;},
  maybeSingle(){single=true;return query;},then(resolve){return Promise.resolve({data:single?rows[0]||null:rows,error:null}).then(resolve);}};
 return query;
};
const checks=[];
for(const focus of ['data','web','business'])for(const scope of ['all','campus','nearby']){
 const response=await request(app).get(`/api/recommendations/demo?focus=${focus}&scope=${scope}`).set('Authorization','Bearer fixture');
 assert.equal(response.status,200);const data=response.body.data;assert.equal(data.matching.status,'ready');assert.ok(data.items.length);
 assert.ok(data.items.every(item=>!('href' in item)));
 if(scope==='campus')assert.ok(data.items.every(item=>item.communityReason==='Misma institución y sede'));
 if(scope==='nearby')assert.ok(data.items.every(item=>['Misma institución y sede','Sede en la misma comuna'].includes(item.communityReason)));
 checks.push({focus,scope,count:data.items.length,clusters:data.matching.clusterCount});
}
const feed=await request(app).get('/api/recommendations/feed').set('Authorization','Bearer fixture');
assert.equal(feed.status,200);assert.equal(feed.body.data.algorithmVersion,'interests-hybrid-v3');assert.equal(feed.body.data.matching.status,'ready');
assert.ok(feed.body.data.items.some(item=>item.clusterReason));
const url=process.env.ML_SERVICE_URL;process.env.ML_SERVICE_URL='http://127.0.0.1:9';
const offline=await request(app).get('/api/recommendations/feed').set('Authorization','Bearer fixture');
assert.equal(offline.status,200);assert.equal(offline.body.data.matching.status,'unavailable');assert.ok(offline.body.data.items.length);
process.env.ML_SERVICE_URL=url;
fs.writeFileSync('docs/hybrid-2026-11-16/integration-verification.json',JSON.stringify({passed:true,checks,feed:true,offline:true,
 scope:'Real Express to real Python, synthetic auth and Supabase query responses. No external database, writes or Gemini calls.'},null,2));
console.log(JSON.stringify({passed:true,scenarios:checks.length,feed:true,offline:true}));
if(process.argv.includes('--serve'))app.listen(3002,'127.0.0.1',()=>console.log('Synthetic integration API on 127.0.0.1:3002'));
