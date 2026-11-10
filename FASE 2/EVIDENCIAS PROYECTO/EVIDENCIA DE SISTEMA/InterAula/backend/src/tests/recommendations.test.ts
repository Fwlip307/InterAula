import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { supabasePublic } from '../lib/supabase.js';
import { recommendationService } from '../services/recommendation.service.js';
import { recommendationPreferencesSchema } from '../schemas/recommendation.schema.js';
import { defaultRecommendationPreferences, detectTopics, rankRecommendations,
  type InterestTopic, type RecommendationCandidate } from '../services/recommendationEngine.js';

const topics:InterestTopic[]=[
  {id:'python',name:'Python',category:'Tech',aliases:['python','pandas']},
  {id:'databases',name:'Bases de datos',category:'Tech',aliases:['sql','base de datos']},
  {id:'java',name:'Java',category:'Tech',aliases:['java']},
  {id:'javascript',name:'JavaScript',category:'Tech',aliases:['javascript','typescript']},
];
const candidate=(id:string,kind:RecommendationCandidate['kind']='note',text='Python'):RecommendationCandidate=>({
  id,kind,title:text,summary:'',text,href:'/resources?note='+id,createdAt:'2026-01-01T00:00:00Z',
});
test('Coincidencias: normaliza tildes y respeta palabras completas, sin confundir Java y JavaScript',()=>{
  assert.deepEqual(detectTopics('Guía de BASE DE DATOS y SQL',topics),['databases']);
  assert.deepEqual(detectTopics('JavaScript y Python',topics),['python','javascript']);
  assert.deepEqual(detectTopics('javaland / nosqlite',topics),[]);
});
test('El feed personalizado excluye temas ajenos y explica la coincidencia',()=>{
  const feed=rankRecommendations({userId:'me',topics,preferences:{...defaultRecommendationPreferences(),learn:['python']},
    candidates:[candidate('python'),candidate('java','note','Java')]});
  assert.equal(feed.mode,'personalized');assert.deepEqual(feed.items.map(item=>item.id),['python']);
  assert.equal(feed.items[0].reason,'Quieres aprender Python');
});
test('Personas: complementariedad entre aprender y enseñar sin inventar una acreditación',()=>{
  const person={...candidate('teacher','person'),interests:[{topic_id:'python',intent:'teach' as const}]};
  const feed=rankRecommendations({userId:'me',topics,preferences:{...defaultRecommendationPreferences(),learn:['python']},candidates:[person]});
  assert.equal(feed.items.length,1);assert.match(feed.items[0].reason,/Comparte conocimientos/);
  assert.doesNotMatch(feed.items[0].reason,/acreditado/);
});
test('Materias a reforzar: prioriza al tutor realmente acreditado de esa asignatura',()=>{
  const person={...candidate('teacher','person'),offeredSubjects:[{id:'sql-id',name:'Bases de Datos',verified:true}]};
  const feed=rankRecommendations({userId:'me',topics,preferences:defaultRecommendationPreferences(),
    neededSubjects:[{id:'sql-id',name:'Bases de Datos'}],candidates:[person,candidate('note','note','SQL')]});
  assert.equal(feed.items[0].id,'teacher');assert.equal(feed.items[0].reason,'Tutor acreditado en Bases de Datos');
});
test('Privacidad: no se recomienda a sí mismo ni sus contenidos, ni se reintroducen ocultos o duplicados',()=>{
  const feed=rankRecommendations({userId:'me',topics,preferences:{...defaultRecommendationPreferences(),interest:['python']},
    dismissed:['note:hidden'],candidates:[candidate('me','person'),{...candidate('own'),ownerId:'me'},candidate('hidden'),candidate('ok'),candidate('ok')]});
  assert.deepEqual(feed.items.map(item=>item.id),['ok']);
});
test('Desactivar personalización usa solo novedades, no intereses ni personas',()=>{
  const feed=rankRecommendations({userId:'me',topics,preferences:{...defaultRecommendationPreferences(),personalization_enabled:false,learn:['python']},
    candidates:[candidate('old'),{...candidate('new','post','Java'),createdAt:'2026-02-01T00:00:00Z'},candidate('person','person')]});
  assert.equal(feed.mode,'disabled');assert.deepEqual(feed.items.map(item=>item.id),['new','old']);
  assert.ok(feed.items.every(item=>item.reason==='Reciente en la comunidad'&&item.topics.length===0));
});
test('Sin historial muestra novedades reales y mantiene variedad entre tipos',()=>{
  const feed=rankRecommendations({userId:'me',topics,preferences:defaultRecommendationPreferences(),limit:4,
    candidates:[...Array.from({length:8},(_,i)=>candidate('n'+i)),candidate('p','project'),candidate('x','person')]});
  assert.equal(feed.mode,'starter');assert.equal(feed.items.length,4);assert.ok(feed.items.some(item=>item.kind==='project'));
});
test('Preferencias: límites, duplicados, control de versión y campos privilegiados',()=>{
  const valid={...defaultRecommendationPreferences(),interest:['python']};
  assert.equal(recommendationPreferencesSchema.safeParse(valid).success,true);
  for(const invalid of [{...valid,user_id:'another'},{...valid,interest:['python','python']},
    {...valid,revision:-1},{...valid,learn:Array.from({length:13},(_,i)=>'topic-'+i)}]) {
    assert.equal(recommendationPreferencesSchema.safeParse(invalid).success,false);
  }
});
test('API de intereses y feedback requiere una sesión en todas las vías privadas',async()=>{
  for(const [method,path] of [['get','preferences'],['put','preferences'],['get','feed'],['post','dismissals'],['delete','dismissals']]) {
    const response=await (request(app) as any)[method]('/api/recommendations/'+path).send({});
    assert.equal(response.status,401);
  }
});
test('API usa la identidad del token y rechaza IDs de cuenta inyectados',async(t)=>{
  const owner='00000000-0000-0000-0000-000000000101';
  t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:owner}},error:null}));
  const calls:any[]=[];
  t.mock.method(recommendationService,'feed',async(...args:any[])=>{calls.push(args);return {items:[],mode:'starter'};});
  const feed=await request(app).get('/api/recommendations/feed?limit=4').set('Authorization','Bearer fixture-token');
  assert.equal(feed.status,200);assert.deepEqual(calls[0],[owner,'fixture-token',4]);
  const forged=await request(app).put('/api/recommendations/preferences').set('Authorization','Bearer fixture-token')
    .send({...defaultRecommendationPreferences(),user_id:'someone-else'});
  assert.equal(forged.status,400);
  const invalid=await request(app).get('/api/recommendations/feed?limit=500').set('Authorization','Bearer fixture-token');
  assert.equal(invalid.status,400);
});

