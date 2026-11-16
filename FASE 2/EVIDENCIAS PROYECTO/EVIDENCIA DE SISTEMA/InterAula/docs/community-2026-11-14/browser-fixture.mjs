import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),root=process.argv[2],out=path.join(root,'docs/community-2026-11-14');
fs.mkdirSync(out,{recursive:true});
const targets=await fetch('http://127.0.0.1:9235/json/list').then(r=>r.json());
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),exceptions=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const text=()=>ev(()=>document.getElementById('community-review').innerText);
const checks=[];
try {
 await send('Runtime.enable');await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await sleep(1800);
 await ev(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name);
  const R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D;
  const router=await import(urls.find(u=>/\/\.vite\/deps\/react-router-dom\.js\?/.test(u)));
  const {default:Community}=await import('/src/pages/AcademicCommunity.tsx');
  const {default:Search}=await import('/src/components/layout/GlobalNavigationSearch.tsx');
  const {recommendationsService:service}=await import('/src/services/recommendations.service.ts');
  const {getAllInstitutions}=await import('/src/data/institutionsAndCareers.ts');
  const institution=getAllInstitutions().find(i=>i.name.includes('DUOC'));
  window.__fixture={preferences:{institutionId:null,campusId:null,scope:'all',modality:'any'},activationRequired:false,failSave:false,failGet:false,saved:0,selectedInstitution:institution};
  service.getCommunity=async()=>{if(window.__fixture.failGet)throw Error('Unavailable');return structuredClone({preferences:window.__fixture.preferences,activationRequired:window.__fixture.activationRequired});};
  service.saveCommunity=async pref=>{if(window.__fixture.failSave)throw Error('No se pudo guardar la selección de prueba.');window.__fixture.preferences=structuredClone(pref);window.__fixture.saved++;return {preferences:structuredClone(pref),activationRequired:false};};
  document.getElementById('root').style.display='none';
  const mount=document.createElement('div');mount.id='community-review';document.body.append(mount);window.__reviewRoot=dom.createRoot(mount);
  window.__renderCommunity=()=>window.__reviewRoot.render(React.createElement(router.MemoryRouter,{key:Math.random(),initialEntries:['/community']},React.createElement(React.Fragment,null,React.createElement(Search,{onOpen:()=>{}}),React.createElement(Community))));
  window.__voice={React,router,dom};
  window.__renderCommunity();
 });await sleep(650);
 assert.match(await text(),/Mi comunidad académica/);
 assert.equal(await ev(()=>document.querySelector('input[value=campus]').disabled),true);
 await ev(()=>{const select=document.querySelector('.ia-community-fields select');select.value=window.__fixture.selectedInstitution.id;select.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(120);
 await ev(()=>{const select=document.querySelectorAll('.ia-community-fields select')[1];select.value=window.__fixture.selectedInstitution.sedes[0].id;select.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(120);
 await ev(()=>document.querySelector('input[value=nearby]').click());
 await ev(()=>{window.__fixture.failSave=true;document.querySelector('.ia-community-page button[type=submit]').click();});await sleep(180);
 assert.match(await text(),/No se pudo guardar/);assert.equal(await ev(()=>window.__fixture.saved),0);
 assert.equal(await ev(()=>document.querySelector('input[value=nearby]').checked),true);
 await ev(()=>{window.__fixture.failSave=false;document.querySelector('.ia-community-page button[type=submit]').click();});await sleep(180);
 assert.equal(await ev(()=>window.__fixture.preferences.scope),'nearby');assert.match(await text(),/Guardamos tu comunidad/);
 checks.push('Institution and campus selection, nearby commune, failed save keeps choices, successful save');
 await ev(()=>window.__renderCommunity());await sleep(200);
 assert.equal(await ev(()=>document.querySelector('input[value=nearby]').checked),true);
 checks.push('Saved preferences reload');
 await ev(()=>document.querySelector('.ia-global-search-trigger').click());await sleep(130);
 await ev(()=>{const input=document.querySelector('.ia-global-search-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'comunidad');input.dispatchEvent(new Event('input',{bubbles:true}));});await sleep(120);
 assert.equal(await ev(()=>document.querySelector('[role=option]').dataset.destination),'community');
 await ev(()=>document.querySelector('[data-destination=community]').click());await sleep(200);
 assert.equal(await ev(()=>document.querySelector('dialog').open),false);checks.push('Global search opens community');
 const widths=[];
 for(const width of [1440,960,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<700});await sleep(100);
  const size=await ev(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(size.scrollWidth<=width,JSON.stringify(size));widths.push(size);
  if(width===1440||width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,width===1440?'community-desktop.png':'community-mobile.png'),Buffer.from(shot.data,'base64'));}
 }
 checks.push('No overflow at 1440, 960, 390 and 320px');
 await ev(()=>{window.__fixture.activationRequired=true;window.__renderCommunity();});await sleep(180);
 assert.equal(await ev(()=>document.querySelector('.ia-community-page button[type=submit]').disabled),true);checks.push('Missing activation has an explicit state');
 await ev(()=>{window.__fixture.preferences={institutionId:null,campusId:null,scope:'all',modality:'any'};window.__fixture.activationRequired=false;window.__renderCommunity();});await sleep(180);
 assert.equal(await ev(()=>document.querySelector('.ia-community-fields select').value),'');checks.push('Another account receives its own preferences');
 await ev(async()=>{
  const {React}=window.__voice;
  window.__speech={active:false,stopCalls:0,inserted:''};
  window.SpeechRecognition=class{start(){window.__speech.active=true;window.__recognizer=this;}stop(){window.__speech.active=false;window.__speech.stopCalls++;this.onend?.();}};
  const {default:Voice}=await import('/src/components/common/VoiceDictationButton.tsx');
  window.__reviewRoot.render(React.createElement(Voice,{onInsertText:text=>{window.__speech.inserted=text;}}));
 });await sleep(150);
 await ev(()=>[...document.querySelectorAll('#community-review button')].find(b=>b.textContent.includes('Dictar')).click());
 await ev(()=>{const result=[{transcript:'Texto de prueba'}];result.isFinal=true;window.__recognizer.onresult({resultIndex:0,results:[result]});});await sleep(100);
 await ev(()=>[...document.querySelectorAll('#community-review button')].find(b=>b.textContent.includes('Insertar texto')).click());await sleep(100);
 assert.deepEqual(await ev(()=>window.__speech),{active:false,stopCalls:1,inserted:'Texto de prueba'});
 checks.push('Confirming dictation stops recognition and inserts text');
 assert.deepEqual(exceptions,[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,scope:'Actual components with synthetic account/service responses and simulated microphone; no Supabase mutations'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths,exceptions}));
} finally {await send('Browser.close');ws.close();}

