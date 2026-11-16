import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {app} from '../app.js';
import {env} from '../config/env.js';
import {supabasePublic} from '../lib/supabase.js';
import {tutoringBackendService} from '../services/tutoring.service.js';
import {clearTutorStatisticsCache,readTutorStatistics} from '../services/tutorStatistics.service.js';
import {tutorRecommendationsService} from '../services/tutorRecommendations.service.js';
import {tutorClusteringService,rankClusteredTutors,type TutorVector} from '../services/tutorClustering.service.js';

const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scores:[number,number,number][]=[[9.3,6,6],[9.2,6.1,6],[6,9.4,6],[6.1,9.3,6],[6,6,9.5],[6,6.1,9.4]];
const vectors:TutorVector[]=scores.map((row,i)=>({id:id(i+1),scores:row,reviews:12}));
const model={status:'ready' as const,labels:[2,2,1,1,0,0],centroids:[[6,6.05,9.45],[6.05,9.35,6],[9.25,6.05,6]] as [number,number,number][],k:3,silhouette:.9,trainingCount:6,modelVersion:'kmeans-ratings-v1' as const,libraryVersion:'fixture'};
function fixture(t:TestContext){
 const previous=env.supabaseServiceRoleKey,url=process.env.ML_SERVICE_URL;
 env.supabaseServiceRoleKey='fixture-private-key';process.env.ML_SERVICE_URL='http://ml.fixture';clearTutorStatisticsCache();
 t.after(()=>{env.supabaseServiceRoleKey=previous;process.env.ML_SERVICE_URL=url||'';clearTutorStatisticsCache();});
 const pool=[...vectors.map((row,i)=>({id:row.id,display_name:'Tutor '+i,email:'private-fixture@example.test',available_for_tutoring:true,
  inclusive_accredited:i===0,profile_offered_subjects:[{subject_id:i<2?'math':'python',is_verified:true,subject:{name:i<2?'Matemáticas':'Python'}}]})),
  {id:id(8),display_name:'Nuevo tutor',profile_offered_subjects:[{subject_id:'math',is_verified:true,subject:{name:'Matemáticas'}}]}];
 const stats=vectors.map(row=>({profile_id:row.id,total_completed_tutorings:15,total_reviews_received:row.reviews,
  avg_communication:row.scores[0],avg_knowledge:row.scores[1],avg_punctuality:row.scores[2],overall_rating:8}));
 const queries:any[]=[];
 t.mock.method(tutoringBackendService,'getAvailableTutors',async()=>pool);
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
  assert.equal(table,'tutor_statistics_view');const row:any={table};queries.push(row);
  const query:any={select(fields:string){row.fields=fields;return query;},in(_field:string,ids:string[]){row.ids=ids;return query;},then(resolve:any){return Promise.resolve({data:stats.filter(s=>row.ids.includes(s.profile_id)),error:null}).then(resolve);}};
  return query;
 });
 t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{
  assert.equal(url,'http://ml.fixture/cluster');
  const body=JSON.parse(options.body);
  assert.deepEqual(Object.keys(body),['features']);
  assert.deepEqual(body.features,scores);
  assert.equal(JSON.stringify(body).includes('private-fixture'),false);
  assert.equal(options.headers.Authorization,undefined);
  return new Response(JSON.stringify(model));
 });
 return {pool,stats,queries};
}