test('Servicio del feed: usa metadatos autorizados, filtra borradores y conserva enlaces al recurso',async(t)=>{
  const calls:{table:string;method:string;args:any[]}[]=[];
  t.mock.method(recommendationService,'topics',async()=>topics);
  t.mock.method(recommendationService,'preferences',async()=>({...defaultRecommendationPreferences(),learn:['python']}));
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
    const rows=table==='academic_notes'?[{id:'note-id',author_id:'other',title:'Python',summary:'A guide',subject_name:'Python',tags:[],created_at:'2026-01-01'}]:[];
    const query:any=Promise.resolve({data:rows,error:null});
    for(const method of ['select','eq','in','or','neq','order','limit'])query[method]=(...args:any[])=>{calls.push({table,method,args});return query;};
    return query;
  });
  const feed=await recommendationService.feed('me','fixture-token');
  assert.equal(feed.items[0].href,'/resources?note=note-id');
  assert.ok(calls.some(call=>call.table==='academic_notes'&&call.method==='eq'&&call.args[0]==='is_draft'&&call.args[1]===false));
  assert.ok(calls.some(call=>call.table==='projects'&&call.method==='eq'&&call.args[0]==='visibility'&&call.args[1]==='public'));
  assert.ok(calls.some(call=>call.table==='workshop_summary'&&call.method==='or'&&call.args[0].includes('scheduled_at.gte.')));
  assert.equal(calls.some(call=>call.table==='profiles'),false);
  assert.ok(calls.filter(call=>call.method==='select').every(call=>!/(?:email|phone|learning_preferences|accessibility_preferences|content_html|file_url)/.test(call.args[0])));
});
test('Servicio del feed: un error de persistencia no se convierte en una lista vacía',async(t)=>{
  t.mock.method(recommendationService,'topics',async()=>topics);
  t.mock.method(recommendationService,'preferences',async()=>defaultRecommendationPreferences());
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
    const query:any=Promise.resolve(table==='academic_notes'?{data:null,error:{code:'PGRST205',message:'internal-table-details'}}:{data:[],error:null});
    for(const method of ['select','eq','in','or','neq','order','limit'])query[method]=()=>query;
    return query;
  });
  await assert.rejects(recommendationService.feed('me','fixture-token'),(error:any)=>error.status===503&&!error.message.includes('internal-table-details'));
});

test('Configuración pendiente: API distingue tablas faltantes de una selección vacía y oculta detalles internos',async(t)=>{
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',()=>{
    const query:any=Promise.resolve({data:null,error:{code:'PGRST205',message:'private-database-detail'}});
    for(const method of ['select','order'])query[method]=()=>query;
    return query;
  });
  const response=await request(app).get('/api/recommendations/topics');
  assert.equal(response.status,503);
  assert.equal(response.body.details.code,'RECOMMENDATIONS_NOT_READY');
  assert.match(response.body.error,/aún no están activadas/);
  assert.equal(JSON.stringify(response.body).includes('private-database-detail'),false);
});
