import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='docs/reputation-2026-11-16',wait=ms=>new Promise(r=>setTimeout(r,ms));
const tabs=await(await fetch('http://127.0.0.1:9235/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map(),exceptions=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const text=()=>ev(()=>document.querySelector('#reputation-review')?.innerText||'');
const until=async fn=>{for(let i=0;i<80;i++){if(await fn())return;await wait(100);}throw Error('Timeout');};
const click=async label=>{await ev(label=>{const e=[...document.querySelectorAll('#reputation-review button,dialog button')].find(e=>e.textContent.includes(label)&&e.getClientRects().length);if(!e)throw Error('Missing button '+label);e.click();},label);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name,Buffer.from(r.data,'base64'));};
try{
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await wait(1400);
 await ev(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name),R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u))),router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D,{supabase}=await import('/src/lib/supabase.ts');
  const qa=window.__qa={token:'qa-tutor',unexpected:[],failReputation:false};
  supabase.auth.getSession=async()=>({data:{session:{access_token:qa.token}},error:null});
  const native=fetch.bind(window);
  window.fetch=async(input,options={})=>{
   const url=new URL(String(input),location.origin);
   if(url.pathname.startsWith('/api/tutoring/reputation/')||url.pathname.startsWith('/api/tutoring/sessions/')){
    if(qa.failReputation&&url.pathname.includes('/reputation/'))return new Response(JSON.stringify({success:false,error:'Unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});
    return native('http://127.0.0.1:3002'+url.pathname+url.search,options);
   }
   qa.unexpected.push(url.pathname);throw Error('Unexpected network request');
  };
  const {default:Panel}=await import('/src/components/common/TutorReputationPanel.tsx'),{default:Card}=await import('/src/pages/tutoring/components/SessionCard.tsx'),{default:Review}=await import('/src/pages/tutoring/components/ReviewModal.tsx');
  const {CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx'),{tutoringService:service}=await import('/src/services/tutoring.service.ts');
  const tutor='00000000-0000-4000-8000-000000000501',sessionId='00000000-0000-4000-8000-000000000900';
  document.getElementById('root').style.display='none';const mount=document.createElement('main');mount.id='reputation-review';mount.style.cssText='max-width:1100px;padding:10px;margin:20px auto';document.body.append(mount);
  function Harness(){
   const [session,setSession]=React.useState(null),[role,setRole]=React.useState('tutor'),[revision,setRevision]=React.useState(0),[review,setReview]=React.useState(false),[message,setMessage]=React.useState('');
   window.__theme=useCalmMode().setThemeMode;
   React.useEffect(()=>{service.getSessionById(sessionId).then(setSession);},[]);
   window.__setRole=async value=>{qa.token=value==='tutor'?'qa-tutor':'qa-student';setRole(value);setSession(await service.getSessionById(sessionId));setRevision(v=>v+1);};
   window.__reload=()=>setRevision(v=>v+1);
   const confirm=async()=>{try{const s=await service.confirmCompletion(sessionId);setSession(s);setMessage(s.status==='completed'?'Sesión validada':'Confirmación registrada; esperando al otro participante');setRevision(v=>v+1);}catch(e){setMessage(e.message);}};
   return React.createElement(React.Fragment,null,React.createElement('h1',null,'Reputación · datos ficticios de prueba'),React.createElement('p',{role:'status'},message),
    React.createElement(Panel,{profileId:tutor,own:role==='tutor',key:revision}),
    session&&React.createElement(Card,{session,role,onComplete:confirm,onReview:()=>setReview(true)}),
    React.createElement(Review,{session,isOpen:review,onClose:()=>setReview(false),onSuccess:async()=>{setSession(await service.getSessionById(sessionId));setRevision(v=>v+1);}}));
  }
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(router.MemoryRouter,null,React.createElement(Harness))));
 });
 await until(async()=>/Reconocimiento de calidad activo/.test(await text()));
 assert.equal(await ev(()=>document.querySelectorAll('.ia-reputation-highlight').length),3);
 assert.match(await text(),/10.*reseñas de.*5.*estudiantes/);
 checks.push('The real panel renders SQL quality aggregates, sample sizes and transparent policy.');
 await shot('reputation-desktop.png');
 await click('Confirmar realización');await until(async()=>/Confirmación registrada/.test(await text()));
 assert.match(await text(),/Confirmado · esperando al otro participante/);
 checks.push('One participant confirmation persists but does not complete an unverified session.');
 await ev(()=>window.__setRole('student'));await until(async()=>!/Confirmado · esperando/.test(await text()));
 await click('Confirmar realización');await until(async()=>/Sesión validada para trayectoria y calidad/.test(await text()));
 assert.match(await text(),/Evaluar Tutor/);checks.push('The second participant confirms through real HTTP and the PostgreSQL RPC, unlocking the review.');
 await click('Evaluar Tutor');await until(()=>ev(()=>Boolean(document.querySelector('dialog[open]'))));
 await ev(()=>{for(const e of document.querySelectorAll('dialog select')){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'1');e.dispatchEvent(new Event('change',{bubbles:true}));}});
 await click('Guardar valoración');await until(()=>ev(()=>!document.querySelector('dialog[open]')));
 await until(()=>ev(()=>document.querySelector('.ia-reputation')?.innerText.includes('11 reseñas')));
 assert.equal(await ev(()=>document.querySelectorAll('.ia-reputation-highlight').length),0);
 assert.match(await text(),/Una nota baja no borra la trayectoria ni suspende la cuenta/);
 checks.push('A real low-score review updates PostgreSQL, deactivates recent quality and preserves the completed session.');
 await ev(()=>window.__qa.failReputation=true);await ev(()=>window.__reload());await until(async()=>/No pudimos cargar la reputación/.test(await text()));
 await ev(()=>window.__qa.failReputation=false);await click('Reintentar reputación');await until(async()=>/11 reseñas/.test(await text()));
 checks.push('A reputation fetch error offers retry without pretending there are no reviews.');
 const widths=[];
 for(const width of[320,390,768,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await wait(80);const b=await ev(()=>{const e=document.querySelector('.ia-reputation'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,scroll:e.scrollWidth};});assert.ok(b.left>=0&&b.right<=width+1&&b.scroll<=b.width+1,JSON.stringify(b));widths.push({viewportWidth:width,...b});}
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1100,deviceScaleFactor:1,mobile:false});await ev(()=>document.querySelector('.ia-reputation').scrollIntoView({block:'start'}));await shot('reputation-mobile.png');
 await ev(()=>window.__theme('dark'));await wait(100);await shot('reputation-dark.png');await ev(()=>window.__theme('calm'));await wait(100);await shot('reputation-calm.png');
 checks.push('Reputation fits 320/390/768/1440px in light, dark and Calm themes.');
 assert.deepEqual(exceptions,[]);assert.deepEqual(await ev(()=>window.__qa.unexpected),[]);
 fs.writeFileSync(out+'/browser-verification.json',JSON.stringify({passed:true,checks,widths,scope:'Real React, HTTP client, Express and PostgreSQL-in-memory with synthetic accounts. No real user data, Supabase writes or Gemini calls.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths}));
}catch(error){console.error(error);console.error((await text()).slice(0,2300));process.exitCode=1;}finally{ws.close();}
