import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';
import {interestClusteringService} from '../services/interestClustering.service.js';
import {interestDemoFixture,interestDemoService} from '../services/interestDemo.service.js';
import {rankRecommendations,type RecommendationCandidate} from '../services/recommendationEngine.js';

function fixture(t:TestContext){
 const previous=process.env.ML_SERVICE_URL;process.env.ML_SERVICE_URL='http://interests.fixture';
 t.after(()=>{process.env.ML_SERVICE_URL=previous||'';});
 const payloads:any[]=[];
 const mock=t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{
  assert.equal(url,'http://interests.fixture/interests');
  const body=JSON.parse(options.body);payloads.push(body);
  const rows=body.features as number[][];
  const centroids=[0,6,12].map(i=>rows[i].map(value=>value/Math.hypot(...rows[i])));
  return {ok:true,json:async()=>({status:'ready',trainingCount:rows.length,k:3,centroids,silhouette:.8,modelVersion:'interests-kmeans-v1',libraryVersion:'fixture'})} as Response;
 });
 return {input:interestDemoFixture({focus:'data',scope:'all'}),payloads,mock};
}

test('Intereses: Python recibe solo temas públicos binarios; consulta privada y sede no salen del backend',async t=>{
 const {input,payloads}=fixture(t);
 input.preferences.interest.push('PRIVATE_QUERY_MARKER');
 const result=await interestClusteringService.match(input);
 assert.equal(result.metadata.method,'hybrid-kmeans');assert.equal(result.metadata.trainingCount,18);
 assert.deepEqual(Object.keys(payloads[0]),['features']);
 assert.equal(payloads[0].features.length,18);assert.equal(payloads[0].features[0].length,9);
 assert.ok(payloads[0].features.flat().every((v:number)=>v===0||v===1));
 assert.doesNotMatch(JSON.stringify(payloads),/PRIVATE_QUERY_MARKER|institution|campus|userId|email|intent/);
 const changed=await interestClusteringService.match({...input,preferences:{...input.preferences,learn:['web-0'],interest:['web-1']}});
 assert.deepEqual(payloads[0],payloads[1]);
 assert.notEqual(result.boosts.get('note:demo-content-0-0'),changed.boosts.get('note:demo-content-0-0'));
});

test('Intereses: desactivación, selección vacía y población pequeña no invocan ML',async t=>{
 const {input,payloads}=fixture(t);
 assert.equal((await interestClusteringService.match({...input,preferences:{...input.preferences,personalization_enabled:false}})).metadata.status,'disabled');
 assert.equal((await interestClusteringService.match({...input,preferences:{...input.preferences,interest:[],learn:[],teach:[]}})).metadata.status,'no_interests');
 assert.equal((await interestClusteringService.match({...input,candidates:input.candidates.filter(c=>c.kind!=='person')})).metadata.status,'insufficient_data');
 assert.equal(payloads.length,0);
});

test('Intereses: ocultos, repetidos, propio y perfiles sin temas públicos no se usan para ajustar',async t=>{
 const {input,payloads}=fixture(t);
 input.candidates.push({...input.candidates[0]},{...input.candidates[0],id:'demo-reader'},
  {...input.candidates[0],id:'private-person',interests:[],offeredSubjects:[{id:'x',name:'Python',verified:false}]});
 const result=await interestClusteringService.match({...input,dismissed:['person:demo-person-0-0']});
 assert.equal(result.metadata.trainingCount,17);assert.equal(payloads[0].features.length,17);
});

test('Intereses: modelo malformado o indisponible conserva afinidad, sin inventar grupos',async t=>{
 const {input,mock}=fixture(t);
 for(const reply of [{status:'ready'},null,{status:'ready',k:3,centroids:[[1,0]],silhouette:.8,trainingCount:18,modelVersion:'interests-kmeans-v1',libraryVersion:'fixture'}]){
  mock.mock.mockImplementation(async()=>({ok:true,json:async()=>reply}) as Response);
  const result=await interestClusteringService.match(input);
  assert.equal(result.metadata.status,'unavailable');assert.equal(result.boosts.size,0);
 }
 mock.mock.mockImplementation(async()=>{throw Error('No network');});
 assert.equal((await interestClusteringService.match(input)).metadata.status,'unavailable');
});

