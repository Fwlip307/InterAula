import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {env} from '../config/env.js';
import {supabasePublic} from '../lib/supabase.js';
import {assessmentService,startAssessmentSchema,answerAssessmentSchema} from '../services/assessment.service.js';
import {aiBackendService,type ChallengeQuestionDTO} from '../services/ai.service.js';
import {accreditationQuestionSchema,buildAccreditationQuestions,repeatsRecentQuestion} from '../services/accreditationQuestions.service.js';
import {assessmentCatalog} from '../data/assessmentCatalog.js';

function fixture(t:TestContext) {
  const previous=env.supabaseServiceRoleKey;env.supabaseServiceRoleKey='isolated-server-key';t.after(()=>{env.supabaseServiceRoleKey=previous;});
  const subjectId='00000000-0000-0000-0000-000000000801';
  const tables:Record<string,any[]>={subjects:[{id:subjectId,name:'Asignatura de prueba'}],profile_offered_subjects:[{profile_id:'owner',subject_id:subjectId,is_verified:false}],tutor_assessment_attempts:[]};
  t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
    let action='select',payload:any,single=false;const filters:Record<string,any>={};let since:string|undefined;
    const query:any={
      select:()=>query,order:()=>query,limit:()=>query,single:()=>{single=true;return query;},maybeSingle:()=>{single=true;return query;},
      eq:(key:string,value:any)=>{filters[key]=value;return query;},gte:(_key:string,value:string)=>{since=value;return query;},
      insert:(value:any)=>{action='insert';payload=value;return query;},update:(value:any)=>{action='update';payload=value;return query;},
      then:(resolve:any)=>{
        const data=tables[table]||(tables[table]=[]);
        let rows=data.filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value)&&(!since||Date.parse(row.created_at)>=Date.parse(since)));
        if(action==='insert'){const row={id:crypto.randomUUID(),revision:0,score:0,created_at:new Date().toISOString(),...payload};data.push(row);rows=[row];}
        if(action==='update')rows.forEach(row=>Object.assign(row,payload));
        return Promise.resolve({data:structuredClone(single?(rows[0]||null):rows),error:null}).then(resolve);
      },
    };return query;
  });
  const questions:ChallengeQuestionDTO[]=Array.from({length:5},(_,i)=>({id:'q'+i,subject:'Asignatura de prueba',type:'choice',category:'conceptual',prompt:'Pregunta conceptual '+i,options:[{id:'a',text:'Correcta'},{id:'b',text:'Incorrecta'}],correctOptionId:'a',explanation:'Explicación reservada para después de responder.'}));
  let variant=0;
  t.mock.method(aiBackendService,'getAccreditationQuestions',()=>{variant++;return questions.map(q=>({...q,prompt:q.prompt+' variante '+variant}));});
  return {subjectId,tables,questions,attempt:()=>tables.tutor_assessment_attempts[0]};
}
test('Acreditación: las 1.000 materias tienen identificadores válidos y no se aceptan notas del cliente',()=>{
  assert.equal(assessmentCatalog.length,1000);
  assert.equal(new Set(assessmentCatalog.map(s=>s.id)).size,1000);
  for(const subject of assessmentCatalog)assert.equal(startAssessmentSchema.safeParse({catalog_subject_id:subject.id,time_mode:'extended'}).success,true);
  assert.equal(startAssessmentSchema.safeParse({subject_id:crypto.randomUUID(),catalog_subject_id:'otra'}).success,false);
  assert.equal(startAssessmentSchema.safeParse({subject_id:crypto.randomUUID(),score:100}).success,false);
  assert.equal(answerAssessmentSchema.safeParse({question_id:crypto.randomUUID(),answer:'a',correct:true}).success,false);
});
test('Plazo de servidor, reanudación, tiempo extendido y siguiente pregunta sin reiniciar el reloj',async(t)=>{
  const f=fixture(t);const before=Date.now();
  const opened=await assessmentService.start({id:'owner'},'fixture',f.subjectId,{timeMode:'extended'});
  assert.equal(opened.question.timeLimitSeconds,40);
  assert.ok(Date.parse(opened.questionExpiresAt)-before>=39_000);
  for(const secret of ['correctOptionId','acceptedAnswers','explanation','integrity_events'])assert.equal(JSON.stringify(opened).includes(secret),false);
  const resumed=await assessmentService.get({id:'owner'},opened.id);assert.equal(resumed.questionExpiresAt,opened.questionExpiresAt);
  const same=await assessmentService.next({id:'owner'},opened.id);assert.equal(same.questionExpiresAt,opened.questionExpiresAt);
  await assert.rejects(assessmentService.get({id:'other'},opened.id),{status:404});
  f.attempt().question_deadline=new Date(Date.now()-1000).toISOString();
  const late=await assessmentService.answer({id:'owner'},opened.id,{question_id:opened.question.id,answer:'a'});
  assert.equal(late.correct,false);assert.equal(f.attempt().answers[0].timed_out,true);
  const nextId=f.attempt().questions[1].id;
  await assert.rejects(assessmentService.answer({id:'owner'},opened.id,{question_id:nextId,answer:'a'}),{status:409});
  f.attempt().answers.at(-1).answered_at=new Date(Date.now()-11_000).toISOString();
  assert.equal(late.finished,true);assert.equal(late.passed,false);
  assert.equal(late.terminationReason,'time_expired');
  await assert.rejects(assessmentService.next({id:'owner'},opened.id),{status:409});
});
test('Incidencias: deduplicación, un solo episodio, tres salidas invalidan y no se puede acreditar',async(t)=>{
  const f=fixture(t);const opened=await assessmentService.start({id:'owner'},'fixture',f.subjectId);
  const id=crypto.randomUUID();
  assert.equal((await assessmentService.event({id:'owner'},opened.id,{event_id:id,type:'window_blur'})).integrityCount,1);
  assert.equal((await assessmentService.event({id:'owner'},opened.id,{event_id:id,type:'window_blur'})).integrityCount,1);
  assert.equal((await assessmentService.event({id:'owner'},opened.id,{event_id:crypto.randomUUID(),type:'visibility_hidden'})).integrityCount,1);
  for(let count=2;count<=3;count++) {
    f.attempt().integrity_events.at(-1).recorded_at=new Date(Date.now()-3000).toISOString();
    const state=await assessmentService.event({id:'owner'},opened.id,{event_id:crypto.randomUUID(),type:'fullscreen_exit'});
    assert.equal(state.integrityCount,count);
  }
  assert.equal(f.attempt().state,'failed');
  await assert.rejects(assessmentService.grant({id:'owner'},opened.id),{status:409});
  await assert.rejects(assessmentService.answer({id:'owner'},opened.id,{question_id:opened.question.id,answer:'a'}),{status:409});
});

