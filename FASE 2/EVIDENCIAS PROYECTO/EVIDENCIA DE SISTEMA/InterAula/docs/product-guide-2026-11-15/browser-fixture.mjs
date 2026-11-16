import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { MODEL, publicMastery, recommendNext } from '../../backend/src/services/adaptiveEngine.ts';
import { createPracticeExercise, COURSE_ID } from '../../backend/src/data/adaptiveCurriculum.ts';
const root = process.argv[2], out = path.join(root, 'docs/product-guide-2026-11-15');
fs.mkdirSync(out, {recursive:true});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const tabs = await (await fetch('http://127.0.0.1:9235/json/list')).json();
const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),exceptions=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const result=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',userGesture:true,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
const text=()=>ev(()=>document.querySelector('#guided-review')?.innerText||'');
const click=async(label,selector='#guided-review button, #guided-review a, #guided-review summary')=>{
 await ev((label,selector)=>{const item=[...document.querySelectorAll(selector)].find(item=>(item.textContent.includes(label)||item.getAttribute('aria-label')===label)&&item.getClientRects().length);if(!item)throw Error('Missing visible control: '+label);item.focus();item.click();},label,selector);await wait(350);
};
const go=async url=>{await ev(url=>window.__navigate(url),url);await wait(600);};
const shot=async name=>{const result=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name),Buffer.from(result.data,'base64'));};
const raw = createPracticeExercise('equations'), exercise = {attemptId:'00000000-0000-4000-8000-000000000055',skillId:'equations',prompt:raw.prompt,options:raw.options,hintUsed:false};
const adaptive={ready:true,course:{id:COURSE_ID,name:'Cálculo',pilot:true,contentStatus:'Piloto editorial'},model:MODEL,goalId:'chain',skills:publicMastery([],'chain'),recommendation:recommendNext([],'chain'),activeExercise:null,metrics:null,answeredCount:0};
try {
 await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await wait(1200);
 await ev(async fixture=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name);
  const R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u))),router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D;
  const {supabase}=await import('/src/lib/supabase.ts');
  const user={id:'00000000-0000-4000-8000-000000000001',email:'review@example.test',user_metadata:{first_name:'Estudiante'}};
  supabase.auth.getSession=async()=>({data:{session:{user,access_token:'fixture-only'}},error:null});
  supabase.auth.onAuthStateChange=callback=>{window.__fixtureAuthChange=callback;return {data:{subscription:{unsubscribe(){}}}};};
  const modules=[
   ['/src/services/profile.service.ts','profileService'],['/src/services/learningSpace.service.ts','learningSpaceService'],
   ['/src/services/tutoring.service.ts','tutoringService'],['/src/services/notes.service.ts','notesService'],
   ['/src/services/forum.service.ts','forumService'],['/src/services/project.service.ts','projectService'],
   ['/src/services/verification.service.ts','verificationService']
  ];
  const services={};
  for(const [url,name]of modules){const service=(await import(url))[name];services[name]=service;for(const key of Object.keys(service))if(key.startsWith('get'))service[key]=async()=>[];}
  const config={onboardingCompleted:true,explanationStyle:['step_by_step'],organizationStyle:[],communicationStyle:[],environmentStyle:[],defaultStudyIntervalMinutes:20,defaultBreakMinutes:5,subjectsToReinforce:[],learningGoalSummary:''};
  const stage={id:'stage',order_index:0,title:'Ecuaciones de primer grado',description:'Paso pequeño',content_topic:'Ecuaciones',practice_prompt:'Practicar',completed:false};
  const makePath=(id,title)=>({id,user_id:user.id,subject_name:'Matemáticas',title,goal:'Resolver ejercicios',pace:'paso_a_paso',preferred_mode:'sencilla',status:'active',progress_percent:0,stages:[{...stage,path_id:id}]});
  const state=window.__guided={recommendationCalls:0,reads:0,fail:false,overview:{config,paths:[makePath('path-a','Primera ruta'),makePath('path-b','Segunda ruta')],tasks:[],assessments:[]},network:[],answerCalls:0};
  const {apiClient}=await import('/src/lib/apiClient.ts');
  const originalGet=apiClient.get.bind(apiClient);
  apiClient.get=async (url,...args)=>url==='/learning-space/shared-supports'?[]:originalGet(url,...args);
  services.profileService.getMyProfile=async()=>({id:user.id,display_name:'Estudiante',first_name:'Estudiante',institution_name:'Universidad de prueba',career_name:'Carrera de prueba'});
  services.learningSpaceService.getOverview=async()=>{state.reads++;if(state.fail)throw Error('Fixture unavailable');return structuredClone(state.overview);};
  const rec=(await import('/src/services/recommendations.service.ts')).recommendationsService;
  rec.getFeed=async()=>{state.recommendationCalls++;return {mode:'starter',items:Array.from({length:5},(_,i)=>({id:'fixture-'+i,kind:'note',title:'Apunte de prueba '+i,summary:'Material de prueba',href:'/resources',reason:'Relacionado con tus materias',topics:[]})),personalizationEnabled:false,algorithmVersion:'fixture',generatedAt:new Date().toISOString(),hiddenCount:0};};
  const adaptiveService=(await import('/src/services/adaptiveLearning.service.ts')).adaptiveLearningService;
  adaptiveService.overview=async()=>structuredClone(fixture.adaptive);
  adaptiveService.start=async()=>structuredClone(fixture.exercise);
  adaptiveService.hint=async()=>({hint:'Revisa los términos de la ecuación.'});
  adaptiveService.answer=async()=>{state.answerCalls++;return {feedback:{attemptId:fixture.exercise.attemptId,skillId:'equations',correct:true,feedback:'Puedes seguir practicando.',hintUsed:false},overview:structuredClone(fixture.adaptive)};};
  // Block actual application HTTP calls. All reads above are synthetic and no production writes are allowed.
  window.fetch=async input=>{state.network.push(String(input));throw Error('Unexpected network call in isolated review');};
  const {AuthProvider}=await import('/src/context/AuthContext.tsx'),{CalmModeProvider}=await import('/src/context/CalmModeContext.tsx'),{default:AppRouter}=await import('/src/router/AppRouter.tsx');
  const old=document.getElementById('root');old.style.display='none';
  const mount=document.createElement('div');mount.id='guided-review';document.body.append(mount);
  function Capture(){const navigate=router.useNavigate(),location=router.useLocation();window.__navigate=navigate;window.__location=location.pathname+location.search+location.hash;return null;}
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(AuthProvider,null,React.createElement(router.MemoryRouter,{initialEntries:['/dashboard']},React.createElement(Capture),React.createElement(AppRouter)))));
 },{adaptive,exercise});await wait(1100);
 assert.match(await text(),/Tu siguiente paso/);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-nav-links a').length),4);
 assert.equal(await ev(()=>window.__guided.recommendationCalls),1);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-guide-overview-card').length),3);
 await shot('inicio-escritorio.png');
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-reco-card').length),3);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review #para-ti details').length),0);
 assert.ok(await ev(()=>document.querySelector('#guided-review .ia-guided-account a').getClientRects().length>0));
 await click('Ver todas las sugerencias');
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-reco-card').length),5);
 checks.push('Home displays recommendations and account links immediately; three suggestions expand to all using a visible button.');
 await go('/dashboard#para-ti');
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review #para-ti').length),1);
 assert.match(await text(),/Para ti/);
 checks.push('Existing #para-ti links reach a visible feed with a unique target.');
 await go('/dashboard');
 assert.match(await text(),/Organiza tu estudio/);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-guide-overview-card li').length),9);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-app-overview details').length),0);
 await click('Cómo usar InterAula');
 assert.equal(await ev(()=>window.__location),'/guide');
 assert.match(await text(),/Qué puedes hacer y cómo empezar/);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-guide-section').length),7);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-guide-features a').length),20);
 assert.match(await text(),/piloto de Cálculo/);
 assert.match(await text(),/permanecen pendientes hasta ser revisadas/);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-product-guide details').length),0);
 await shot('guia-escritorio.png');
 await go('/guide#mis-apoyos');
 assert.equal(await ev(()=>document.activeElement.id),'mis-apoyos');
 await click('Mis apoyos para aprender','.ia-guide-features a');
 assert.equal(await ev(()=>window.__location),'/learning-space?tab=profile');
 const guideSearch=await ev(async()=>{const {searchNavigation}=await import('/src/navigation/navigationSearch.ts');return searchNavigation('guía')[0].href;});
 assert.equal(guideSearch,'/guide');
 checks.push('Visible overview explains nine actions; full guide covers seven areas, twenty direct links, examples and clear pilot/accreditation limits.');

 await go('/learning-space');
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-module-primary button').length),3);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .learning-space-page details').length),0);
 assert.ok(await ev(()=>document.querySelector('#guided-review #study-paths-title').getClientRects().length>0));
 assert.ok(await ev(()=>document.querySelector('#guided-review .ia-guided-progress').getClientRects().length>0));
 assert.equal(await ev(()=>[...document.querySelectorAll('#guided-review .ia-module-secondary button')].every(button=>button.getClientRects().length>0)),true);
 assert.match(await text(),/Un paso a la vez/);
 await shot('estudiar-escritorio.png');
 await click('Mis apoyos para aprender','.ia-module-secondary button');
 assert.equal(await ev(()=>window.__location),'/learning-space?tab=profile');
 assert.equal(await ev(()=>document.activeElement.tagName),'BUTTON');
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-module-choice[aria-current=page]').textContent),'Mis apoyos para aprender');
 checks.push('All seven study destinations and progress are visible; direct selection preserves focus and URL without disclosure controls.');
 await ev(()=>window.__navigate(-1));await wait(450);
 assert.equal(await ev(()=>window.__location),'/learning-space');
 await go('/learning-space?tab=paths&path=path-b');
 assert.match(await ev(()=>document.querySelector('#guided-review .learning-path-selector-btn.active')?.textContent||''),/Segunda ruta/);
 await click('Primera ruta','.learning-path-selector-btn');await wait(450);
 assert.match(await ev(()=>document.querySelector('#guided-review .learning-path-selector-btn.active')?.textContent||''),/Primera ruta/);
 checks.push('Back restores the prior section; direct path links select the intended route without trapping subsequent selection.');
 await go('/learning-space?tab=adaptive');
 assert.ok(await ev(()=>document.querySelector('#guided-review .ia-adaptive-map-card svg').getClientRects().length>0));
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-adaptive-map-card').tagName),'SECTION');
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-adaptive-goal').tagName),'ASIDE');
 await click('Practicar este concepto');
 assert.match(await text(),/Una pregunta a la vez/);
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-adaptive-top').getClientRects().length),0);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review input[name=adaptive-answer]').length),4);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review [role=timer]').length),0);
 await shot('practica-enfocada.png');
 await ev(()=>document.querySelector('#guided-review input[name=adaptive-answer]').click());
 await click('Comprobar respuesta');
 assert.equal(await ev(()=>document.querySelector('#guided-review #adaptive-goal').disabled),false);
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-adaptive-top').hidden),false);
 assert.equal(await ev(()=>[...document.querySelectorAll('#guided-review .ia-adaptive button')].filter(button=>button.textContent.includes('Continuar con el siguiente paso')).length),1);
 checks.push('Adaptive practice keeps the question central, hides the competing recommendation, and retains four answers with no timer.');
 await go('/participate');
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-guided-options a').length),3);
 await click('Explorar apuntes →','.ia-guided-option');assert.match(await ev(()=>window.__location),/^\/resources/);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review .ia-module-primary button').length),3);
 await go('/projects?tab=my_applications');
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-module-choice[aria-current=page]').textContent),'Mis postulaciones');
 await go('/tutoring?tab=my_classes');
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-module-choice[aria-current=page]').textContent),'Mi agenda');
 await go('/my-tutoring?tab=history');
 assert.equal(await ev(()=>document.querySelector('#guided-review .ia-module-choice[aria-current=page]').textContent),'Historial');
 checks.push('Community exposes notes/forum/projects; real resources, projects, tutoring and management routes retain their deep links.');
 await go('/dashboard');
 await ev(()=>{window.__guided.overview.tasks=[{id:'working',title:'Repasar álgebra',status:'in_progress',subtasks:[]}];window.__guided.fail=true;});
 await go('/participate');await go('/dashboard');
 assert.match(await text(),/Parte de tu actividad/);
 assert.match(await text(),/Reintentar/);
 await ev(()=>window.__guided.fail=false);await click('Reintentar');
 assert.match(await ev(()=>document.querySelector('#guided-review .ia-guided-next h2').textContent),/Repasar álgebra/);
 checks.push('A partial read failure keeps navigation usable; retry restores the real in-progress task.');
 await ev(()=>{const button=document.querySelector('#guided-review [aria-label="Mi cuenta"]');button.focus();button.click();});await wait(100);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review #ia-account-menu details').length),0);
 assert.ok(await ev(()=>[...document.querySelectorAll('#guided-review #ia-account-menu a')].find(a=>a.textContent==='Acreditarme como tutor').getClientRects().length>0));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait(100);
 assert.equal(await ev(()=>document.querySelector('#guided-review [aria-label="Mi cuenta"]').getAttribute('aria-expanded')),'false');
 assert.equal(await ev(()=>document.activeElement.getAttribute('aria-label')),'Mi cuenta');
 const widths=[];
 for(const width of [320,390,768,1181,1280,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});await wait(120);
  const result=await ev(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth,main:document.querySelector('#guided-review main').scrollWidth,brandRight:document.querySelector('#guided-review .ia-brand').getBoundingClientRect().right,toolsLeft:document.querySelector('#guided-review .ia-nav-user').getBoundingClientRect().left,toolsRight:document.querySelector('#guided-review .ia-nav-user').getBoundingClientRect().right}));
  assert.ok(result.body<=width+1 && result.brandRight<=result.toolsLeft && result.toolsRight<=width,JSON.stringify(result));widths.push({width,...result});
  if(width>=1181)assert.equal(await ev(()=>getComputedStyle(document.querySelector('#guided-review .ia-nav-links')).display),'flex');
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:950,deviceScaleFactor:1,mobile:false});
 await click('Abrir navegación','[aria-label="Abrir navegación"]');
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review #ia-mobile-navigation a').length),4);
 await click('Comunidad','#ia-mobile-navigation a');assert.equal(await ev(()=>window.__location),'/participate');
 await shot('comunidad-celular.png');
 await go('/learning-space');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:950,deviceScaleFactor:1,mobile:false});await wait(120);
 assert.equal(await ev(()=>[...document.querySelectorAll('#guided-review .ia-module-nav button')].every(button=>button.getClientRects().length>0)),true);
 assert.ok(await ev(()=>document.documentElement.scrollWidth<=innerWidth));
 await shot('estudiar-celular.png');
 checks.push('Account Escape restores focus; desktop and mobile navigation share four destinations and fit 320/390/768/1440 px.');

 await go('/guide');
 await ev(()=>window.__fixtureAuthChange('SIGNED_OUT',null));await wait(250);
 assert.equal(await ev(()=>window.__location),'/guide');
 assert.match(await text(),/Puedes leer esta guía sin una cuenta/);
 assert.ok(await ev(()=>document.querySelector('#guided-review .ia-guide-header a[href="/login"]').getClientRects().length>0));
 for(const width of [320,390,768,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait(120);
  assert.ok(await ev(()=>document.documentElement.scrollWidth<=innerWidth),'Guide overflow at '+width);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:950,deviceScaleFactor:1,mobile:false});await go('/guide');
 await shot('guia-celular.png');
 await go('/');
 assert.match(await text(),/Qué puedes hacer en InterAula/);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review #como-funciona .ia-home-start li').length),3);
 assert.equal(await ev(()=>document.querySelectorAll('#guided-review #como-funciona .ia-guide-overview-card').length),3);
 assert.ok(await ev(()=>document.querySelector('#guided-review #como-funciona a[href="/guide"]').getClientRects().length>0));
 checks.push('Guide remains readable after synthetic sign-out, fits four viewport sizes, and the public presentation explains three optional starting steps plus the same feature overview.');
 assert.deepEqual(exceptions,[]);
 assert.deepEqual(await ev(()=>window.__guided.network),[]);
 assert.equal(await ev(()=>window.__guided.answerCalls),1);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,scope:'Actual AppRouter, layouts and React pages; synthetic account and service reads. No production writes; no student answers recorded.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths}));
}catch(error){console.error(error);console.error((await text()).slice(0,1800));process.exitCode=1;}
finally{ws.close();}