test('Intereses: el timeout de ML es acotado',async t=>{
 const {input,mock}=fixture(t);
 t.mock.timers.enable({apis:['setTimeout']});
 mock.mock.mockImplementation((_url:any,options:any)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('cancelled')))) as any);
 const waiting=interestClusteringService.match(input);t.mock.timers.tick(5001);
 assert.equal((await waiting).metadata.status,'unavailable');
});

test('Híbrido: no reintroduce temas ajenos, ocultos, materias sin acreditar o perfiles fuera del alcance',async t=>{
 const {input}=fixture(t),matching=await interestClusteringService.match(input);
 const unrelated:RecommendationCandidate={id:'foreign',kind:'note',title:'Otro tema',text:'Un tema ajeno',summary:'',href:'#',createdAt:'2026-12-01'};
 input.candidates.push(unrelated,{...unrelated,id:'unverified',kind:'person',offeredSubjects:[{id:'python',name:'Python',verified:false}]});
 matching.boosts.set('note:foreign',999);matching.boosts.set('person:unverified',999);
 const feed=rankRecommendations({...input,dismissed:['note:demo-content-0-0'],clusterBoosts:matching.boosts});
 assert.ok(feed.items.length);assert.ok(feed.items.some(item=>item.clusterReason));
 assert.ok(feed.items.every(item=>!['foreign','unverified','demo-content-0-0'].includes(item.id)));
 const campus=rankRecommendations({...input,community:{...input.community,scope:'campus'},clusterBoosts:matching.boosts});
 assert.ok(campus.items.every(item=>item.communityReason==='Misma institución y sede'));
 const disabled=rankRecommendations({...input,preferences:{...input.preferences,personalization_enabled:false},clusterBoosts:matching.boosts});
 assert.ok(disabled.items.every(item=>!item.clusterReason&&item.kind!=='person'));
});

test('DEMO: cambia temas y alcance sin escribir datos; no devuelve enlaces para contactar perfiles',async t=>{
 fixture(t);
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',()=>{throw Error('DEMO must not access Supabase');});
 const all=await interestDemoService.run({focus:'data',scope:'all'});
 assert.equal(all.dataset,'synthetic_demo');assert.ok(all.items.some(item=>item.kind==='project'));
 assert.ok(all.items.every(item=>!('href' in item)&&item.title.includes('Python')));
 const campus=await interestDemoService.run({focus:'web',scope:'campus'});
 assert.ok(campus.items.length);assert.ok(campus.items.every(item=>item.communityReason==='Misma institución y sede'&&item.title.includes('Desarrollo web')));
 const nearby=await interestDemoService.run({focus:'business',scope:'nearby'});
 assert.ok(nearby.items.every(item=>['Misma institución y sede','Sede en la misma comuna'].includes(item.communityReason||'')));
});

test('DEMO: API autenticada, parámetros limitados y rechazo de datos de ubicación o identidad inyectados',async t=>{
 fixture(t);
 assert.equal((await request(app).get('/api/recommendations/demo')).status,401);
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000222'}},error:null}));
 for(const query of ['focus=unknown','scope=city','focus=data&userId=another','focus=data&latitude=1']){
  assert.equal((await request(app).get('/api/recommendations/demo?'+query).set('Authorization','Bearer fixture')).status,400);
 }
 const reply=await request(app).get('/api/recommendations/demo?focus=web&scope=campus').set('Authorization','Bearer fixture');
 assert.equal(reply.status,200);assert.equal(reply.body.data.matching.method,'hybrid-kmeans');
});