test('El primer error termina el intento en el servidor, no revela la solución y no permite continuar ni acreditar',async(t)=>{
  const f=fixture(t),opened=await assessmentService.start({id:'owner'},'fixture',f.subjectId);
  assert.equal(opened.failFast,true);assert.equal(opened.passingScore,100);
  const wrong=await assessmentService.answer({id:'owner'},opened.id,{question_id:opened.question.id,answer:'b'});
  assert.equal(wrong.finished,true);assert.equal(wrong.passed,false);assert.equal(wrong.nextQuestion,null);
  assert.equal(wrong.terminationReason,'incorrect_answer');assert.equal(f.attempt().state,'failed');
  assert.equal(wrong.feedback.includes('Explicación reservada'),false);
  await assert.rejects(assessmentService.next({id:'owner'},opened.id),{status:409});
  await assert.rejects(assessmentService.answer({id:'owner'},opened.id,{question_id:f.attempt().questions[1].id,answer:'a'}),{status:409});
  await assert.rejects(assessmentService.grant({id:'owner'},opened.id),{status:409});
  const recovered=await assessmentService.get({id:'owner'},opened.id);
  assert.equal(recovered.question,null);assert.equal(recovered.terminationReason,'incorrect_answer');
  const restarted=await assessmentService.start({id:'owner'},'fixture',f.subjectId);
  assert.notEqual(restarted.id,opened.id);assert.notEqual(restarted.question.prompt,opened.question.prompt);
});

