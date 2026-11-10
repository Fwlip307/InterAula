import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createTestPostgres } from './helpers/postgres.js';
import { postgresQuery } from './helpers/postgrest.js';
import { supabasePublic } from '../lib/supabase.js';
import { recommendationService as service } from '../services/recommendation.service.js';
import type { RecommendationPreferences } from '../services/recommendationEngine.js';
import { recommendationItemSchema } from '../schemas/recommendation.schema.js';

const sqlRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase');
const seedName='interaula-demo-interests-v1';
const demoId=(part:string)=>{const hex=createHash('md5').update(seedName+':'+part).digest('hex');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);};
const owner='00000000-0000-0000-0000-000000008001';
const other='00000000-0000-0000-0000-000000008002';

test('Datos DEMO: cada interés y los escenarios de privacidad, feedback y limpieza',async(t)=>{
  const db=await createTestPostgres();
  try {
    for(const file of (await fs.readdir(path.join(sqlRoot,'migrations'))).filter(file=>file.endsWith('.sql')).sort())
      await db.exec(await fs.readFile(path.join(sqlRoot,'migrations',file),'utf8'));
    const seed=await fs.readFile(path.join(sqlRoot,'DATOS_PRUEBA_INTERESES.sql'),'utf8');
    const cleanup=await fs.readFile(path.join(sqlRoot,'RETIRAR_DATOS_PRUEBA_INTERESES.sql'),'utf8');
    const as=async(userId?:string)=>{
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[userId||'',userId?'authenticated':'']);
      if(userId)await db.exec('SET ROLE authenticated');
    };
    for(const id of [owner,other])await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,id+'@real-test.example']);
    await as(owner);
    const beforeDocument={revision:0,personalization_enabled:true,discoverable:false,interest:['statistics','physics','data-science','machine-learning'],learn:[],teach:[]};
    await db.query('SELECT public.save_recommendation_preferences($1)',[JSON.stringify(beforeDocument)]);
    await as();
    await db.exec(seed);
    await db.exec(seed); // Idempotence: no duplicate seats, profiles or content.
    const topics:any[]=(await db.query('SELECT * FROM public.recommendation_topics ORDER BY id')).rows;
    assert.equal(topics.length,22);
    assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'=$1",[seedName])).rows[0].n,topics.length*3+2);
    assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM public.academic_notes WHERE $1=ANY(tags)",[seedName])).rows[0].n,topics.length*4+1);
    assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM public.workshop_enrollments WHERE student_id IN ($1,$2)",[demoId('seat:a'),demoId('seat:b')])).rows[0].n,44);
    assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM public.academic_validators WHERE profile_id IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'=$1)",[seedName])).rows[0].n,0);
    assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM public.profile_offered_subjects WHERE is_verified AND profile_id IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'=$1)",[seedName])).rows[0].n,0);
    await as(owner);
    const original:any=(await db.query('SELECT public.get_recommendation_preferences() AS document')).rows[0];
    assert.deepEqual(original.document.interest,[...beforeDocument.interest].sort());
    await db.query("INSERT INTO public.academic_notes(id,author_id,title,tags,visibility) VALUES($1,$2,'Apunte propio de Python',ARRAY['python'],'public')",[owner,owner]);

    t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>postgresQuery(db,table));
    t.mock.method(Object.getPrototypeOf(supabasePublic),'rpc',async(name:string,args:any={})=>{
      try {
        if(!['get_recommendation_preferences','save_recommendation_preferences'].includes(name))throw Error('Unexpected RPC '+name);
        const query=name==='get_recommendation_preferences'?'SELECT public.get_recommendation_preferences() AS document':'SELECT public.save_recommendation_preferences($1) AS document';
        const response=await db.query<any>(query,name==='get_recommendation_preferences'?[]:[JSON.stringify(args.p_document)]);
        return {data:response.rows[0].document,error:null};
      }catch(error:any){return {data:null,error:{code:error.code,message:error.message}};}
    });
    const save=async(values:Partial<RecommendationPreferences>)=>{
      const current=await service.preferences('fixture-token');
      return service.savePreferences('fixture-token',{...current,interest:[],learn:[],teach:[],personalization_enabled:true,...values});
    };
    for(const topic of topics)await t.test(topic.name,async()=>{
      await save({interest:[topic.id]});
      const feed=await service.feed(owner,'fixture-token',30);
      assert.equal(feed.mode,'personalized');assert.ok(feed.items.length>=7,topic.name+' has content and people');
      assert.ok(['note','post','project','workshop','person'].every(kind=>feed.items.some(item=>item.kind===kind)));
      assert.ok(feed.items.every(item=>item.topics.includes(topic.name)),topic.name+' only matching interests');
      const allowed=new Set(['note-public:','note-shared:','post:','project-public:','workshop-available:','teach:','learn:'].map(prefix=>demoId(prefix+topic.id)));
      if(['python','data-science'].includes(topic.id))allowed.add(demoId('note-cross:python-data-science'));
      assert.ok(feed.items.every(item=>allowed.has(item.id)),topic.name+' excludes own content and unrelated topics');
      assert.ok(feed.items.every(item=>recommendationItemSchema.safeParse({kind:item.kind,id:item.id}).success));
      assert.ok(feed.items.every(item=>!item.title.includes('NO RECOMENDAR')&&!item.title.includes('Temas ocultos')));
      assert.ok(feed.items.every(item=>!item.reason.includes('Tutor acreditado')));
    });
    await t.test('Combinación actual: estadística, física, datos e IA',async()=>{
      const ids=beforeDocument.interest;
      await save({interest:ids});
      const feed=await service.feed(owner,'fixture-token',30);
      assert.equal(feed.items.length,29);
      const names=topics.filter(topic=>ids.includes(topic.id)).map(topic=>topic.name);
      assert.ok(feed.items.every(item=>item.topics.some(topic=>names.includes(topic))));
      assert.ok(names.every(name=>feed.items.some(item=>item.topics.includes(name))));
    });
    await t.test('Dos temas: el material combinado coincide con ambos',async()=>{
      await save({interest:['python','data-science']});
      const feed=await service.feed(owner,'fixture-token',30);
      const combined=feed.items.find(item=>item.id===demoId('note-cross:python-data-science'));
      assert.deepEqual(new Set(combined?.topics),new Set(['Python','Análisis de datos']));
      assert.equal(feed.items.filter(item=>item.kind==='note')[0].id,combined?.id);
    });
    await t.test('Aprender y compartir recomiendan personas complementarias',async()=>{
      await save({learn:['python']});
      let feed=await service.feed(owner,'fixture-token',30);
      assert.equal(feed.items[0].id,demoId('teach:python'));
      assert.match(feed.items[0].reason,/Comparte conocimientos/);
      await save({teach:['python']});feed=await service.feed(owner,'fixture-token',30);
      assert.equal(feed.items[0].id,demoId('learn:python'));
      assert.match(feed.items[0].reason,/Quiere aprender/);
    });
    await t.test('No me interesa se conserva por cuenta y se puede deshacer',async()=>{
      await save({interest:['python']});
      const noteId=demoId('note-public:python');
      await service.dismiss(owner,'fixture-token','note',noteId);
      assert.equal((await service.feed(owner,'fixture-token',30)).items.some(item=>item.id===noteId),false);
      await as(other);await save({interest:['python']});
      assert.equal((await service.feed(other,'fixture-token',30)).items.some(item=>item.id===noteId),true);
      await as(owner);await service.restore(owner,'fixture-token','note',noteId);
      assert.equal((await service.feed(owner,'fixture-token',30)).items.some(item=>item.id===noteId),true);
    });
    await t.test('Sin intereses y personalización desactivada muestran novedades sin personas',async()=>{
      await save({});let feed=await service.feed(owner,'fixture-token',30);
      assert.equal(feed.mode,'starter');assert.ok(feed.items.length>0);assert.ok(feed.items.every(item=>item.kind!=='person'));
      await save({interest:['python'],personalization_enabled:false});feed=await service.feed(owner,'fixture-token',30);
      assert.equal(feed.mode,'disabled');assert.ok(feed.items.every(item=>item.topics.length===0&&item.reason==='Reciente en la comunidad'));
    });
    await t.test('Visibilidad de controles y retiro preservan preferencias y datos reales',async()=>{
      for(const state of ['private','draft'])assert.equal((await db.query('SELECT id FROM public.academic_notes WHERE id=$1',[demoId('note-'+state+':python')])).rows.length,0);
      assert.equal((await db.query('SELECT * FROM public.discoverable_topic_interests WHERE user_id=$1',[demoId('hidden:python')])).rows.length,0);
      await db.query("INSERT INTO public.profile_needed_subjects(profile_id,subject_id,current_level) VALUES($1,$2,'basic')",[owner,demoId('subject:statistics')]);
      await service.dismiss(owner,'fixture-token','note',demoId('note-public:python'));
      await db.query("INSERT INTO public.recommendation_dismissals(user_id,kind,item_id) VALUES($1,'note',$2)",[owner,owner]);
      const before=await service.preferences('fixture-token');
      await as();
      await db.query('INSERT INTO auth.identities(user_id) VALUES($1)',[demoId('teach:python')]);
      await assert.rejects(db.exec(cleanup),/identidad de acceso/);await db.exec('ROLLBACK');
      assert.equal((await db.query('SELECT id FROM auth.users WHERE id=$1',[demoId('teach:python')])).rows.length,1);
      await db.query('DELETE FROM auth.identities WHERE user_id=$1',[demoId('teach:python')]);
      await db.exec(cleanup);await db.exec(cleanup);
      assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'=$1",[seedName])).rows[0].n,0);
      assert.equal((await db.query('SELECT id FROM public.academic_notes WHERE id=$1',[owner])).rows.length,1);
      assert.equal((await db.query('SELECT id FROM public.subjects WHERE id=$1',[demoId('subject:statistics')])).rows.length,1);
      assert.equal((await db.query('SELECT item_id FROM public.recommendation_dismissals WHERE item_id=$1',[demoId('note-public:python')])).rows.length,0);
      assert.equal((await db.query('SELECT item_id FROM public.recommendation_dismissals WHERE item_id=$1',[owner])).rows.length,1);
      await as(owner);assert.deepEqual(await service.preferences('fixture-token'),before);
    });
    await t.test('Una colisión con una cuenta ajena revierte toda la carga',async()=>{
      await as();
      const collision=demoId('teach:java');
      await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'collision@real-test.example','{}')",[collision]);
      await assert.rejects(db.exec(seed),/ocupado por otra cuenta/);await db.exec('ROLLBACK');
      assert.equal((await db.query<any>('SELECT email FROM auth.users WHERE id=$1',[collision])).rows[0].email,'collision@real-test.example');
      assert.equal((await db.query<any>("SELECT count(*)::integer AS n FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'=$1",[seedName])).rows[0].n,0);
    });
  } finally {await db.close();}
});
