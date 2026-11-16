import fs from 'node:fs';import assert from 'node:assert/strict';
const out='docs/moderation-2026-11-16',wait=ms=>new Promise(r=>setTimeout(r,ms));
const tabs=await(await fetch('http://127.0.0.1:9235/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map(),exceptions=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const text=()=>ev(()=>document.querySelector('#support-review')?.innerText||'');
const until=async fn=>{for(let i=0;i<90;i++){if(await fn())return;await wait(100);}throw Error('Timeout');};
const click=async label=>{await ev(label=>{const b=[...document.querySelectorAll('#support-review button')].find(b=>b.textContent.trim()===label&&b.getClientRects().length);if(!b)throw Error('Missing button '+label);b.click();},label);await wait(100);};
const field=async(label,value)=>{await ev((label,value)=>{const e=[...document.querySelectorAll('.ia-support label')].find(e=>e.textContent.startsWith(label))?.querySelector('textarea,select');if(!e)throw Error('Missing field '+label);const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));},label,value);await wait(100);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name,Buffer.from(r.data,'base64'));};
const switchActor=async(token,url)=>{await ev((token,url)=>window.__switch(token,url),token,url);await wait(500);};
try{
 await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*supabase.co*']});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await until(()=>ev(()=>typeof window.$RefreshReg$==='function'&&performance.getEntriesByType('resource').some(e=>/react-dom_client/.test(e.name))));
 exceptions.length=0; // Discard exceptions from the previous document replayed by Runtime.enable.
 await ev(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name),R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u))),router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u))),React=R.default||R,dom=D.default||D;
  const {supabase}=await import('/src/lib/supabase.ts'),{profileService}=await import('/src/services/profile.service.ts');
  const ids={'qa-reporter':'00000000-0000-4000-8000-000000000600','qa-respondent':'00000000-0000-4000-8000-000000000601','qa-reviewer':'00000000-0000-4000-8000-000000000602','qa-appeal':'00000000-0000-4000-8000-000000000603'};
  const qa=window.__qa={token:'qa-reporter',unexpected:[],failInbox:false,failCreate:false},callbacks=[];
  const session=()=>({access_token:qa.token,user:{id:ids[qa.token],email:'qa@example.test',user_metadata:{role:'admin'},app_metadata:{}}});
  supabase.auth.getSession=async()=>({data:{session:session()},error:null});
  supabase.auth.onAuthStateChange=callback=>{callbacks.push(callback);return {data:{subscription:{unsubscribe(){const i=callbacks.indexOf(callback);if(i>=0)callbacks.splice(i,1);}}}};};
  supabase.from=()=>{throw Error('No real Supabase table access in browser fixture');};
  profileService.getMyProfile=async()=>({id:ids[qa.token],display_name:'Cuenta DEMO',first_name:'Cuenta',accessibility_preferences:{quietNotifications:true}});
  const native=fetch.bind(window);window.__nativeFetch=native;
  window.fetch=async(input,options={})=>{const url=new URL(String(input),location.origin);
   if((url.pathname.startsWith('/api/support/')||url.pathname.startsWith('/api/moderation/'))){
    if((qa.failInbox&&url.pathname.endsWith('/inbox'))||(qa.failCreate&&url.pathname.endsWith('/cases')&&options.method==='POST'))return new Response(JSON.stringify({success:false,error:'Servicio temporalmente no disponible'}),{status:503,headers:{'Content-Type':'application/json'}});
    return native('http://127.0.0.1:3002'+url.pathname+url.search,options);
   }
   if(['/api/profiles/catalog/subjects','/api/projects','/api/verification/my-requests','/api/projects/me','/api/notes/me'].includes(url.pathname))return new Response(JSON.stringify({success:true,data:[]}),{status:200,headers:{'Content-Type':'application/json'}});
   qa.unexpected.push(url.pathname);throw Error('Unexpected network call '+url.pathname);
  };
  const {AuthProvider}=await import('/src/context/AuthContext.tsx'),{CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx'),{default:AppRouter}=await import('/src/router/AppRouter.tsx');
  document.getElementById('root').style.display='none';const mount=document.createElement('div');mount.id='support-review';document.body.append(mount);
  function Capture(){window.__navigate=router.useNavigate();const location=router.useLocation();window.__location=location.pathname+location.search;window.__theme=useCalmMode().setThemeMode;return null;}
  window.__switch=(token,url)=>{qa.token=token;for(const callback of [...callbacks])callback('SIGNED_IN',session());window.__navigate(url);};
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(AuthProvider,null,React.createElement(router.MemoryRouter,{initialEntries:['/support?report=profile&target=00000000-0000-4000-8000-000000000601']},React.createElement(Capture),React.createElement(AppRouter)))));
 });
 const checkbox=async label=>{await ev(label=>{const e=[...document.querySelectorAll('.ia-support label')].find(e=>e.textContent.includes(label))?.querySelector('input[type=checkbox]');if(!e)throw Error('Missing checkbox '+label);if(!e.checked)e.click();},label);await wait(100);};
 const report=async()=>{
  await switchActor('qa-reporter','/support?report=profile&target=00000000-0000-4000-8000-000000000601');await until(async()=>/Enviar reporte privado/.test(await text()));
  await field('Qué ocurrió','Antecedente ficticio de un hecho diferente para verificar el sistema de convivencia.');await click('Enviar reporte privado');await until(async()=>/Reporte original · privado/.test(await text()));
  return '/support?case='+await ev(()=>new URLSearchParams(window.__location.split('?')[1]).get('case'));
 };
 const prepare=async(url,severity='minor')=>{
  await switchActor('qa-reviewer',url);await until(async()=>/Asumir revisión/.test(await text()));await click('Asumir revisión');await until(async()=>/Tipo de decisión/.test(await text()));
  await field('Tipo de decisión',severity);if(await ev(()=>!![...document.querySelectorAll('label')].find(e=>e.textContent.includes('este es un hecho distinto'))))await checkbox('este es un hecho distinto');
  await field('Motivo privado para la persona afectada','PRIVATE_MEASURE_REASON: antecedentes ficticios revisados y confirmados por el responsable autorizado.');
  await field('Resolución que recibirán ambas partes','Se comunica una decisión ficticia revisada según los antecedentes disponibles.');
 };
 await until(async()=>/Enviar reporte privado/.test(await text()));await ev(()=>window.__theme('light'));
 const first=await report();await prepare(first);await ev(()=>window.scrollTo(0,document.body.scrollHeight));await shot('reviewer-decision.png');
 await checkbox('Confirmo esta decisión');await click('Registrar decisión y notificar');await until(async()=>/Decisión tras revisión de antecedentes/.test(await text()));
 await switchActor('qa-respondent','/support?tab=measures');await until(async()=>/1 incumplimiento leve confirmado/.test(await text()));assert.match(await text(),/Advertencia/);
 await switchActor('qa-reporter',first);await until(async()=>/Resolución comunicada/.test(await text()));assert.doesNotMatch(await text(),/PRIVATE_MEASURE_REASON|Motivo de la apelación/);
 checks.push('A confirmed minor decision creates a private warning; reporter cannot see private reasons or consume the affected member appeal.');
 const second=await report();await prepare(second);await checkbox('Confirmo esta decisión');await click('Registrar decisión y notificar');await until(async()=>/Ofrecer tutorías y talleres/.test(await text()));
 await switchActor('qa-respondent','/support?tab=measures');await until(async()=>/2 incumplimientos leves confirmados/.test(await text()));assert.match(await text(),/Hasta/);await ev(()=>window.scrollTo(0,0));await shot('my-measures-desktop.png');
 const widths=[];for(const width of[320,390,768,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await wait(130);
  const result=await ev(()=>({body:document.body.scrollWidth,client:document.documentElement.clientWidth,section:document.querySelector('.ia-support').getBoundingClientRect().right}));assert.ok(result.body<=width&&result.section<=width+1,JSON.stringify({width,...result}));widths.push({width,...result});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1100,deviceScaleFactor:1,mobile:false});await shot('my-measures-mobile.png');await ev(()=>window.__theme('dark'));await shot('my-measures-dark.png');await ev(()=>window.__theme('calm'));await shot('my-measures-calm.png');await ev(()=>window.__theme('light'));
 checks.push('Second confirmed distinct fact shows tutoring restriction and end date; measures view fits 320/390/768/1440px and supports light, dark and Calm themes.');
 const account=await report();await prepare(account,'serious');await field('Alcance','account');await checkbox('Confirmo esta decisión');await click('Registrar decisión y notificar');await until(async()=>/Uso de la cuenta/.test(await text()));
 await switchActor('qa-respondent','/profile');await until(async()=>/Mis medidas de convivencia/.test(await text()));assert.equal(await ev(()=>window.__location),'/support?tab=measures');
 const blocked=await ev(async()=>{const r=await window.__nativeFetch('http://127.0.0.1:3002/api/recommendations/feed',{headers:{Authorization:'Bearer qa-respondent'}});return r.status;});assert.equal(blocked,403);
 await switchActor('qa-respondent',account);await until(async()=>/Motivo de la apelación/.test(await text()));await field('Motivo de la apelación','Antecedentes nuevos ficticios para la revisión independiente de la medida.');await click('Solicitar revisión independiente');await until(async()=>/Apelación pendiente/.test(await text()));
 await switchActor('qa-reviewer',account);await until(async()=>/Apelación pendiente/.test(await text()));assert.doesNotMatch(await text(),/Asumir revisión/);
 await switchActor('qa-appeal',account);await until(async()=>/Asumir revisión de apelación/.test(await text()));await click('Asumir revisión de apelación');await until(async()=>/Resultado de la revisión/.test(await text()));
 await field('Resultado de la revisión','overturn');await field('Motivo privado para la persona afectada','La revisión independiente ficticia identifica antecedentes que justifican revocar esta medida de cuenta.');await field('Resolución que recibirán ambas partes','Se revoca la decisión de este expediente tras la revisión independiente de los nuevos antecedentes.');await checkbox('Confirmo esta decisión');await click('Registrar revisión independiente');await until(async()=>/Revocada/.test(await text()));
 await switchActor('qa-respondent','/support?tab=measures');await until(async()=>/Revocada/.test(await text()));assert.doesNotMatch(await text(),/Tu cuenta tiene una restricción activa/);
 checks.push('Account restriction redirects to private support while preserving appeal; original issuer cannot take it; independent reviewer overturns it and account access is restored.');
 assert.deepEqual(exceptions,[]);assert.deepEqual(await ev(()=>window.__qa.unexpected),[]);
 fs.writeFileSync(out+'/browser-verification.json',JSON.stringify({passed:true,checks,widths,exceptions,scope:'Actual React/AppRouter -> Express -> PostgreSQL/RLS, unrelated profile bootstrap catalogs stubbed with empty arrays, all synthetic accounts. No real Supabase, Gemini or reviewer permissions.'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(error){console.error(error);console.error((await text()).slice(-4500));console.error(JSON.stringify(exceptions));process.exitCode=1;}finally{ws.close();}
