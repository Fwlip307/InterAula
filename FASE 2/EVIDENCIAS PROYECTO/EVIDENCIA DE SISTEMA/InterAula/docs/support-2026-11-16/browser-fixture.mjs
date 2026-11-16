import fs from 'node:fs';import assert from 'node:assert/strict';
const out='docs/support-2026-11-16',wait=ms=>new Promise(r=>setTimeout(r,ms));
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
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await wait(1400);
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
  const native=fetch.bind(window);
  window.fetch=async(input,options={})=>{const url=new URL(String(input),location.origin);
   if(url.pathname.startsWith('/api/support/')){
    if((qa.failInbox&&url.pathname.endsWith('/inbox'))||(qa.failCreate&&url.pathname.endsWith('/cases')&&options.method==='POST'))return new Response(JSON.stringify({success:false,error:'Servicio temporalmente no disponible'}),{status:503,headers:{'Content-Type':'application/json'}});
    return native('http://127.0.0.1:3002'+url.pathname+url.search,options);
   }
   qa.unexpected.push(url.pathname);throw Error('Unexpected network call '+url.pathname);
  };
  const {AuthProvider}=await import('/src/context/AuthContext.tsx'),{CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx'),{default:AppRouter}=await import('/src/router/AppRouter.tsx');
  document.getElementById('root').style.display='none';const mount=document.createElement('div');mount.id='support-review';document.body.append(mount);
  function Capture(){window.__navigate=router.useNavigate();const location=router.useLocation();window.__location=location.pathname+location.search;window.__theme=useCalmMode().setThemeMode;return null;}
  window.__switch=(token,url)=>{qa.token=token;for(const callback of [...callbacks])callback('SIGNED_IN',session());window.__navigate(url);};
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(AuthProvider,null,React.createElement(router.MemoryRouter,{initialEntries:['/support?report=session&target=00000000-0000-4000-8000-000000000610']},React.createElement(Capture),React.createElement(AppRouter)))));
 });
 await until(async()=>/Enviar reporte privado/.test(await text()));await ev(()=>window.__theme('light'));
 assert.doesNotMatch(await text(),/Revisión autorizada/);
 await field('Motivo','agreement');await field('Qué ocurrió','BROWSER_PRIVATE_REPORT: descripción ficticia que solo debería leer el equipo y quien reportó.');await click('Enviar reporte privado');
 await until(async()=>/Reporte original · privado/.test(await text()));
 const caseId=await ev(()=>new URLSearchParams(window.__location.split('?')[1]).get('case')),url='/support?case='+caseId;
 assert.match(await text(),/Pendiente de asignación/);checks.push('Authenticated report creation uses the real form/API/SQL and remains pending; injected user metadata does not grant reviewer access.');
 await switchActor('qa-respondent',url);await until(async()=>/No tienes acceso/.test(await text()));assert.doesNotMatch(await text(),/BROWSER_PRIVATE_REPORT/);
 await switchActor('qa-reviewer',url);await until(async()=>/Asumir revisión/.test(await text()));await click('Asumir revisión');await until(async()=>/Mensaje que se compartirá/.test(await text()));
 await field('Nota interna del equipo','BROWSER_PRIVATE_INTERNAL: nota reservada para los revisores autorizados.');await click('Guardar nota interna');await until(async()=>/BROWSER_PRIVATE_INTERNAL/.test(await text()));
 await field('Mensaje que se compartirá','BROWSER_PUBLIC_SUMMARY: necesitamos aclarar los acuerdos de la sesión reportada.');await click('Compartir resumen y pedir respuesta');await until(async()=>/Esperando antecedentes/.test(await text()));
 await switchActor('qa-respondent',url);await until(async()=>/BROWSER_PUBLIC_SUMMARY/.test(await text()));assert.doesNotMatch(await text(),/BROWSER_PRIVATE_REPORT|BROWSER_PRIVATE_INTERNAL/);
 await field('Antecedentes para el equipo','BROWSER_PRIVATE_RESPONSE: versión ficticia destinada únicamente al equipo revisor.');await click('Enviar al equipo');await until(async()=>/BROWSER_PRIVATE_RESPONSE/.test(await text()));
 await switchActor('qa-reporter',url);await until(async()=>/BROWSER_PRIVATE_REPORT/.test(await text()));assert.doesNotMatch(await text(),/BROWSER_PRIVATE_RESPONSE|BROWSER_PRIVATE_INTERNAL/);
 checks.push('Original report, participant replies and team notes stay private; only the reviewed summary is shared with the respondent.');
 await switchActor('qa-reviewer',url);await until(async()=>/BROWSER_PRIVATE_RESPONSE/.test(await text()));await field('Mensaje que se compartirá','BROWSER_RESOLUTION: se revisaron los acuerdos y se comunicó una resolución sin sanciones automáticas.');await click('Comunicar resolución');await until(async()=>/Resolución comunicada/.test(await text()));
 await switchActor('qa-reporter',url);await until(async()=>/Motivo de la apelación/.test(await text()));await field('Motivo de la apelación','BROWSER_APPEAL: solicito revisar la resolución con nuevos antecedentes ficticios.');await click('Solicitar revisión independiente');await until(async()=>/Apelación pendiente/.test(await text()));
 await switchActor('qa-reviewer',url);await until(async()=>/Apelación pendiente/.test(await text()));assert.doesNotMatch(await text(),/Asumir revisión/);
 await switchActor('qa-appeal',url);await until(async()=>/Asumir revisión de apelación/.test(await text()));await click('Asumir revisión de apelación');await until(async()=>/Mensaje que se compartirá/.test(await text()));
 await field('Mensaje que se compartirá','BROWSER_APPEAL_RESOLUTION: otro revisor examinó los antecedentes y explicó el cierre independiente.');await click('Cerrar con explicación');await until(async()=>/Cerrada/.test(await text()));
 await switchActor('qa-reporter',url);await until(async()=>/BROWSER_APPEAL_RESOLUTION/.test(await text()));assert.doesNotMatch(await text(),/Solicitar revisión independiente/);
 checks.push('The first reviewer cannot take the appeal; a distinct authorized reviewer closes it and further appeal is disabled.');
 await ev(()=>window.scrollTo(0,0));await shot('support-case-desktop.png');
 await click('Avisos');await until(async()=>/Tu bandeja/.test(await text()));assert.doesNotMatch(await text(),/BROWSER_PRIVATE_REPORT|BROWSER_PRIVATE_INTERNAL|BROWSER_PRIVATE_RESPONSE/);
 await click('Marcar todos como leídos');await until(async()=>/Tu bandeja · 0 sin leer/.test(await text()));
 checks.push('Own inbox contains only generic notices and marking read updates its count without disclosing case text.');
 await ev(()=>window.__qa.failInbox=true);await click('Actualizar avisos');await until(async()=>/Servicio temporalmente/.test(await text()));await ev(()=>window.__qa.failInbox=false);await click('Actualizar seguimiento');await until(async()=>/Tu bandeja · 0/.test(await text()));
 checks.push('Inbox errors are explicit and retry recovers.');
 await switchActor('qa-reporter','/support?report=profile&target=00000000-0000-4000-8000-000000000604');await until(async()=>/Qué ocurrió/.test(await text()));await field('Qué ocurrió','UNSENT_DRAFT: esta descripción ficticia debe conservarse si falla el envío.');await ev(()=>window.__qa.failCreate=true);await click('Enviar reporte privado');await until(async()=>/Servicio temporalmente/.test(await text()));
 assert.equal(await ev(()=>document.querySelector('.ia-support textarea')?.value),'UNSENT_DRAFT: esta descripción ficticia debe conservarse si falla el envío.');await ev(()=>window.__qa.failCreate=false);
 checks.push('Failed report submission preserves the user draft.');
 const widths=[];
 for(const width of[320,390,768,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await wait(180);const b=await ev(()=>{const e=document.querySelector('.ia-support'),r=e.getBoundingClientRect();const controls=[...document.querySelectorAll('#support-review .ia-navbar-inner a,#support-review .ia-navbar-inner button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().right);return {left:r.left,right:r.right,width:r.width,scroll:e.scrollWidth,body:document.body.scrollWidth,clientWidth:document.documentElement.clientWidth,navRight:Math.max(...controls)};});assert.ok(b.left>=0&&b.right<=width+1&&b.scroll<=b.width+1&&b.body<=width&&b.navRight<=b.clientWidth+1,JSON.stringify({viewportWidth:width,...b}));widths.push({viewportWidth:width,...b});}
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1100,deviceScaleFactor:1,mobile:false});await ev(()=>window.scrollTo(0,0));await shot('support-mobile.png');await ev(()=>window.__theme('dark'));await wait(100);await shot('support-dark.png');await ev(()=>window.__theme('calm'));await wait(100);await shot('support-calm.png');
 checks.push('The full app layout, visible inbox access and forms fit 320/390/768/1440px and light/dark/Calm themes.');
 await switchActor('qa-reporter','/support?report=constructor&target=00000000-0000-4000-8000-000000000604');await until(async()=>/Tu seguimiento/.test(await text()));assert.doesNotMatch(await text(),/Enviar reporte privado/);
 assert.deepEqual(exceptions,[]);assert.deepEqual(await ev(()=>window.__qa.unexpected),[]);
 fs.writeFileSync(out+'/browser-verification.json',JSON.stringify({passed:true,checks,widths,exceptions,scope:'Real AppRouter, auth context, React UI and HTTP client -> Express -> PostgreSQL/RLS in memory. Synthetic accounts/reviewer appointments only; no real Supabase or email/Google requests.'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,widths}));
}catch(error){console.error(error);console.error((await text()).slice(0,3500));console.error(JSON.stringify(exceptions));process.exitCode=1;}finally{ws.close();}