test('La ausencia de IA nunca reutiliza un banco agotado, y la comparación ignora tildes y puntuación',async(t)=>{
  const f=fixture(t);const first=await assessmentService.start({id:'owner'},'fixture',f.subjectId);
  assert.ok(first.question);
  assert.equal(repeatsRecentQuestion({prompt:'¿Qué es una función?'},[{prompt:'Que es una funcion'}]),true);
  t.mock.method(aiBackendService,'getAccreditationQuestions',()=>f.attempt().questions);
  await assert.rejects(buildAccreditationQuestions('Asignatura de prueba',undefined,f.attempt().questions),{status:503});
});

test('Alternativas 20s y desarrollo breve 40s; el tiempo extendido duplica ambos y los intentos anteriores conservan sus plazos',async(t)=>{
  const f=fixture(t);
  f.questions[1]={...f.questions[1],type:'redaction',options:undefined,correctOptionId:undefined,acceptedAnswers:['concepto']};
  const opened=await assessmentService.start({id:'owner'},'fixture',f.subjectId);
  assert.equal(opened.question.timeLimitSeconds,20);
  assert.ok(Date.parse(opened.questionExpiresAt)-Date.now()<=20_000);
  await assessmentService.answer({id:'owner'},opened.id,{question_id:opened.question.id,answer:'a'});
  f.attempt().answers.at(-1).answered_at=new Date(Date.now()-11_000).toISOString();
  const short=await assessmentService.next({id:'owner'},opened.id);
  assert.equal(short.question.type,'redaction');assert.equal(short.question.timeLimitSeconds,40);
  const deadline=short.questionExpiresAt;
  assert.equal((await assessmentService.get({id:'owner'},opened.id)).questionExpiresAt,deadline);
  const extended=await assessmentService.start({id:'owner'},'fixture',f.subjectId,{timeMode:'extended'});
  await assessmentService.answer({id:'owner'},extended.id,{question_id:extended.question.id,answer:'a'});
  f.tables.tutor_assessment_attempts[1].answers.at(-1).answered_at=new Date(Date.now()-11_000).toISOString();
  const extendedShort=await assessmentService.next({id:'owner'},extended.id);
  assert.equal(extendedShort.question.timeLimitSeconds,80);
  const old=f.tables.tutor_assessment_attempts[1];old.policy_version=2;old.question_deadline=null;
  const legacy=await assessmentService.next({id:'owner'},extended.id);
  assert.equal(legacy.question.timeLimitSeconds,180);
});
test('Otra materia del catálogo se registra sin acreditarla; la nota completa la calcula el servidor',async(t)=>{
  const f=fixture(t);const subject=assessmentCatalog.find(s=>s.name.toLowerCase().includes('marketing'))!;
  const opened=await assessmentService.start({id:'owner'},'fixture',undefined,{catalogSubjectId:subject.id});
  assert.equal(opened.subjectName,subject.name);
  assert.ok(f.tables.profile_offered_subjects.some(row=>row.subject_id===opened.subjectId&&row.profile_id==='owner'&&row.is_verified===false));
  let last:any;
  for(const question of f.attempt().questions){if(f.attempt().answers.length)f.attempt().answers.at(-1).answered_at=new Date(Date.now()-11_000).toISOString();await assessmentService.next({id:'owner'},opened.id);last=await assessmentService.answer({id:'owner'},opened.id,{question_id:question.id,answer:question.correctOptionId});}
  assert.equal(last.score,100);assert.equal(f.attempt().state,'passed');
  await assert.rejects(assessmentService.answer({id:'owner'},opened.id,{question_id:opened.question.id,answer:'a'}),{status:409});
});
test('Abandonar impide continuar, y un cuerpo de IA mal formado nunca se usa para acreditar',async(t)=>{
  const f=fixture(t);const opened=await assessmentService.start({id:'owner'},'fixture',f.subjectId);
  const abandoned=await assessmentService.event({id:'owner'},opened.id,{event_id:crypto.randomUUID(),type:'abandon'});
  assert.equal(abandoned.state,'failed');await assert.rejects(assessmentService.grant({id:'owner'},opened.id),{status:409});
  assert.equal(accreditationQuestionSchema.safeParse([{prompt:'Tema genérico',options:[],correctOptionId:'a',explanation:'No válida'}]).success,false);
});

