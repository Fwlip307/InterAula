import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { MODEL, publicMastery, recommendNext } from '../../backend/src/services/adaptiveEngine.ts';
import { createPracticeExercise, COURSE_ID } from '../../backend/src/data/adaptiveCurriculum.ts';
const root = process.argv[2], out = path.join(root, 'docs/pulido-integral-2026-11-15');
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
  window.__services=services;
  const qa=window.__qa={requests:[],reviews:[],writes:[],failReview:false,reviewed:false,delayMode:false,readFail:false,profileWrites:[]};
  const subject={id:'00000000-0000-4000-8000-000000000101',name:'Matemáticas QA',category:'Ciencias'};
  services.profileService.getSubjects=async()=>[subject];
  services.profileService.getProfileById=async id=>({id,display_name:'Perfil QA',first_name:'Perfil',career:'Informática'});
  services.profileService.getOfferedSubjects=async()=>[{subject_id:subject.id,is_verified:true,level:'basic',subject},{subject_id:'unapproved-qa',is_verified:false,level:'basic',subject:{id:'unapproved-qa',name:'Materia pendiente QA'}}];
  services.profileService.updateProfile=async data=>{qa.profileWrites.push(data);return {id:user.id,...data};};
  services.tutoringService.getTutorStats=async()=>({profile_id:user.id,total_completed_tutorings:0,total_reviews_received:0,avg_communication:0,avg_knowledge:0,avg_punctuality:0,overall_rating:0});
  rec.getPreferences=async()=>({revision:0,personalization_enabled:true,discoverable:false,interest:[],learn:[],teach:[]});
  rec.getTopics=async()=>[{id:'python',name:'Python',category:'Tecnología',aliases:[]}];
  rec.getCommunity=async()=>({preferences:{institutionId:null,campusId:null,scope:'all',modality:'any'},activationRequired:false});
  rec.saveCommunity=async preferences=>{qa.writes.push({kind:'community',preferences});return {preferences,activationRequired:false};};
  const completed={id:'00000000-0000-4000-8000-000000000094',student_id:user.id,tutor_id:'00000000-0000-4000-8000-000000000091',subject_id:subject.id,subject,student:{id:user.id,display_name:'Estudiante QA'},tutor:{id:'00000000-0000-4000-8000-000000000091',display_name:'Tutor QA'},status:'completed',modality:'online',scheduled_at:new Date(Date.now()-7200000).toISOString(),duration_minutes:60,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  window.__qaCompleted=completed;
  services.tutoringService.getMySessionsAsStudent=async()=>[{...completed,review:qa.reviewed?{overall_score:8}:null}];
  services.tutoringService.getMySessionsAsTutor=async()=>[{...completed,id:'00000000-0000-4000-8000-000000000095',tutor_id:user.id,student_id:'00000000-0000-4000-8000-000000000092',status:'accepted'}];
  services.tutoringService.updateSessionStatus=async(id,status)=>{qa.writes.push({kind:'session',id,status});return {...completed,id,status};};
  const previousFetch=window.fetch;
  window.fetch=async(input,options={})=>{
   if(String(input).includes('/ai/status'))return new Response(JSON.stringify({success:true,data:{configured:false}}),{headers:{'Content-Type':'application/json'}});
   if(String(input).endsWith('/reviews')){
    const body=JSON.parse(options.body);qa.requests.push({url:String(input),body});
    if(qa.failReview)return new Response(JSON.stringify({success:false,error:'No se pudo guardar la valoración QA.'}),{status:503,headers:{'Content-Type':'application/json'}});
    qa.reviews.push(body);qa.reviewed=true;
    return new Response(JSON.stringify({success:true,data:{...body,id:'review-fixture',overall_score:(body.communication_score+body.knowledge_score+body.punctuality_score)/3}}),{headers:{'Content-Type':'application/json'}});
   }
   return previousFetch(input,options);
  };
  const {AuthProvider}=await import('/src/context/AuthContext.tsx'),{CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx'),{default:AppRouter}=await import('/src/router/AppRouter.tsx');
  const old=document.getElementById('root');old.style.display='none';
  const mount=document.createElement('div');mount.id='guided-review';document.body.append(mount);
  function Capture(){window.__setTheme=useCalmMode().setThemeMode;const navigate=router.useNavigate(),location=router.useLocation();window.__navigate=navigate;window.__location=location.pathname+location.search+location.hash;return null;}
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(AuthProvider,null,React.createElement(router.MemoryRouter,{initialEntries:['/dashboard']},React.createElement(Capture),React.createElement(AppRouter)))));
 },{adaptive,exercise});await wait(1100);

 const type=async(selector,value)=>{await ev((selector,value)=>{const input=[...document.querySelectorAll(selector)].find(e=>e.getClientRects().length);if(!input)throw Error('Missing field '+selector);const proto=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));},selector,value);await wait(70);};
 const visible=selector=>ev(selector=>[...document.querySelectorAll(selector)].some(e=>e.getClientRects().length),selector);
 const routes=[
  ['/dashboard','Tu siguiente paso'],['/participate','Comunidad'],['/community','Mi comunidad'],
  ...['overview','adaptive','paths','explain','tasks','reinforce','profile'].map(tab=>['/learning-space?tab='+tab,'Estudiar']),
  ...['tutors','workshops','my_classes','quizzes','materials'].map(tab=>['/tutoring?tab='+tab,'Pedir apoyo']),
  ...['community','mine','drafts'].map(tab=>['/resources?tab='+tab,'Apuntes']),
  ['/forum','Foro'],
  ...['explore','my_projects','my_applications'].map(tab=>['/projects?tab='+tab,'Proyectos']),
  ...['personal','interests','learning','tutoring'].map(tab=>['/profile?tab='+tab,'perfil']),
  ['/profile/00000000-0000-4000-8000-000000000091','Perfil QA'],
  ...['requests','confirmed','student_sessions','history','workshops','offerings','materials'].map(tab=>['/my-tutoring?tab='+tab,'Tutor']),
  ['/settings','Configuración'],
 ];
 for(const [url,expected]of routes){
  await go(url);
  assert.ok((await text()).toLocaleLowerCase().includes(expected.toLocaleLowerCase()),'Missing '+expected+' at '+url);
  assert.equal(await visible('#guided-review h1,#guided-review h2'),true,'Missing content '+url);
  assert.deepEqual(exceptions,[],url);
 }
 checks.push({name:'Navegación completa de módulos autenticados',routes:routes.length,passed:true});
 await go('/my-tutoring?tab=offerings');
 assert.match(await text(),/Materias habilitadas para impartir \(1\)/);
 assert.doesNotMatch(await text(),/Materia pendiente QA|Publicar Nueva Asignatura|Publicar mi Primera Materia/);
 await click('Acreditar una materia');
 assert.equal(await ev(()=>window.__location),'/profile?tab=tutoring');
 checks.push({name:'Gestión y perfil muestran solo materias acreditadas; acreditar dirige al flujo real',passed:true});
 await go('/my-tutoring?tab=confirmed');
 assert.equal(await visible('#guided-review button'),true);
 assert.match(await text(),/Finalizar tutoría/);
 await click('Finalizar tutoría');
 assert.equal(await ev(()=>window.__qa.writes.at(-1).status),'completed');
 await go('/tutoring?tab=my_classes');
 assert.doesNotMatch(await text(),/Confirmar Tutoría Realizada|Finalizar tutoría/);
 const workshopsLink=await ev(()=>[...document.querySelectorAll('#guided-review a')].find(a=>a.textContent.includes('Explorar talleres abiertos')).getAttribute('href'));
 assert.equal(workshopsLink,'/tutoring?tab=workshops');
 await click('Explorar talleres abiertos');assert.equal(await ev(()=>window.__location),'/tutoring?tab=workshops');
 checks.push({name:'Finalizar corresponde al tutor y los enlaces de agenda llegan a la pestaña correcta',passed:true});
 await go('/tutoring?tab=my_classes');await click('Evaluar Tutor');
 assert.equal(await visible('dialog.ia-review-dialog[open]'),true);
 assert.equal(await ev(()=>[...document.querySelectorAll('.ia-review-dialog select')].every(e=>e.value==='')),true);
 assert.equal(await ev(()=>[...document.querySelectorAll('.ia-review-dialog button')].find(e=>e.textContent.includes('Guardar valoración')).disabled),true);
 await type('#review-communication_score','9');await type('#review-knowledge_score','8');await type('#review-punctuality_score','7');
 await type('#review-comment','Fue claro y respetó el horario.');
 assert.match(await ev(()=>document.querySelector('.ia-review-dialog').innerText),/8.00 \/ 10/);
 await shot('valoracion-desktop.png');
 await ev(()=>window.__qa.failReview=true);await click('Guardar valoración','.ia-review-dialog button');
 assert.match(await ev(()=>document.querySelector('.ia-review-dialog').innerText),/No se pudo guardar/);
 assert.equal(await ev(()=>document.querySelector('#review-knowledge_score').value),'8');
 await ev(()=>window.__qa.failReview=false);await click('Guardar valoración','.ia-review-dialog button');
 assert.equal(await visible('dialog.ia-review-dialog[open]'),false);
 const payload=await ev(()=>window.__qa.reviews.at(-1));
 assert.deepEqual(payload,{communication_score:9,knowledge_score:8,punctuality_score:7,comment:'Fue claro y respetó el horario.'});
 assert.doesNotMatch(await text(),/Evaluar Tutor/);
 checks.push({name:'Valoración sin máximos predeterminados, conserva los tres criterios; error conserva la selección y el reintento guarda una sola vez',passed:true});
 // Resolve overlapping list reads in reverse order.
 await ev(()=>{
  const qa=window.__qa,services=window.__services;
  const note=title=>({id:title,title,authorId:'other',authorName:'Autor QA',subjectName:'Matemáticas',category:'Apunte de Clase',tags:[],summary:title,folder:'General',sourceType:'editor',contentHtml:'<p>Ejemplo</p>',visibility:'public',isDraft:false,version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),downloadsCount:0});
  services.notesService.getNotes=async filters=>{
   if(qa.readFail)throw Error('Isolated read failure');
   const term=filters?.search||'';
   await new Promise(r=>setTimeout(r,term==='anterior'?700:80));
   return term?[note(term==='anterior'?'Resultado anterior QA':'Resultado vigente QA')]:[];
  };
 });
 await go('/resources?tab=community');await type('[data-orientation="notes-search"]','anterior');await type('[data-orientation="notes-search"]','vigente');await wait(850);
 assert.match(await text(),/Resultado vigente QA/);assert.doesNotMatch(await text(),/Resultado anterior QA/);
 await ev(()=>window.__qa.readFail=true);await type('[data-orientation="notes-search"]','error');
 assert.match(await text(),/No se pudieron cargar los apuntes/);
 await ev(()=>window.__qa.readFail=false);await type('[data-orientation="notes-search"]','recuperado');await wait(200);
 assert.doesNotMatch(await text(),/No se pudieron cargar los apuntes/);
 checks.push({name:'Apuntes descarta resultados antiguos, informa errores y recupera la búsqueda',passed:true});
 await ev(()=>{
  window.__services.forumService.getPosts=async filters=>{
   const term=filters?.search||'';await new Promise(r=>setTimeout(r,term==='anterior'?700:80));
   return term?[{id:term,title:term==='anterior'?'Pregunta anterior QA':'Pregunta vigente QA',description:'Descripción de pregunta QA',author:'Autor QA',authorId:'other',category:'General',postType:'pregunta',tags:[],repliesCount:0,votesCount:0,timeAgo:'ahora',isSolved:false}]:[];
  };
  window.__services.forumService.getPostById=async()=>{throw Error('Isolated thread failure');};
 });
 await go('/forum');await type('input[placeholder^="Buscar por tema"]','anterior');await type('input[placeholder^="Buscar por tema"]','vigente');await wait(850);
 assert.match(await text(),/Pregunta vigente QA/);assert.doesNotMatch(await text(),/Pregunta anterior QA/);
 await click('Pregunta vigente QA');assert.match(await text(),/No se pudo abrir esta conversación/);
 checks.push({name:'Foro descarta resultados antiguos y los fallos al abrir conversaciones se muestran sin rechazo de promesa sin manejar',passed:true});
 await ev(()=>{
  window.__services.tutoringService.getAvailableTutors=async filters=>{
   const term=filters?.search||'';await new Promise(r=>setTimeout(r,term==='anterior'?700:80));
   return term?[{profile:{id:'tutor-fixture',display_name:term==='anterior'?'Tutor anterior QA':'Tutor vigente QA'},offeredSubjects:[{subject_id:'subject-fixture',is_verified:true,subject:{name:'Matemáticas QA'}}],statistics:null,badges:[]}]:[];
  };
 });
 await go('/tutoring?tab=tutors');await type('[data-orientation="tutor-search"]','anterior');await type('[data-orientation="tutor-search"]','vigente');await wait(850);
 assert.match(await text(),/Tutor vigente QA/);assert.doesNotMatch(await text(),/Tutor anterior QA/);
 checks.push({name:'La búsqueda de tutores mantiene la última consulta aunque una anterior responda tarde',passed:true});
 // Check the real review dialog in mobile and every theme.
 await ev(()=>{window.__qa.reviewed=false;});await go('/dashboard');await go('/tutoring?tab=my_classes');await click('Evaluar Tutor');
 const widths=[];
 for(const width of [320,390,768,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});await wait(110);
  const bounds=await ev(()=>{const e=document.querySelector('dialog.ia-review-dialog'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,width:r.width,scrollWidth:e.scrollWidth};});
  assert.ok(bounds.left>=0&&bounds.right<=width+1&&bounds.bottom<=851,JSON.stringify(bounds));assert.ok(bounds.scrollWidth<=bounds.width+1);widths.push({viewportWidth:width,...bounds});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:850,deviceScaleFactor:1,mobile:false});
 await shot('valoracion-mobile.png');await ev(()=>window.__setTheme('dark'));await wait(110);await shot('valoracion-dark.png');await ev(()=>window.__setTheme('calm'));await wait(110);await shot('valoracion-calm.png');await ev(()=>window.__setTheme('light'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait(100);
 assert.equal(await visible('dialog.ia-review-dialog[open]'),false);
 checks.push({name:'Diálogo accesible con foco contenido, Escape y ajuste en 320/390/768/1440, claro/oscuro/Calma',passed:true});
 await go('/profile/00000000-0000-4000-8000-000000000091');
 assert.doesNotMatch(await text(),/Materia pendiente QA/);
 await ev(()=>{window.__services.profileService.getProfileById=async()=>{throw Error('Isolated profile read failure');};});
 await go('/profile/00000000-0000-4000-8000-000000000099');
 assert.match(await text(),/No pudimos cargar el perfil/);assert.doesNotMatch(await text(),/Perfil no encontrado/);
 await ev(()=>{window.__services.profileService.getProfileById=async id=>({id,display_name:'Perfil recuperado QA'});});
 await click('Reintentar perfil');assert.match(await text(),/Perfil recuperado QA/);
 checks.push({name:'Perfil público muestra solo materias acreditadas y diferencia fallo de red de perfil inexistente; permite reintentar',passed:true});
 // Auth screens use a synthetic signed-out session; no real emails or accounts.
 await ev(()=>window.__fixtureAuthChange('SIGNED_OUT',null));
 const publicRoutes=[['/','InterAula'],['/guide','InterAula'],['/login','Correo electrónico'],['/register','Correo electrónico'],['/forgot-password','contraseña'],['/update-password','contraseña']];
 for(const [url,expected]of publicRoutes){await go(url);assert.ok((await text()).toLowerCase().includes(expected.toLowerCase()),url);}
 await go('/projects');assert.match(await ev(()=>window.__location),/^\/login/);
 checks.push({name:'Inicio, guía, acceso, registro y recuperación se renderizan; las rutas privadas redirigen al salir',routes:publicRoutes.length,passed:true});
 assert.deepEqual(exceptions,[]);
 const network=await ev(()=>window.__guided.network);
 assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,authenticatedRoutes:routes.map(r=>r[0]),publicRoutes:publicRoutes.map(r=>r[0]),scope:'Real components, router and review HTTP client; isolated services/auth/data. No production writes, no real emails, no live video/audio. Actual SQL/API lifecycle tested separately with ephemeral PGlite.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,authenticatedRoutes:routes.length,publicRoutes:publicRoutes.length}));
}catch(error){console.error(error);console.error((await text()).slice(0,2500));console.error('Exceptions: '+JSON.stringify(exceptions));process.exitCode=1;}
finally{ws.close();}
