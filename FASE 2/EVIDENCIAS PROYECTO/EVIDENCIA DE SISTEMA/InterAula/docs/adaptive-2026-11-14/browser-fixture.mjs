import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {MODEL,initialMastery,bktUpdate,publicMastery,recommendNext} from '../../backend/src/services/adaptiveEngine.ts';
import {createPracticeExercise,COURSE_ID} from '../../backend/src/data/adaptiveCurriculum.ts';
const root=process.argv[2],out=path.join(root,'docs/adaptive-2026-11-14');fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function snapshot(records=[],goalId='chain',activeExercise=null){return {ready:true,course:{id:COURSE_ID,name:'Cálculo: de álgebra a derivadas',pilot:true,contentStatus:'Piloto editorial'},model:MODEL,goalId,skills:publicMastery(records,goalId),recommendation:recommendNext(records,goalId),activeExercise,metrics:null,answeredCount:records.reduce((sum,r)=>sum+r.attempts,0)};}
const weak={...initialMastery('chain'),attempts:1,last_correct:false,mastery:bktUpdate(.2,false).posterior,updated_at:new Date().toISOString()};
const afterHint={...initialMastery('equations'),attempts:1,correct_count:1,last_correct:false,updated_at:new Date().toISOString()};
const independent={...afterHint,attempts:2,correct_count:2,mastery:bktUpdate(.2,true).posterior,last_correct:true,independent_correct_ids:['equations-2'],updated_at:new Date().toISOString()};
const questions=[createPracticeExercise('chain'),createPracticeExercise('equations'),createPracticeExercise('equations',['equations-1']),createPracticeExercise('equations',['equations-1','equations-2'])];
const publicQuestion=q=>({attemptId:q.id,skillId:q.skillId,templateId:q.templateId,prompt:q.prompt,options:q.options,hintUsed:false});
const data={initial:snapshot(),weak:snapshot([weak]),hinted:snapshot([weak,afterHint]),independent:snapshot([weak,independent]),questions:questions.map(publicQuestion),solutions:questions.map(q=>({id:q.id,answer:q.correctOptionId,explanation:q.explanation,hint:q.hint})),demo:{label:'Simulación: no modifica tu progreso',before:snapshot(),after:snapshot([weak]),examplePrerequisite:'Ecuaciones lineales'}};
const targets=await fetch('http://127.0.0.1:9235/json/list').then(r=>r.json()),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.onopen=resolve);
let seq=0;const pending=new Map(),exceptions=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',userGesture:true,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const text=()=>ev(()=>document.querySelector('#adaptive-review')?.innerText||'');
const click=async label=>{await ev(label=>{const b=[...document.querySelectorAll('#adaptive-review button')].find(b=>b.textContent.includes(label));if(!b)throw Error('Missing button '+label);b.click();},label);await sleep(160);};
try{
 await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await sleep(1400);
 await ev(async fixtures=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name),R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u))),router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D,{default:Panel}=await import('/src/pages/learning/components/AdaptiveLearningPanel.tsx'),{adaptiveLearningService:service}=await import('/src/services/adaptiveLearning.service.ts');
  document.getElementById('root').style.display='none';const mount=document.createElement('div');mount.id='adaptive-review';mount.style.cssText='max-width:1200px;margin:24px auto;padding:16px;box-sizing:border-box;width:100%';document.body.append(mount);const tree=dom.createRoot(mount);
  const a=window.__adaptive={user:'owner',open:true,state:structuredClone(fixtures.initial),fixtures,pending:null,startCount:0,answerCount:0,failAnswer:false,failLoad:false,failGoal:false,goalCalls:0,hintUsed:false,answeredIds:[]};
  service.overview=async()=>{if(a.failLoad)throw Error('No se pudo consultar tu progreso.');return structuredClone({...a.state,activeExercise:a.pending});};
  service.start=async()=>{if(a.pending)return structuredClone(a.pending);a.pending=structuredClone(fixtures.questions[a.startCount++%fixtures.questions.length]);return structuredClone(a.pending);};
  service.hint=async()=>{a.hintUsed=true;a.pending.hintUsed=true;a.pending.hint=fixtures.solutions.find(q=>q.id===a.pending.attemptId).hint;return {hint:a.pending.hint};};
  service.answer=async(id,answer)=>{
   if(a.failAnswer)throw Error('No se pudo guardar. Reintenta.');
   const solution=fixtures.solutions.find(q=>q.id===id),hinted=a.pending?.hintUsed||false;
   if(!a.answeredIds.includes(id)){a.answerCount++;a.answeredIds.push(id);}
   const previous=a.state.skills.find(s=>s.id===a.pending.skillId),skillId=a.pending.skillId;
   if(answer==='skip')a.state=structuredClone(fixtures.weak);else if(hinted)a.state=structuredClone(fixtures.hinted);else a.state=structuredClone(fixtures.independent);
   a.pending=null;
   return {feedback:{attemptId:id,skillId,correct:answer===solution.answer,feedback:solution.explanation,correctOptionId:solution.answer,hintUsed:hinted,skipped:answer==='skip',masteryBefore:previous.mastery??.2,masteryAfter:a.state.skills.find(s=>s.id===skillId).mastery,predictedCorrect:.38,distinctIndependentCorrect:hinted?0:1,modelVersion:fixtures.initial.model.version},overview:structuredClone(a.state)};
  };
  service.goal=async goal=>{if(a.failGoal)throw Error('No pudimos cambiar el objetivo.');a.goalCalls++;a.state.goalId=goal;return structuredClone(a.state);};
  service.demo=async()=>structuredClone(fixtures.demo);
  window.__renderAdaptive=()=>tree.render(a.open?React.createElement(router.MemoryRouter,null,React.createElement(React.StrictMode,null,React.createElement(Panel,{key:a.user,userId:a.user}))):null);
  window.__renderAdaptive();
 },data);await sleep(300);
 assert.match(await text(),/Tu siguiente paso tiene un porqué/);assert.equal(await ev(()=>document.querySelectorAll('.ia-adaptive-node').length),10);
 assert.match(await text(),/No hay evidencia previa/);
 await click('Ver simulación del motor');assert.match(await text(),/Después · dificultad/);
 assert.equal(await ev(()=>window.__adaptive.answerCount),0);assert.equal(await ev(()=>window.__adaptive.state.answeredCount),0);
 checks.push('Real knowledge map contains ten nodes; simulation uses production engine outputs and never changes personal progress');
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'adaptive-desktop.png'),Buffer.from(shot.data,'base64'));
 await click('Practicar este concepto');assert.equal(await ev(()=>document.querySelector('#adaptive-goal').disabled),true);
 assert.equal(await ev(()=>document.querySelectorAll('[role=timer]').length),0);
 const initialAttempt=await ev(()=>window.__adaptive.pending.attemptId);
 await click('No lo sé todavía');
 assert.match(await text(),/Vamos a reforzarlo/);assert.equal(await ev(()=>window.__adaptive.state.recommendation.skillId),data.weak.recommendation.skillId);
 assert.equal(await ev(()=>window.__adaptive.answerCount),1);
 checks.push('Untimed practice accepts uncertainty, stores one response and changes next step to prerequisite');
 await click('Continuar con el siguiente paso');await click('Necesito una pista');
 assert.equal(await ev(()=>!!document.querySelector('.ia-adaptive-hint')),true);
 assert.equal(await ev(()=>document.querySelector('.ia-adaptive-goal select').disabled),true);
 await ev(()=>{const input=[...document.querySelectorAll('input[name=adaptive-answer]')].find(e=>e.value===window.__adaptive.fixtures.solutions.find(q=>q.id===window.__adaptive.pending.attemptId).answer);input.click();window.__adaptive.failAnswer=true;});
 await click('Comprobar respuesta');assert.match(await text(),/No se pudo guardar/);
 assert.equal(await ev(()=>!!document.querySelector('input[name=adaptive-answer]:checked')),true);
 assert.equal(await ev(()=>window.__adaptive.answerCount),1);
 await ev(()=>window.__adaptive.failAnswer=false);await click('Comprobar respuesta');
 assert.equal(await ev(()=>window.__adaptive.answerCount),2);
 assert.equal(await ev(()=>window.__adaptive.state.skills.find(s=>s.id==='equations').mastery),.2);
 assert.equal(await ev(()=>window.__adaptive.state.skills.find(s=>s.id==='equations').distinctIndependentCorrect),0);
 checks.push('Hinted response is accompanied practice; failed write preserves selection and retry does not fabricate progress');
 await click('Continuar con el siguiente paso');const resumed=await ev(()=>window.__adaptive.pending.attemptId);
 await ev(()=>{window.__adaptive.open=false;window.__renderAdaptive();});await sleep(100);
 await ev(()=>{window.__adaptive.open=true;window.__renderAdaptive();});await sleep(220);
 assert.equal(await ev(()=>window.__adaptive.pending.attemptId),resumed);assert.notEqual(resumed,initialAttempt);
 assert.equal(await ev(()=>document.querySelectorAll('input[name=adaptive-answer]').length),4);
 checks.push('Remount resumes the same pending attempt; it does not create a second exercise');
 await ev(()=>{document.querySelectorAll('.ia-adaptive-practice-top input')[0].click();});await sleep(80);
 assert.equal(await ev(()=>document.querySelector('.ia-adaptive').dataset.largeText),'true');
 await ev(()=>{[...document.querySelectorAll('input[name=adaptive-answer]')].find(e=>e.value===window.__adaptive.fixtures.solutions.find(q=>q.id===window.__adaptive.pending.attemptId).answer).click();});
 await click('Comprobar respuesta');assert.match(await text(),/Buen paso/);
 assert.equal(await ev(()=>window.__adaptive.state.skills.find(s=>s.id==='equations').distinctIndependentCorrect),1);
 await ev(()=>{const e=document.querySelector('#adaptive-goal');window.__adaptive.failGoal=true;e.value='limits';e.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(160);
 assert.match(await text(),/No pudimos cambiar el objetivo/);assert.equal(await ev(()=>document.querySelector('#adaptive-goal').value),'chain');
 checks.push('Readable text option, independent evidence and failed goal update preserve server state');
 await ev(()=>{window.__adaptive.user='other';window.__adaptive.state=structuredClone(window.__adaptive.fixtures.initial);window.__adaptive.pending=null;window.__renderAdaptive();});await sleep(220);
 assert.equal(await ev(()=>window.__adaptive.state.answeredCount),0);assert.equal(await ev(()=>!!document.querySelector('.ia-adaptive-practice')),false);
 await ev(()=>{window.__adaptive.failLoad=true;});await click('Ver simulación del motor');
 await click('Cerrar simulación');
 await ev(()=>{window.__adaptive.failLoad=true;});await ev(()=>{window.__adaptive.open=false;window.__renderAdaptive();});await sleep(80);
 await ev(()=>{window.__adaptive.open=true;window.__renderAdaptive();});await sleep(180);
 assert.match(await text(),/No se pudo consultar/);
 await ev(()=>window.__adaptive.failLoad=false);await click('Recuperar mi progreso');
 assert.match(await text(),/Tu siguiente paso/);
 checks.push('Account separation and recovery after failed load; no silent local fallback');
 const widths=[];
 for(const width of [1440,960,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<700});await sleep(100);
  const size=await ev(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(size.scrollWidth<=width,JSON.stringify(size));widths.push(size);
  if(width===390){assert.equal(await ev(()=>getComputedStyle(document.querySelector('.ia-adaptive-map-desktop')).display),'none');const mobile=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'adaptive-mobile.png'),Buffer.from(mobile.data,'base64'));}
 }
 checks.push('Desktop graph and accessible mobile concept list; no overflow at 1440, 960, 390 or 320px');
 await ev(()=>{window.__adaptive.open=false;window.__renderAdaptive();});await sleep(80);
 await ev(()=>{window.__adaptive.state.ready=false;window.__adaptive.open=true;window.__renderAdaptive();});await sleep(180);
 assert.match(await text(),/todavía se está habilitando/);
 assert.equal(await ev(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Practicar este concepto')).disabled),true);
 checks.push('Missing schema leaves read-only graph and simulation, and disables persisted practice');
 assert.deepEqual(exceptions,[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,scope:'Actual React components and actual backend engine fixture outputs; synthetic service responses and accounts. No real student data written.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths,exceptions}));
}catch(error){console.error(error);console.error((await text()).slice(0,2000));process.exitCode=1;}
finally{await send('Browser.close');ws.close();}

