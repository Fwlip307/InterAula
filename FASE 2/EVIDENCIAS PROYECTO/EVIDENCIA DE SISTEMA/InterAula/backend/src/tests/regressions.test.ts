import { env } from '../config/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { app } from '../app.js';
import { persistentStore } from '../lib/persistentStore.js';
import { projectBackendService } from '../services/project.service.js';
import { profileBackendService } from '../services/profile.service.js';
import { remoteProjectService } from '../services/remote/project.service.js';
import { remoteNotesService } from '../services/remote/notes.service.js';
import { remoteLearningSpaceService } from '../services/remote/learningSpace.service.js';
import { supabasePublic, getAdminSupabase } from '../lib/supabase.js';
import { sanitizeNoteHtml, sanitizeNoteJson } from '../lib/html.js';
import { HttpError } from '../lib/httpError.js';
import { addNeededSubjectSchema } from '../schemas/profile.schema.js';
import { aiBackendService } from '../services/ai.service.js';
import { assessmentService, gradeAssessmentAnswer, grantAssessmentSchema } from '../services/assessment.service.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';

test('Proyectos privados y borradores no se exponen por detalle, vacantes o miembros',async()=>{
  persistentStore.resetForTests();
  const id='00000000-0000-0000-0000-000000009999';
  persistentStore.write(db=>{
    db.projects.push({id,owner_id:'owner',title:'Private',visibility:'private',status:'draft'} as any);
    db.project_positions.push({id:'position',project_id:id,title:'Developer',slots:1,slots_filled:0,status:'open'} as any);
    db.project_members.push({id:'member',project_id:id,profile_id:'member',member_role:'member'} as any);
  });
  for(const suffix of ['', '/positions','/members']){
    const response=await request(app).get('/api/projects/'+id+suffix);
    assert.equal(response.status,404);
    assert.equal(JSON.stringify(response.body).includes('"title":"Private"'),false);
  }
  const own=await projectBackendService.getProjectById(id,'owner');
  assert.equal(own?.id,id);
  await assert.rejects(projectBackendService.getProjectById(id,'member'),{status:404});
});

test('Materias a reforzar: contrato actual, inserción y borrado por clave compuesta',async(t)=>{
  const subject='00000000-0000-0000-0000-000000000111';
  assert.equal(addNeededSubjectSchema.safeParse({subject_id:subject,current_level:'basic',notes:'Help'}).success,true);
  assert.equal(addNeededSubjectSchema.safeParse({subject_id:subject,level:'basic'}).success,false);
  const calls:any[]=[];
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
    const builder:any={then:(resolve:any)=>Promise.resolve({data:{subject_id:subject,current_level:'basic'},error:null}).then(resolve)};
    for(const method of ['insert','delete','select','single','eq'])builder[method]=(...args:any[])=>{calls.push({table,method,args});return builder;};
    return builder;
  });
  await profileBackendService.addNeededSubject({id:'owner'},'test-token',{subject_id:subject,current_level:'basic'});
  await profileBackendService.removeNeededSubject({id:'owner'},'test-token',subject);
  assert.equal(calls.find(call=>call.method==='insert').args[0].current_level,'basic');
  assert.equal(calls.some(call=>call.method==='eq'&&call.args[0]==='subject_id'&&call.args[1]===subject),true);
  assert.equal(calls.some(call=>call.method==='eq'&&call.args[0]==='id'),false);
});

test('HTML de apuntes conserva contenido académico y elimina contenido activo',()=>{
  const unsafe='<h1>SQL</h1><p style="text-align:center;position:fixed" onclick="alert(1)">Safe <strong>text</strong></p><script>alert(1)</script><img src="https://example.invalid/image.png" onerror="alert(1)"><a href="java&#x73;cript:alert(1)">Link</a><iframe srcdoc="unsafe"></iframe>';
  const html=sanitizeNoteHtml(unsafe);
  assert.match(html,/<h1>SQL<\/h1>/);
  assert.match(html,/<strong>text<\/strong>/);
  assert.match(html,/text-align:center/);
  for(const forbidden of ['onclick','onerror','<script','javascript:','srcdoc','<iframe','position:fixed'])assert.equal(html.includes(forbidden),false,forbidden);
  const json=sanitizeNoteJson({slides:[{htmlContent:'<img src=x onerror=alert(1)>'}]});
  assert.equal(JSON.stringify(json).includes('onerror'),false);
});

test('La API de IA no permite generar ni evaluar sin sesión',async()=>{
  for(const route of ['generate-questions','generate-quiz','evaluate-answer']){
    const response=await request(app).post('/api/ai/'+route).send({question:'Question',answer:'An answer with words'});
    assert.equal(response.status,401);
  }
});

test('Una redacción larga no se convierte en una aprobación por contar palabras',async()=>{
  const answer=await aiBackendService.evaluateAnswer({question:'¿Qué es una clave primaria?',answer:'Las nubes verdes bailan lentamente mientras ocho elefantes cantan canciones azules.'});
  assert.equal(answer.passed,false);
  assert.equal(answer.evaluated,false);
  assert.equal(answer.score,0);
});

test('El intento del servidor no acepta notas o niveles inyectados y corrige respuestas concretas',()=>{
  assert.equal(grantAssessmentSchema.safeParse({attempt_id:'00000000-0000-0000-0000-000000000001',score:100,level:'advanced'}).success,false);
  const question:any={type:'redaction',acceptedAnswers:['índice']};
  assert.equal(gradeAssessmentAnswer(question,'  INDICE  '),true);
  assert.equal(gradeAssessmentAnswer(question,'un párrafo muy largo sin la respuesta correcta'),false);
  assert.equal(gradeAssessmentAnswer({type:'choice',correctOptionId:'b'} as any,'a'),false);
  assert.equal(gradeAssessmentAnswer({type:'choice',correctOptionId:'b'} as any,'b'),true);
});