test('La pausa del servidor dura 5s o 10s: no revela la siguiente pregunta y recargar no la reinicia',async(t)=>{
  const f=fixture(t);
  for(const timeMode of ['standard','extended'] as const) {
    const opened=await assessmentService.start({id:'owner'},'fixture',f.subjectId,{timeMode});
    const response=await assessmentService.answer({id:'owner'},opened.id,{question_id:opened.question.id,answer:'a'});
    const expected=timeMode==='extended'?10:5;
    assert.equal(response.pauseSeconds,expected);assert.equal(response.nextQuestion,null);
    assert.ok(Date.parse(response.pauseEndsAt)-Date.parse(response.serverNow)>=expected*1000-100);
    await assert.rejects(assessmentService.next({id:'owner'},opened.id),{status:409});
    const recovered=await assessmentService.get({id:'owner'},opened.id);
    assert.equal(recovered.question,null);assert.equal(recovered.pauseEndsAt,response.pauseEndsAt);
    const row=f.tables.tutor_assessment_attempts.find(attempt=>attempt.id===opened.id);
    row.answers.at(-1).answered_at=new Date(Date.now()-11_000).toISOString();
    const next=await assessmentService.next({id:'owner'},opened.id);
    assert.ok(next.question);assert.equal(next.answered,1);
    assert.equal((await assessmentService.get({id:'owner'},opened.id)).pauseEndsAt,null);
  }
});
test('Una materia no informática usa Google sin respaldos genéricos ni claves en la URL',async(t)=>{
  const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='isolated-google-key';
  t.after(()=>{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;});
  t.mock.method(aiBackendService,'getAccreditationQuestions',()=>Array.from({length:5},(_,i)=>({prompt:'Banco revisado '+i} as ChallengeQuestionDTO)));
  t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{
    assert.equal(String(url).includes('isolated-google-key'),false);
    assert.equal(options.headers['x-goog-api-key'],'isolated-google-key');
    assert.ok(JSON.parse(options.body).contents[0].parts[0].text.includes('Marketing Digital'));
    const rows=Array.from({length:10},(_,i)=>({prompt:'Concepto de marketing número '+i+' para comprobar el contrato',options:[{id:'a',text:'Opción A'},{id:'b',text:'Opción B'},{id:'c',text:'Opción C'},{id:'d',text:'Opción D'}],correctOptionId:'b',explanation:'Explicación de prueba para el contrato del servidor.'}));
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(rows)}]}}]})} as Response;
  });
  const generated=await buildAccreditationQuestions('Marketing Digital');
  assert.equal(generated.source,'generated');assert.equal(generated.questions.length,10);
  assert.ok(generated.questions.every(q=>q.subject==='Marketing Digital'&&q.options?.some(o=>o.id===q.correctOptionId)));
});

test('La generación rechaza un examen repetido, pide una segunda variante y falla si ambas repiten',async(t)=>{
  const previousKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='isolated-google-key';
  t.after(()=>{if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;});
  const rows=(prefix:string)=>Array.from({length:10},(_,i)=>({prompt:prefix+' '+i,options:[{id:'a',text:'A'},{id:'b',text:'B'},{id:'c',text:'C'},{id:'d',text:'D'}],correctOptionId:'b',explanation:'Explicación de la respuesta de prueba.'}));
  const old=rows('Pregunta anterior de segmentación de mercado número');
  const fresh=rows('Ejercicio nuevo sobre precio de productos en escenario');
  let calls=0,alwaysRepeat=false;const variants:string[]=[];
  t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>{
    calls++;variants.push(JSON.parse(options.body).contents[0].parts[0].text);
    const repeated=alwaysRepeat||calls===1;
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(repeated?old:fresh)}]}}]})} as Response;
  });
  const generated=await buildAccreditationQuestions('Marketing Digital',undefined,old);
  assert.equal(calls,2);assert.equal(generated.source,'generated');
  assert.ok(generated.questions.every(q=>!repeatsRecentQuestion(q,old)));
  assert.notEqual(variants[0],variants[1]);assert.ok(variants[0].includes(old[0].prompt));
  alwaysRepeat=true;calls=0;
  await assert.rejects(buildAccreditationQuestions('Marketing Digital',undefined,old),{status:503});
  assert.equal(calls,2);
});