test('Cambiar prioridad cambia el grupo preferido y deja espacio a tutores nuevos',()=>{
 const pool=[...vectors.map(v=>({id:v.id})),{id:id(8)}];
 assert.equal(rankClusteredTutors(pool,vectors,model,'communication')[0].id,id(1));
 assert.equal(rankClusteredTutors(pool,vectors,model,'knowledge')[0].id,id(3));
 assert.equal(rankClusteredTutors(pool,vectors,model,'punctuality')[0].id,id(5));
 const result=rankClusteredTutors(pool,vectors,model,'communication');
 assert.equal(result[4].id,id(8));assert.equal(result.length,pool.length);
 assert.equal(rankClusteredTutors(pool,vectors,model,'none'),pool);
});
test('Los filtros de materia/acreditación e inclusión se aplican antes de recomendar; se excluye a sí mismo',async t=>{
 const f=fixture(t);
 f.pool.push({id:id(9),display_name:'Sin acreditar',profile_offered_subjects:[{subject_id:'math',is_verified:false,subject:{name:'Matemáticas'}}]} as any);
 const result=await tutorRecommendationsService.list(id(1),{priority:'communication',subjectId:'math'});
 assert.equal(result.model.method,'kmeans');assert.deepEqual(result.tutors.map(t=>t.id),[id(2),id(8)]);
 const inclusive=await tutorRecommendationsService.list(id(99),{priority:'communication',onlyInclusive:'true'});
 assert.deepEqual(inclusive.tutors.map(t=>t.id),[id(1)]);
 const accent=await tutorRecommendationsService.list(id(99),{priority:'communication',search:'matematicas'});
 assert.equal(accent.tutors.length,3);assert.equal(accent.tutors[0].statistics.avg_communication,9.3);
 assert.equal(f.queries.length,1);
 assert.doesNotMatch(f.queries[0].fields,/email|student|comment|diagnos|preferences/);
});
test('Agregados se cachean brevemente y la invalidación refresca las nuevas valoraciones',async t=>{
 const f=fixture(t),ids=f.pool.map(p=>p.id);
 await readTutorStatistics(ids);await readTutorStatistics(ids);assert.equal(f.queries.length,1);
 clearTutorStatisticsCache();f.stats[0].total_reviews_received=13;
 const fresh=await readTutorStatistics(ids);assert.equal(f.queries.length,2);assert.equal(fresh![0].total_reviews_received,13);
});
test('Sin reseñas suficientes no se llama al modelo y se conserva el catálogo filtrado',async t=>{
 const f=fixture(t);f.stats.forEach(s=>s.total_reviews_received=2);
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No model call expected');});
 const result=await tutorRecommendationsService.list(id(99),{priority:'balanced'});
 assert.equal(result.model.status,'insufficient_data');assert.equal(result.model.method,'catalog');assert.equal(result.tutors.length,f.pool.length);
 assert.ok(result.tutors.every(t=>t.recommendation===null));
});
test('Modelo caído o estadísticas no disponibles no impiden buscar tutores',async t=>{
 fixture(t);t.mock.method(globalThis,'fetch',async()=>{throw Error('private upstream error');});
 const result=await tutorRecommendationsService.list(id(99),{priority:'communication'});
 assert.equal(result.model.status,'unavailable');assert.equal(result.tutors.length,7);
 assert.doesNotMatch(JSON.stringify(result),/private upstream error|fixture-private-key/);
 clearTutorStatisticsCache();env.supabaseServiceRoleKey=undefined;
 const noStats=await tutorRecommendationsService.list(id(99),{priority:'communication'});
 assert.equal(noStats.model.status,'unavailable');assert.equal(noStats.tutors.length,7);
});
test('Se rechazan respuestas malformadas del servicio ML y el tiempo de espera es acotado',async t=>{
 fixture(t);
 for(const invalid of [{...model,labels:[0]}, {...model,labels:[9,9,1,1,0,0]}, {...model,centroids:[[0,5,5]]}, {...model,trainingCount:3}, {...model,status:'ready',silhouette:-.5}]){
  const mock=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(invalid)));
  assert.equal((await tutorClusteringService.fit(vectors)).status,'unavailable');mock.mock.restore();
 }
 t.mock.timers.enable({apis:['setTimeout']});
 t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>new Promise((_resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('aborted')));}));
 const result=tutorClusteringService.fit(vectors);t.mock.timers.tick(5001);
 assert.equal((await result).status,'unavailable');t.mock.timers.reset();
});
test('Endpoints requieren sesión, aceptan solo preferencias permitidas y usan la identidad del token',async t=>{
 assert.equal((await request(app).get('/api/tutoring/recommendations')).status,401);
 assert.equal((await request(app).get('/api/tutoring/recommendations/demo')).status,401);
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:id(99),user_metadata:{},app_metadata:{}}},error:null} as any));
 const calls:any[]=[];
 t.mock.method(tutorRecommendationsService,'list',async(...args:any[])=>{calls.push(args);return {tutors:[],model:{status:'insufficient_data'}} as any;});
 const valid=await request(app).get('/api/tutoring/recommendations?priority=knowledge').set('Authorization','Bearer fixture');
 assert.equal(valid.status,200);assert.equal(calls[0][0],id(99));assert.equal(calls[0][1].priority,'knowledge');
 for(const suffix of ['?priority=diagnosis','?user_id='+id(1),'?onlyInclusive=1','?search='+'x'.repeat(121)]){
  assert.equal((await request(app).get('/api/tutoring/recommendations'+suffix).set('Authorization','Bearer fixture')).status,400);
 }
 assert.equal(calls.length,1);
});
test('El ejemplo sintético usa el modelo pero no consulta ni modifica Supabase',async t=>{
 fixture(t);
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',()=>{throw Error('No database in demo');});
 t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>{
  const features=JSON.parse(options.body).features;assert.equal(features.length,18);
  return new Response(JSON.stringify({...model,labels:[...Array(6).fill(2),...Array(6).fill(1),...Array(6).fill(0)],trainingCount:18}));
 });
 const result=await tutorRecommendationsService.demo('knowledge');
 assert.equal(result.model.dataset,'synthetic_demo');assert.equal(result.model.method,'kmeans');assert.match(result.profiles[0].displayName,/\[DEMO\].*Dominio/);
 assert.ok(result.profiles.every(p=>p.id.startsWith('demo-')));
});