test('Sin clave administrativa no se intenta acreditar con un cliente anónimo',()=>{
  assert.throws(()=>getAdminSupabase(),{status:503});
});

test('Los errores de base de datos no se convierten en guardados locales exitosos',async(t)=>{
  const failing={data:null,error:{code:'PGRST205',message:'internal_table_is_missing'}};
  const prototype=Object.getPrototypeOf(supabasePublic);
  t.mock.method(prototype,'rpc',()=>Promise.resolve(failing));
  t.mock.method(prototype,'from',()=>{
    const builder:any={then:(resolve:any)=>Promise.resolve(failing).then(resolve)};
    for(const method of ['select','insert','update','eq','single','maybeSingle','order'])builder[method]=()=>builder;
    return builder;
  });
  const before=JSON.stringify(persistentStore.read());
  await assert.rejects(remoteProjectService.createProject({id:'owner'},'token',{title:'No local success'}),{status:503});
  await assert.rejects(remoteLearningSpaceService.updateConfig('owner','token',{learningGoalSummary:'No local success'}),{status:503});
  await assert.rejects(remoteNotesService.createNote({id:'owner'},'token',{title:'No local success'}),{status:503});
  assert.equal(JSON.stringify(persistentStore.read()),before);
});

test('La cuota de solicitudes devuelve 429 y Retry-After al exceder el límite',async()=>{
  const limited=express();limited.use(createRateLimiter(2,60_000));limited.get('/',(_req,res)=>{res.json({ok:true});});
  assert.equal((await request(limited).get('/')).status,200);
  assert.equal((await request(limited).get('/')).status,200);
  const response=await request(limited).get('/');
  assert.equal(response.status,429);assert.ok(Number(response.headers['retry-after'])>0);
});

test('La respuesta de producción no revela errores internos de la base de datos',async()=>{
  const {errorHandler}=await import('../middlewares/error.middleware.js');
  const isolated=express();
  isolated.get('/',(_req,_res,next)=>next(new Error('password=secret-internal-table')));
  isolated.use(errorHandler);
  const response=await request(isolated).get('/');
  assert.equal(response.status,500);
  assert.equal(JSON.stringify(response.body).includes('secret-internal-table'),false);
  const safe=new HttpError(409,'La operación ya fue realizada.');
  assert.equal(safe.status,409);
});


test('El intento oculta soluciones, vincula propietario, evita reenvíos y calcula su nota en el servidor',async(t)=>{
  const previous=env.supabaseServiceRoleKey;
  env.supabaseServiceRoleKey='isolated-test-service-key';
  t.after(()=>{env.supabaseServiceRoleKey=previous;});
  let attempt:any=null;
  const id='00000000-0000-0000-0000-000000000991';
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
    let operation='select';let payload:any;let recent=false;const filters:Record<string,any>={};
    const builder:any={
      select:()=>builder,single:()=>builder,maybeSingle:()=>builder,
      gte:()=>{recent=true;return builder;},
      eq:(key:string,value:any)=>{filters[key]=value;return builder;},
      insert:(value:any)=>{operation='insert';payload=value;return builder;},
      update:(value:any)=>{operation='update';payload=value;return builder;},
      then:(resolve:any)=>{
        let data:any;
        if(table==='profile_offered_subjects')data={is_verified:false,subject:{name:'Programación de Algoritmos'}};
        else if(recent)data=[];
        else if(operation==='insert'){attempt={...payload,id,revision:0,updated_at:new Date().toISOString()};data={id};}
        else if(!attempt||Object.entries(filters).some(([key,value])=>attempt[key]!==value))data=null;
        else if(operation==='update'){attempt={...attempt,...payload};data={id};}
        else data=structuredClone(attempt);
        return Promise.resolve({data,error:null}).then(resolve);
      },
    };
    return builder;
  });
  const started=await assessmentService.start({id:'owner'},'token','00000000-0000-0000-0000-000000000001');
  for(const field of ['correctOptionId','acceptedAnswers','explanation'])assert.equal(JSON.stringify(started).includes(field),false);
  assert.equal(started.level,'basic');
  assert.ok(started.totalQuestions>=5);
  await assert.rejects(assessmentService.answer({id:'other'},id,{question_id:started.question.id,answer:'a'}),{status:404});
  const first=attempt.questions[0];
  const firstAnswer=first.type==='choice'?first.correctOptionId:first.acceptedAnswers[0];
  const results=await Promise.allSettled([
    assessmentService.answer({id:'owner'},id,{question_id:first.id,answer:firstAnswer}),
    assessmentService.answer({id:'owner'},id,{question_id:first.id,answer:firstAnswer}),
  ]);
  assert.equal(results.filter(response=>response.status==='fulfilled').length,1);
  assert.equal(attempt.answers.length,1);
  await assert.rejects(assessmentService.answer({id:'owner'},id,{question_id:first.id,answer:firstAnswer}),{status:409});
  attempt.expires_at=new Date(Date.now()-1000).toISOString();
  await assert.rejects(assessmentService.answer({id:'owner'},id,{question_id:attempt.questions[1].id,answer:'a'}),{status:410});
  attempt.expires_at=new Date(Date.now()+100_000).toISOString();
  let last:any;
  for(const question of attempt.questions.slice(1))last=await assessmentService.answer({id:'owner'},id,{question_id:question.id,answer:question.type==='choice'?question.correctOptionId:question.acceptedAnswers[0]});
  assert.equal(last.score,100);assert.equal(last.passed,true);assert.equal(last.finished,true);
  assert.equal(attempt.state,'passed');
});
