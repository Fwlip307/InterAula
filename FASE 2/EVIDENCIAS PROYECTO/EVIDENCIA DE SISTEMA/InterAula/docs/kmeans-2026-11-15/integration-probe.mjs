// Real Express -> HTTP -> scikit-learn, with synthetic auth/catalog/aggregates only.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
await import('../../backend/dist/tests/setup.js');
const require=createRequire(new URL('../../backend/package.json',import.meta.url)),request=require('supertest');
const {env}=await import('../../backend/dist/config/env.js');
const {app}=await import('../../backend/dist/app.js');
const {supabasePublic}=await import('../../backend/dist/lib/supabase.js');
const {tutoringBackendService}=await import('../../backend/dist/services/tutoring.service.js');
const {tutorRecommendationsService}=await import('../../backend/dist/services/tutorRecommendations.service.js');
const {clearTutorStatisticsCache}=await import('../../backend/dist/services/tutorStatistics.service.js');
assert.equal(env.nodeEnv,'test');assert.equal(env.supabaseUrl,'http://127.0.0.1:9');
env.supabaseServiceRoleKey='isolated-server-fixture';env.corsOrigins.push('http://127.0.0.1:5175');
process.env.ML_SERVICE_URL='http://127.0.0.1:8001';
const actualFetch=globalThis.fetch,calls=[];
globalThis.fetch=async(url,options)=>{
 if(!String(url).startsWith('http://127.0.0.1:8001/'))throw Error('External network disabled in synthetic integration');
 const payload=JSON.parse(options.body);assert.deepEqual(Object.keys(payload),['features']);
 calls.push({rows:payload.features.length,columns:payload.features[0]?.length});
 return actualFetch(url,options);
};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actor=id(999);
supabasePublic.auth.getUser=async()=>({data:{user:{id:actor,user_metadata:{},app_metadata:{}}},error:null});
const synthetic=await tutorRecommendationsService.demo('none');
const pool=synthetic.profiles.map((p,i)=>({id:id(i+1),display_name:p.displayName,first_name:p.displayName,career:'Carrera de prueba',available_for_tutoring:true,
 inclusive_accredited:i===0,profile_offered_subjects:[{subject_id:i%2===0?'math':'python',is_verified:true,level:'basic',subject:{name:i%2===0?'Matemáticas DEMO':'Python DEMO'}}]}));
const stats=synthetic.profiles.map((p,i)=>({profile_id:id(i+1),total_completed_tutorings:20,total_reviews_received:p.reviewCount,
 avg_communication:p.scores[0],avg_knowledge:p.scores[1],avg_punctuality:p.scores[2],overall_rating:Number((p.scores.reduce((a,b)=>a+b,0)/3).toFixed(2))}));
pool.push({id:id(50),display_name:'[DEMO] Tutor nuevo',profile_offered_subjects:[{subject_id:'math',is_verified:true,subject:{name:'Matemáticas DEMO'}}]});
tutoringBackendService.getAvailableTutors=async()=>pool;
Object.getPrototypeOf(supabasePublic).from=function(table){
 assert.equal(table,'tutor_statistics_view');let ids=[];
 const query={select(fields){assert.doesNotMatch(fields,/email|comment|student/);return query;},in(_field,value){ids=value;return query;},
 then(resolve){return Promise.resolve({data:stats.filter(s=>ids.includes(s.profile_id)),error:null}).then(resolve);}};
 return query;
};
const checks=[];
for(const [priority,label]of [['communication','Comunicación'],['knowledge','Dominio'],['punctuality','Puntualidad']]){
 const response=await request(app).get('/api/tutoring/recommendations?subjectId=math&priority='+priority).set('Authorization','Bearer fixture-only');
 assert.equal(response.status,200);const data=response.body.data;
 assert.equal(data.model.method,'kmeans',JSON.stringify({model:data.model,stats:data.tutors.filter(t=>t.statistics).length,calls}));assert.match(data.tutors[0].display_name,new RegExp(label));
 assert.ok(data.tutors.every(t=>t.profile_offered_subjects.some(s=>s.subject_id==='math'&&s.is_verified)));
 assert.equal(data.tutors[4].display_name,'[DEMO] Tutor nuevo');
 checks.push({priority,model:data.model,first:data.tutors[0].display_name,count:data.tutors.length});
 const demo=await request(app).get('/api/tutoring/recommendations/demo?priority='+priority).set('Authorization','Bearer fixture-only');
 assert.equal(demo.status,200);assert.equal(demo.body.data.model.dataset,'synthetic_demo');assert.equal(demo.body.data.model.method,'kmeans');
}
const previous=process.env.ML_SERVICE_URL;process.env.ML_SERVICE_URL='http://127.0.0.1:9';
const offline=await request(app).get('/api/tutoring/recommendations?priority=knowledge').set('Authorization','Bearer fixture-only');
assert.equal(offline.status,200);assert.equal(offline.body.data.model.status,'unavailable');assert.equal(offline.body.data.tutors.length,19);
process.env.ML_SERVICE_URL=previous;clearTutorStatisticsCache();
fs.writeFileSync('docs/kmeans-2026-11-15/integration-verification.json',JSON.stringify({passed:true,scope:'Real Express and Python/scikit-learn over localhost. Synthetic identity and aggregates, no Supabase access or writes.',checks,offlineCatalog:true,numericRequests:calls},null,2));
console.log(JSON.stringify({passed:true,priorities:checks.map(c=>({priority:c.priority,first:c.first,groups:c.model.clusterCount})),offlineCatalog:true}));
if(process.argv.includes('--serve'))app.listen(3002,'127.0.0.1',()=>console.log('Synthetic integration API listening on 127.0.0.1:3002'));
