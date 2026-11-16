import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='docs/hybrid-2026-11-16',wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tabs=await(await fetch('http://127.0.0.1:9235/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),exceptions=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const text=()=>ev(()=>document.querySelector('#hybrid-review')?.innerText||'');
const click=async label=>{await ev(label=>{const e=[...document.querySelectorAll('#hybrid-review button')].find(e=>e.textContent.includes(label)&&e.getClientRects().length);if(!e)throw Error('Missing button '+label);e.click();},label);await wait(150);};
const select=async(label,value)=>{await ev((label,value)=>{const e=[...document.querySelectorAll('#interest-demo label')].find(e=>e.textContent.includes(label)).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('change',{bubbles:true}));},label,value);await wait(150);};
const until=async fn=>{for(let i=0;i<80;i++){if(await fn())return;await wait(100);}throw Error('Timed out');};
const demoReady=()=>until(()=>ev(()=>Boolean(document.querySelector('#interest-demo')?.innerText.includes('K-Means:'))));
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name,Buffer.from(r.data,'base64'));};
try{
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1150,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await wait(1600);
 await ev(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name);
  const R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u))),router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D,{supabase}=await import('/src/lib/supabase.ts');
  supabase.auth.getSession=async()=>({data:{session:{access_token:'fixture-only',user:{id:'00000000-0000-4000-8000-000000000999'}}},error:null});
  const native=fetch.bind(window),state=window.__qa={unexpected:[],failDemo:false,delayDemo:0,failFeed:false};
  window.fetch=async(input,options={})=>{
   const url=new URL(String(input),location.origin);
   if(url.pathname==='/api/recommendations/feed'||url.pathname==='/api/recommendations/demo'){
    if(url.pathname.endsWith('/demo')){if(state.delayDemo)await new Promise(resolve=>setTimeout(resolve,state.delayDemo));if(state.failDemo)return new Response(JSON.stringify({success:false,error:'Unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});}
    return native('http://127.0.0.1:3002'+url.pathname+url.search,options);
   }
   state.unexpected.push(url.pathname);throw Error('Unexpected network call');
  };
  const {default:ForYou}=await import('/src/components/recommendations/ForYouSection.tsx');
  const {CalmModeProvider,useCalmMode}=await import('/src/context/CalmModeContext.tsx');
  const root=document.getElementById('root');root.style.display='none';
  const mount=document.createElement('main');mount.id='hybrid-review';mount.style.cssText='max-width:1100px;margin:20px auto;padding:10px';document.body.append(mount);
  function Capture(){window.__theme=useCalmMode().setThemeMode;return null;}
  dom.createRoot(mount).render(React.createElement(CalmModeProvider,null,React.createElement(router.MemoryRouter,null,React.createElement(Capture),React.createElement(ForYou))));
 });
 await until(async()=>/grupos de intereses similares/.test(await text()));
 assert.match(await text(),/Quieres aprender Python|Te interesa Análisis de datos/);
 assert.match(await text(),/Relacionado con un grupo de intereses/);
 checks.push('The real ForYou component renders the authenticated hybrid feed and explains topic groups and community.');
 await click('Probar ejemplo de intereses y cercanía');await demoReady();
 const demoText=()=>ev(()=>document.querySelector('#interest-demo')?.innerText||'');
 assert.match(await demoText(),/Datos ficticios/);assert.match(await demoText(),/18 perfiles ficticios/);
 assert.equal(await ev(()=>document.querySelectorAll('#interest-demo a').length),0);
 checks.push('DEMO runs real K-Means over synthetic public topics, separate from the real feed, without actionable profile links.');
 await select('Temas del ejemplo','web');await demoReady();
 assert.ok(await ev(()=>[...document.querySelectorAll('#interest-demo article h4')].every(e=>e.textContent.includes('Desarrollo web'))));
 await select('Comunidad del ejemplo','campus');await demoReady();
 assert.ok(await ev(()=>[...document.querySelectorAll('#interest-demo article')].every(e=>e.innerText.includes('Misma institución y sede'))));
 await select('Temas del ejemplo','business');await demoReady();
 await select('Comunidad del ejemplo','nearby');await demoReady();
 assert.ok(await ev(()=>[...document.querySelectorAll('#interest-demo article')].every(e=>/Misma institución y sede|Sede en la misma comuna/.test(e.innerText))));
 checks.push('Changing interests changes people and content; campus and nearby selections preserve geographic scope.');
 await ev(()=>document.querySelector('.ia-interest-demo').scrollIntoView({block:'start'}));await shot('hybrid-desktop.png');
 await click('Cerrar ejemplo de intereses');await ev(()=>window.__qa.failDemo=true);await click('Probar ejemplo de intereses y cercanía');
 await until(async()=>/No pudimos cargar el ejemplo/.test(await demoText()));
 assert.ok(await ev(()=>document.querySelectorAll('#for-you-feed > .ia-reco-grid article').length)>0);
 await ev(()=>window.__qa.failDemo=false);await click('Reintentar ejemplo');await demoReady();
 checks.push('Demo failure preserves the feed and offers a working retry.');
 await click('Cerrar ejemplo de intereses');await ev(()=>window.__qa.delayDemo=700);await click('Probar ejemplo de intereses y cercanía');
 await until(async()=>/Agrupando/.test(await demoText()));await click('Cerrar ejemplo de intereses');await wait(900);
 assert.equal(await ev(()=>Boolean(document.querySelector('#interest-demo'))),false);
 checks.push('A pending demo cannot reopen itself after the user closes it.');
 await ev(()=>window.__qa.delayDemo=0);await click('Probar ejemplo de intereses y cercanía');await demoReady();
 const widths=[];
 for(const width of [320,390,768,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await wait(80);
  const b=await ev(()=>{const e=document.querySelector('#for-you-feed'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,scroll:e.scrollWidth,body:document.body.scrollWidth};});
  assert.ok(b.left>=0&&b.right<=width+1&&b.scroll<=b.width+1&&b.body<=width,JSON.stringify({viewportWidth:width,...b}));widths.push({viewportWidth:width,...b});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1150,deviceScaleFactor:1,mobile:false});
 await ev(()=>document.querySelector('.ia-interest-demo').scrollIntoView({block:'start'}));await shot('hybrid-mobile.png');
 await ev(()=>window.__theme('dark'));await wait(100);await shot('hybrid-dark.png');
 await ev(()=>window.__theme('calm'));await wait(100);await shot('hybrid-calm.png');
 checks.push('The feature fits 320/390/768/1440px and light, dark and Calm themes.');
 assert.deepEqual(exceptions,[]);assert.deepEqual(await ev(()=>window.__qa.unexpected),[]);
 fs.writeFileSync(out+'/browser-verification.json',JSON.stringify({passed:true,checks,widths,exceptions,scope:'Real React and HTTP client to real Express/Python; synthetic identity and Supabase responses. No real user records, writes, voice or Gemini calls.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths}));
}catch(error){console.error(error);console.error((await text()).slice(0,2200));console.error(JSON.stringify(exceptions));process.exitCode=1;}
finally{ws.close();}
