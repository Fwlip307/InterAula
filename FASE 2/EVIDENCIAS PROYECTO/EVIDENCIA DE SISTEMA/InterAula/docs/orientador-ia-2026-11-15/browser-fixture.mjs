import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { MODEL, publicMastery, recommendNext } from '../../backend/src/services/adaptiveEngine.ts';
import { createPracticeExercise, COURSE_ID } from '../../backend/src/data/adaptiveCurriculum.ts';
const root = process.argv[2], out = path.join(root, 'docs/orientador-ia-2026-11-15');
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
  apiClient.get=async (url,...args)=>['/learning-space/shared-supports','/learning-space/ideas'].includes(url.split('?')[0])?[]:originalGet(url,...args);
  services.profileService.getMyProfile=async()=>({id:user.id,display_name:'Estudiante',first_name:'Estudiante',institution_name:'Universidad de prueba',career_name:'Carrera de prueba'});
  services.learningSpaceService.getOverview=async()=>{state.reads++;if(state.fail)throw Error('Fixture unavailable');return structuredClone(state.overview);};
  const rec=(await import('/src/services/recommendations.service.ts')).recommendationsService;
  rec.getFeed=async()=>{state.recommendationCalls++;return {mode:'starter',items:Array.from({length:5},(_,i)=>({id:'fixture-'+i,kind:'note',title:'Apunte de prueba '+i,summary:'Material de prueba',href:'/resources',reason:'Relacionado con tus materias',topics:[]})),personalizationEnabled:false,algorithmVersion:'fixture',generatedAt:new Date().toISOString(),hiddenCount:0};};
  const adaptiveService=(await import('/src/services/adaptiveLearning.service.ts')).adaptiveLearningService;
  adaptiveService.overview=async()=>structuredClone(fixture.adaptive);
  adaptiveService.start=async()=>structuredClone(fixture.exercise);
  adaptiveService.hint=async()=>({hint:'Revisa los términos de la ecuación.'});
  adaptiveService.answer=async()=>{state.answerCalls++;return {feedback:{attemptId:fixture.exercise.attemptId,skillId:'equations',correct:true,feedback:'Puedes seguir practicando.',hintUsed:false},overview:structuredClone(fixture.adaptive)};};

  const synth=window.__speech={calls:[],speaking:false,paused:false,current:null,cancel(){const old=this.current;this.current=null;this.speaking=false;this.paused=false;old?.onend?.();},pause(){this.paused=true;},resume(){this.paused=false;},speak(utterance){this.calls.push({text:utterance.text,rate:utterance.rate});this.current=utterance;this.speaking=true;queueMicrotask(()=>utterance.onstart?.());}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
  window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  window.__fixtureUtterance=window.SpeechSynthesisUtterance;
  state.projectWrites=0;state.taskWrites=0;state.preferenceWrites=0;state.explanations=0;state.startCalls=0;
  services.projectService.createProject=async()=>{state.projectWrites++;throw Error('Unexpected publish');};
  services.learningSpaceService.createStudyTask=async()=>{state.taskWrites++;throw Error('Unexpected task');};
  services.learningSpaceService.updateConfig=async()=>{state.preferenceWrites++;throw Error('Unexpected preferences');};
  services.learningSpaceService.getAdaptiveExplanation=async params=>{state.explanations++;return {subject_name:params.subject_name,topic:params.topic,mode:params.mode,mode_label:'Paso a paso',summary:'Identifica los términos de la ecuación.',key_points:['Reúne los términos semejantes.'],practical_example:'x + 1 = 3: resta uno en ambos lados.',visual_structure:[],comprehension_check:{question:'¿Qué paso sigue?',options:[{id:'a',text:'Restar uno.'},{id:'b',text:'Sumar uno.'}],correctOptionId:'a',feedback:'Resta en ambos lados.'}};};
  adaptiveService.start=async()=>{state.startCalls++;return structuredClone(fixture.exercise);};

  // Block actual application HTTP calls. All reads above are synthetic and no production writes are allowed.
  window.__chat={requests:[],delay:650,fail:false,answer:null,ignoreAbort:false};
  const verification=(await import('/src/services/verification.service.ts')).verificationService;
  verification.getMyVerificationRequests=async()=>[];
  verification.inclusiveStatus=async()=>({schemaReady:true,hasReviewer:false});
  window.fetch=async(input,options={})=>{
   if(!String(input).endsWith('/ai/orientation-chat')){state.network.push(String(input));throw Error('Unexpected network call');}
   const chat=window.__chat,body=JSON.parse(options.body),request={body,headers:options.headers,signal:options.signal};
   chat.requests.push(request);const fail=chat.fail,custom=chat.answer,ignoreAbort=chat.ignoreAbort;
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,chat.delay);
    if(!ignoreAbort)options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Canceled','AbortError'));},{once:true});
   });
   if(fail)return new Response(JSON.stringify({success:false,error:'Fixture AI unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});
   const tutor=body.message.includes('me hago tutor'),find=body.message.includes('necesito tutor');
   const answer=custom||{message:tutor?'Para ofrecer tutorías acredita una materia en Perfil → Ofrecer tutorías.':find?'Puedes buscar apoyo en Pedir apoyo → Encontrar un tutor.':body.history.length?'Puedes practicar derivadas en el piloto de Cálculo.':'La derivada mide el cambio. Por ejemplo, la derivada de x² es 2x.',topic:tutor||find?'app':'study',suggested_guides:tutor?['become-tutor']:find?['tutors']:['practice'],provider:'google_gemini',model:'browser-fixture'};
   return new Response(JSON.stringify({success:true,data:answer}),{headers:{'Content-Type':'application/json'}});
  };
  const {AuthProvider}=await import('/src/context/AuthContext.tsx'),{CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx'),{default:AppRouter}=await import('/src/router/AppRouter.tsx');
  const old=document.getElementById('root');old.style.display='none';
  const mount=document.createElement('div');mount.id='guided-review';document.body.append(mount);
  function Capture(){window.__setTheme=useCalmMode().setThemeMode;const navigate=router.useNavigate(),location=router.useLocation();window.__navigate=navigate;window.__location=location.pathname+location.search+location.hash;return null;}
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(AuthProvider,null,React.createElement(router.MemoryRouter,{initialEntries:['/dashboard']},React.createElement(Capture),React.createElement(AppRouter)))));
 },{adaptive,exercise});await wait(1100);

 const ptext=()=>ev(()=>document.querySelector('.ia-orientation-panel')?.innerText||'');
 const pc=label=>click(label,'.ia-orientation-panel button');
 const type=async(selector,value)=>{await ev((selector,value)=>{const input=document.querySelector(selector);if(!input)throw Error('Missing field '+selector);const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));},selector,value);await wait(60);};
 const ask=async message=>{await type('#ia-orientation-message',message);await pc('Conversar con el orientador');};
 const ready=async()=>{for(let i=0;i<60;i++){if(!await ev(()=>Boolean(document.querySelector('.ia-orientation-thinking'))))return;await wait(80);}throw Error('Chat timeout');};
 const target=async selector=>{for(let i=0;i<40;i++){if(await ev(selector=>[...document.querySelectorAll(selector)].some(e=>e.hasAttribute('data-orientation-active')),selector))return;await wait(100);}throw Error('Missing tour target '+selector);};
 assert.equal(await ev(()=>Boolean(document.querySelector('.ia-orientation-panel'))),false);
 assert.equal(await ev(()=>window.__speech.calls.length),0);
 await click('Abrir orientador','#guided-review .ia-orientation-entry button');
 await go('/tutoring?tab=my_classes');
 await ask('hola me hago tutor');
 assert.match(await ptext(),/preparando una respuesta/);
 assert.equal(await ev(()=>document.querySelector('#ia-orientation-message').disabled),true);
 assert.equal(await ev(()=>document.querySelectorAll('.ia-orientation-scrim').length),0);
 await ready();
 assert.match(await ptext(),/Perfil → Ofrecer tutorías/);
 assert.match(await ptext(),/Google Gemini/);
 assert.equal(await ev(()=>window.__location),'/tutoring?tab=my_classes');
 assert.equal(await ev(()=>window.__chat.requests[0].headers.Authorization),'Bearer fixture-only');
 assert.deepEqual(await ev(()=>Object.keys(window.__chat.requests[0].body.context).sort()),['page','tab']);
 checks.push('Authenticated chat uses the API client, sends minimal navigation context, shows loading and Gemini attribution; chatting never navigates or dims the page.');
 await pc('Acreditarme como tutor');
 assert.equal(await ev(()=>window.__location),'/tutoring?tab=my_classes');
 await pc('Empezar recorrido');await target('[data-orientation="module-tutoring"]');
 assert.equal(await ev(()=>window.__location),'/profile?tab=tutoring');
 assert.equal(await ev(()=>document.querySelectorAll('.ia-orientation-scrim').length),1);
 assert.equal(await ev(()=>document.querySelectorAll('.ia-orientation-conversation').length),0);
 await pc('Siguiente paso');await target('[data-orientation="tutor-accreditation"]');
 await pc('Siguiente paso');await target('#offered-subjects');
 await pc('Terminar recorrido');
 assert.match(await ptext(),/Recorrido terminado/);
 await ask('ahora necesito tutor');
 assert.doesNotMatch(await ptext(),/Recorrido terminado/);await ready();
 assert.match(await ptext(),/Encontrar un tutor/);
 assert.equal(await ev(()=>window.__chat.requests.at(-1).body.context.stage),'completed');
 assert.equal(await ev(()=>window.__chat.requests.at(-1).body.context.guide),'become-tutor');
 checks.push('Becoming a tutor has its own real profile tour; selection does not navigate until Start. A new chat clears stale tour completion and sends the completed guide as context.');
 await pc('Empezar de nuevo y borrar conversación');
 await ask('Explícame una derivada con un ejemplo');await ready();
 await ask('¿cómo puedo practicarlo aquí?');await ready();
 assert.match(await ptext(),/derivada de x²/);
 assert.match(await ptext(),/practicar derivadas/);
 const history=await ev(()=>window.__chat.requests.at(-1).body.history);
 assert.deepEqual(history.map(m=>m.role),['user','assistant']);
 assert.match(history[0].text,/derivada/);
 assert.equal(await ev(()=>window.__speech.calls.length),0);
 checks.push('Study conversation displays both turns, forwards recent context, and remains silent until the user requests audio.');
 await ev(()=>window.__chat.fail=true);
 await ask('Mensaje de prueba para reintentar');await ready();
 assert.match(await ptext(),/No pude obtener una respuesta/);
 assert.match(await ptext(),/Recorridos manuales/);
 const failed=await ev(()=>window.__chat.requests.at(-1).body);
 await ev(()=>window.__chat.fail=false);
 await pc('Reintentar respuesta');await ready();
 assert.deepEqual(await ev(()=>window.__chat.requests.at(-1).body),failed);
 assert.equal(await ev(()=>[...document.querySelectorAll('.ia-orientation-user')].filter(e=>e.textContent.includes('Mensaje de prueba para reintentar')).length),1);
 checks.push('Failure is explicit, manual tours remain usable, and retry reuses the same payload without duplicating the user message.');
 await ev(()=>{window.__chat.ignoreAbort=true;window.__chat.delay=1300;window.__chat.answer={message:'LATE_PRIVATE_RESULT',topic:'study',suggested_guides:[],provider:'google_gemini',model:'fixture'};});
 await ask('Private pending turn');
 await pc('Empezar de nuevo y borrar conversación');await wait(1400);
 assert.doesNotMatch(await ptext(),/LATE_PRIVATE_RESULT|Private pending turn/);
 checks.push('Clearing conversation cancels pending requests and ignores late responses even if a transport ignores abort.');
 await ask('Another pending turn');await pc('Cerrar');await wait(1400);
 await click('Abrir orientador paso a paso','.ia-orientation-launcher');
 assert.doesNotMatch(await ptext(),/LATE_PRIVATE_RESULT/);
 checks.push('Closing cancels requests; late replies cannot reopen or overwrite the assistant.');
 await pc('Empezar de nuevo y borrar conversación');
 await ask('Exam pending');
 await ev(()=>{const dialog=document.createElement('div');dialog.id='fixture-exam';dialog.setAttribute('aria-modal','true');dialog.style.cssText='position:fixed;inset:100px;background:white';document.body.append(dialog);});await wait(1500);
 assert.equal(await ev(()=>Boolean(document.querySelector('.ia-orientation-panel'))),false);
 await ev(()=>document.querySelector('#fixture-exam').remove());await wait(90);
 assert.equal(await ev(()=>Boolean(document.querySelector('.ia-orientation-panel'))),false);
 await click('Abrir orientador paso a paso','.ia-orientation-launcher');
 assert.doesNotMatch(await ptext(),/LATE_PRIVATE_RESULT/);
 checks.push('An accreditation/modal suspends the assistant, aborts pending work and never automatically reopens after the modal closes.');
 await ev(()=>{window.__chat.delay=300;window.__chat.ignoreAbort=false;window.__chat.answer={message:'<img src=x onerror=window.__xss=1>',topic:'study',suggested_guides:['/admin','practice'],provider:'google_gemini',model:'fixture'};});
 await pc('Empezar de nuevo y borrar conversación');
 await ask('<script>window.__xss=1</script>');await ready();
 assert.equal(await ev(()=>Boolean(window.__xss)),false);
 assert.equal(await ev(()=>document.querySelectorAll('.ia-orientation-panel img,.ia-orientation-panel script').length),0);
 assert.match(await ptext(),/onerror/);
 assert.doesNotMatch(await ptext(),/admin/);
 checks.push('User and model messages render as plain text; unknown guide identifiers cannot become links or actions.');
 await ev(()=>{window.__chat.answer=null;});
 await pc('Empezar de nuevo y borrar conversación');
 await ask('Explícame una derivada con un ejemplo');await ready();
 await shot('chat-estudio-desktop.png');
 const widths=[];
 for(const width of [320,390,768,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});await wait(100);
  const bounds=await ev(()=>{const r=document.querySelector('.ia-orientation-panel').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,scroll:document.querySelector('.ia-orientation-panel').scrollWidth,width:r.width};});
  assert.ok(bounds.left>=0&&bounds.right<=width+1&&bounds.bottom<=851,JSON.stringify(bounds));assert.ok(bounds.scroll<=bounds.width+1);widths.push({viewportWidth:width,...bounds});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:850,deviceScaleFactor:1,mobile:false});
 await shot('chat-estudio-mobile.png');
 await ev(()=>window.__setTheme('dark'));await wait(120);await shot('chat-dark.png');
 await ev(()=>window.__setTheme('calm'));await wait(120);await shot('chat-calm.png');
 await ev(()=>window.__setTheme('light'));
 checks.push('The chat fits 320/390/768/1440 px and remains readable in light, dark and Calm themes.');
 await ev(()=>{window.__chat.ignoreAbort=true;window.__chat.delay=1300;});
 await ask('Account-private pending message');
 await ev(()=>window.__fixtureAuthChange('SIGNED_IN',{access_token:'fixture-only-b',user:{id:'00000000-0000-4000-8000-000000000002',email:'review-b@example.test',user_metadata:{}}}));await wait(1500);
 assert.equal(await ev(()=>Boolean(document.querySelector('.ia-orientation-panel'))),false);
 await click('Abrir orientador paso a paso','.ia-orientation-launcher');
 assert.doesNotMatch(await ptext(),/Account-private|practicar derivadas|derivada de/);
 assert.equal(await ev(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('Account-private')),false);
 checks.push('Changing account aborts pending responses, resets history and keeps message text out of local/session storage.');
 assert.deepEqual(exceptions,[]);
 assert.deepEqual(await ev(()=>window.__guided.network),[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,scope:'Real React UI, AppRouter, profile tour and HTTP client. Synthetic account, app data, AI responses and audio. Separate live Gemini smoke test verifies the provider. No production writes.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths}));
}catch(error){console.error(error);console.error(await ev(()=>document.querySelector('.ia-orientation-panel')?.innerText||''));process.exitCode=1;}
finally{ws.close();}
