import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.argv[2],out=path.join(root,'docs/inclusive-2026-11-14');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const targets=await fetch('http://127.0.0.1:9235/json/list').then(r=>r.json());
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.onopen=resolve);
let seq=0;const pending=new Map(),exceptions=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',userGesture:true,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const text=()=>ev(()=>document.querySelector('#inclusive-review')?.innerText||'');
const click=async(label)=>{await ev(label=>{const b=[...document.querySelectorAll('#inclusive-review button')].find(b=>b.textContent.includes(label));if(!b)throw Error('Missing button: '+label);b.click();},label);await sleep(160);};
try {
 await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Page.navigate',{url:'http://127.0.0.1:5175/'});await sleep(1400);
 await ev(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name);
  const R=await import(urls.find(u=>/\/\.vite\/deps\/react\.js\?/.test(u))),D=await import(urls.find(u=>/\/\.vite\/deps\/react-dom_client\.js\?/.test(u)));
  const React=R.default||R,dom=D.default||D;
  const {default:Inclusive}=await import('/src/pages/profile/components/InclusiveAccreditationSection.tsx');
  const {default:Subjects}=await import('/src/pages/profile/components/OfferedSubjectsSection.tsx');
  const {verificationService:service}=await import('/src/services/verification.service.ts');
  document.getElementById('root').style.display='none';
  const mount=document.createElement('div');mount.id='inclusive-review';mount.style.cssText='max-width:1000px;margin:24px auto;padding:16px';document.body.append(mount);
  const tree=dom.createRoot(mount),a=window.__inclusive={mine:null,user:'owner',validator:false,ready:true,failSubmit:true,uploaded:0,submitted:0,reviewed:0,reviews:[]};
  service.inclusiveStatus=async()=>({schemaReady:a.ready,hasReviewer:a.validator});
  service.isCurrentAcademicValidator=async()=>a.validator;
  service.getMyInclusiveAccreditation=async()=>a.user==='owner'?a.mine:null;
  service.getInclusiveAccreditationsForValidator=async()=>structuredClone(a.reviews);
  service.uploadInclusiveEvidence=async file=>{a.uploaded++;return {document_path:'owner/private-proof.pdf',document_filename:file.name,document_size_bytes:file.size};};
  service.requestInclusiveAccreditation=async body=>{
   a.submitted++;if(a.failSubmit)throw Error('No se pudo enviar. Puedes reintentar sin subir otro documento.');
   a.mine={id:'request',tutor_id:'owner',status:'pending',proof_version:2,...body,updated_at:new Date().toISOString()};
   return structuredClone(a.mine);
  };
  service.inclusiveEvidenceUrl=async()=>'/synthetic-private-proof.pdf';
  service.reviewInclusiveAccreditation=async(id,review)=>{a.reviewed++;const item=a.reviews.find(r=>r.id===id);Object.assign(item,review,{verified_by:'teacher',verified_at:new Date().toISOString(),updated_at:new Date().toISOString()});return structuredClone(item);};
  window.__renderInclusive=()=>tree.render(React.createElement(React.StrictMode,null,React.createElement(React.Fragment,null,
   React.createElement(Inclusive,{key:a.user,userId:a.user}),
   React.createElement(Subjects,{offeredSubjects:[{subject_id:'sql',level:'basic',is_verified:true,subject:{name:'SQL acreditado'}},{subject_id:'pending',level:'advanced',is_verified:false,subject:{name:'Materia sin acreditar'}}]}))));
  window.__renderInclusive();
 });await sleep(300);
 assert.match(await text(),/Materias habilitadas para impartir \(1\)/);
 assert.match(await text(),/SQL acreditado/);assert.equal((await text()).includes('Materia sin acreditar'),false);
 assert.equal(await ev(()=>document.querySelectorAll('#offered-subjects button').length),0);
 checks.push('Subject list includes verified subjects only; no add, remove or manual accreditation controls');
 assert.match(await text(),/permanecerá pendiente/);
 await ev(()=>{
  const values=['Formación inclusiva universitaria','Institución emisora de prueba','2026-01-01','FOLIO-123','https://issuer.example/verify/123'];
  const inputs=[...document.querySelectorAll('.ia-inclusive-form input:not([type=file])')];
  inputs.forEach((e,i)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,values[i]);e.dispatchEvent(new Event('input',{bubbles:true}));});
  const area=document.querySelector('.ia-inclusive-form textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'Prepararía una agenda breve, ofrecería participación por chat, dividiría la actividad y consultaría qué apoyos prefiere, respetando la autonomía de la persona y los límites del apoyo académico.');
  area.dispatchEvent(new Event('input',{bubbles:true}));
  const data=new DataTransfer();data.items.add(new File(['%PDF-1.4\nCertificado sintético'], 'certificado.pdf',{type:'application/pdf'}));
  const file=document.querySelector('input[type=file]');file.files=data.files;file.dispatchEvent(new Event('change',{bubbles:true}));
 });await sleep(150);
 await ev(()=>document.querySelector('.ia-inclusive-form').requestSubmit());await sleep(180);
 assert.match(await text(),/No se pudo enviar/);assert.equal(await ev(()=>window.__inclusive.uploaded),1);
 await ev(()=>{window.__inclusive.failSubmit=false;document.querySelector('.ia-inclusive-form').requestSubmit();});await sleep(180);
 assert.equal(await ev(()=>window.__inclusive.uploaded),1);assert.equal(await ev(()=>window.__inclusive.mine.status),'pending');
 assert.equal(await ev(()=>!!document.querySelector('.ia-inclusive-form')),false);
 assert.match(await text(),/Pendiente de revisión/);checks.push('Private PDF metadata and practical case submit; failed request keeps upload for retry; pending stays pending without a reviewer');
 await click('Actualizar estado');assert.match(await text(),/Pendiente de revisión/);
 await click('Consultar certificado privado');
 assert.equal(await ev(()=>document.querySelector('a[href="/synthetic-private-proof.pdf"]').target),'_blank');
 checks.push('Explicit refresh and private document link remain available to owner');
 await ev(()=>{window.__inclusive.reviews=[{...window.__inclusive.mine,profile:{display_name:'Solicitante sintético'}}];window.__inclusive.user='teacher';window.__inclusive.validator=true;window.__renderInclusive();});await sleep(240);
 const panel='details.ia-inclusive-review-queue';
 await ev(()=>document.querySelector('details.ia-inclusive-review-queue').open=true);
 assert.equal(await ev(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Aprobar evidencia')).disabled),true);
 await ev(()=>{
  document.querySelectorAll('.ia-inclusive-review fieldset input').forEach(e=>e.click());
  const area=document.querySelector('.ia-inclusive-review textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'Verifiqué la titularidad, el código con el emisor y una propuesta pertinente con apoyos concretos y respeto de la autonomía.');
  area.dispatchEvent(new Event('input',{bubbles:true}));
 });await sleep(130);
 assert.equal(await ev(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Aprobar evidencia')).disabled),false);
 await click('Aprobar evidencia');assert.equal(await ev(()=>window.__inclusive.reviewed),1);
 assert.equal(await ev(()=>window.__inclusive.reviews[0].status),'approved');
 checks.push('Independent reviewer needs four checks and a written decision; explicit approval updates review state');
 await ev(()=>{window.__inclusive.user='other';window.__inclusive.validator=false;window.__renderInclusive();});await sleep(220);
 assert.equal(await ev(()=>document.querySelector('.ia-inclusive-form input').value),'');
 checks.push('Another account receives an empty form and cannot see previous private request');
 const widths=[];
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});await sleep(80);
  const size=await ev(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(size.scrollWidth<=width,JSON.stringify(size));widths.push(size);
  if(width!==320){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'inclusive-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 checks.push('No horizontal overflow at 1440, 390 or 320px');
 await ev(()=>{window.__inclusive.ready=false;window.__renderInclusive();});await click('Actualizar estado');
 assert.equal(await ev(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enviar para revisión')).disabled),true);
 checks.push('Missing schema prevents evidence submission with explicit activation state');
 assert.deepEqual(exceptions,[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,checks,widths,exceptions,scope:'Actual React components under StrictMode; synthetic account, certificate and service responses. No real files uploaded or real requests approved.'},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,widths,exceptions}));
}catch(error){console.error(error);console.error((await text()).slice(0,1800));process.exitCode=1;}
finally{await send('Browser.close');ws.close();}
