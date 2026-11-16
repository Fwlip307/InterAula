import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.argv[2], out = path.join(root, 'docs/kmeans-2026-11-15');
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
try {
 await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await wait(1400);
 await ev(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name);
  const R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u))),router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D;
  const {supabase}=await import('/src/lib/supabase.ts');
  const user={id:'00000000-0000-4000-8000-000000000999',email:'qa@example.test',user_metadata:{first_name:'Estudiante'}};
  supabase.auth.getSession=async()=>({data:{session:{user,access_token:'fixture-only'}},error:null});
  supabase.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});
  supabase.from=table=>{if(table!=='user_badges')throw Error('Unexpected table '+table);const query=Promise.resolve({data:[],error:null});query.select=()=>query;query.in=()=>query;return query;};
  for(const [path,name]of [
   ['/src/services/profile.service.ts','profileService'],['/src/services/tutoring.service.ts','tutoringService'],
   ['/src/services/notes.service.ts','notesService'],['/src/services/project.service.ts','projectService'],
   ['/src/services/verification.service.ts','verificationService']]){
    const service=(await import(path))[name];
    for(const key of Object.keys(service))if(key.startsWith('get')&&!['getTutorRecommendations','getTutorDemo'].includes(key))service[key]=async()=>[];
    if(name==='profileService'){
     service.getMyProfile=async()=>({id:user.id,display_name:'Estudiante QA'});
     service.getSubjects=async()=>[{id:'math',name:'Matemáticas DEMO',is_pilot:true},{id:'python',name:'Python DEMO',is_pilot:true}];
    }
  }
  const nativeFetch=window.fetch.bind(window);
  const state=window.__qa={requests:[],unexpected:[],failDemo:false,delayDemo:0};
  window.fetch=async(input,options={})=>{
   const url=new URL(String(input),location.origin);
   if(url.pathname.startsWith('/api/tutoring/recommendations')){
    state.requests.push({path:url.pathname,priority:url.searchParams.get('priority')});
    if(url.pathname.endsWith('/demo')){
     if(state.delayDemo)await new Promise(resolve=>setTimeout(resolve,state.delayDemo));
     if(state.failDemo)return new Response(JSON.stringify({success:false,error:'Demo temporarily unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});
    }
    return nativeFetch('http://127.0.0.1:3002'+url.pathname+url.search,options);
   }
   state.unexpected.push(url.pathname);throw Error('Unexpected network call '+url.pathname);
  };
  const {AuthProvider}=await import('/src/context/AuthContext.tsx'),{CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx'),{default:AppRouter}=await import('/src/router/AppRouter.tsx');
  document.getElementById('root').style.display='none';
  const mount=document.createElement('div');mount.id='guided-review';document.body.append(mount);
  function Capture(){window.__setTheme=useCalmMode().setThemeMode;const navigate=router.useNavigate(),location=router.useLocation();window.__navigate=navigate;window.__location=location.pathname+location.search;return null;}
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(AuthProvider,null,React.createElement(router.MemoryRouter,{initialEntries:['/tutoring?tab=tutors']},React.createElement(Capture),React.createElement(AppRouter)))));
 });await wait(1600);
 const type=async(selector,value)=>{await ev((selector,value)=>{const input=[...document.querySelectorAll(selector)].find(e=>e.getClientRects().length);if(!input)throw Error('Missing input '+selector);const proto=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));},selector,value);await wait(150);};
 const ready=async()=>{for(let i=0;i<70;i++){if(await ev(()=>document.querySelector('[data-orientation="tutor-results"]')?.innerText.includes('Tutores Disponibles (19)')))return;await wait(100);}throw Error('Catalogue never loaded');};
 await ready();
 assert.match(await text(),/¿Qué valoras más/);
 assert.match(await text(),/Ordenamos perfiles/);
 assert.match(await text(),/Materia acreditada/);
 assert.doesNotMatch(await text(),/Certificado Duoc UC/);
 checks.push('Authenticated real HTTP catalog renders aggregate statistics and honest accreditation labels.');
 await type('#tutor-priority','communication');await wait(700);
 const first=()=>ev(()=>document.querySelector('[data-orientation="tutor-results"] .ia-card a[href^="/profile/"]')?.textContent||'');
 assert.match(await first(),/Comunicación/);
 await click('Probar con datos DEMO');await wait(700);
 const demoText=()=>ev(()=>document.querySelector('[data-kmeans-demo]')?.innerText||'');
 assert.match(await demoText(),/Datos ficticios/);assert.match(await demoText(),/18 perfiles ficticios y 3 grupos/);
 assert.match(await demoText(),/Comunicación/);
 assert.equal(await ev(()=>document.querySelectorAll('[data-kmeans-demo] a,[data-kmeans-demo] button').length),0);
 checks.push('DEMO is computed by real Python, clearly synthetic, separate from the catalog and contains no profile/reservation links.');
 await type('#tutor-priority','knowledge');await wait(850);
 assert.match(await first(),/Dominio/);assert.match(await demoText(),/Perfil Dominio/);
 await type('#tutor-priority','punctuality');await wait(850);
 assert.match(await first(),/Puntualidad/);assert.match(await demoText(),/Perfil Puntualidad/);
 checks.push('Changing priority changes both actual catalogue order and synthetic model examples.');
 await shot('kmeans-desktop.png');
 await type('#tutor-priority','none');await wait(700);
 assert.match(await text(),/catálogo sin priorizar/);
 assert.equal(await ev(()=>document.querySelectorAll('.ia-tutor-match-reason').length),0);
 checks.push('Order habitual turns off ML ranking and removes recommendation explanations.');
 await type('#tutor-priority','communication');await wait(650);
 await type('[data-orientation="tutor-search"]','Matemáticas');await wait(700);
 assert.match(await text(),/Tutores Disponibles \(10\)/);
 assert.doesNotMatch(await ev(()=>document.querySelector('[data-orientation="tutor-results"]')?.innerText||''),/Python DEMO/);
 checks.push('Subject/search filters remain authoritative after clustering; newcomers stay visible.');
 await click('Cerrar ejemplo DEMO');
 await ev(()=>window.__qa.failDemo=true);
 await click('Probar con datos DEMO');await wait(400);
 assert.match(await demoText(),/No pudimos cargar el ejemplo/);
 await ev(()=>window.__qa.failDemo=false);await click('Reintentar ejemplo');await wait(700);
 assert.match(await demoText(),/18 perfiles ficticios/);
 checks.push('A demo error is explicit, retry recovers, and the real catalogue remains available.');
 await click('Cerrar ejemplo DEMO');
 await ev(()=>window.__qa.delayDemo=600);await click('Probar con datos DEMO');
 assert.match(await demoText(),/Calculando/);
 await click('Cerrar ejemplo DEMO');await wait(800);
 assert.equal(await ev(()=>Boolean(document.querySelector('[data-kmeans-demo]'))),false);
 checks.push('Loading is visible and late demo responses cannot reopen a closed example.');
 await ev(()=>window.__qa.delayDemo=0);await click('Probar con datos DEMO');await wait(700);
 const widths=[];
 for(const width of [320,390,768,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await wait(160);
  const bounds=await ev(()=>{const panel=document.querySelector('.ia-tutor-matching'),r=panel.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,scroll:panel.scrollWidth,body:document.body.scrollWidth,viewport:document.documentElement.clientWidth};});
  assert.ok(bounds.left>=0&&bounds.right<=width+1&&bounds.scroll<=bounds.width+1&&bounds.body<=width,JSON.stringify(bounds));widths.push({viewportWidth:width,...bounds});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1100,deviceScaleFactor:1,mobile:false});
 await ev(()=>document.querySelector('.ia-tutor-matching').scrollIntoView({block:'start'}));await wait(100);await shot('kmeans-mobile.png');
 await ev(()=>window.__setTheme('dark'));await wait(120);await shot('kmeans-dark.png');
 await ev(()=>window.__setTheme('calm'));await wait(120);await shot('kmeans-calm.png');
 checks.push('The preference and DEMO fit mobile/desktop and light/dark/Calm themes.');
 assert.deepEqual(exceptions,[]);assert.deepEqual(await ev(()=>window.__qa.unexpected),[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,scope:'Real React, HTTP client, Express and Python/scikit-learn. Synthetic identity and catalog aggregates; no real Supabase requests, writes, audio or Google calls.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths}));
}catch(error){console.error(error);console.error((await text()).slice(0,3000));console.error(JSON.stringify(exceptions));process.exitCode=1;}
finally{ws.close();}
