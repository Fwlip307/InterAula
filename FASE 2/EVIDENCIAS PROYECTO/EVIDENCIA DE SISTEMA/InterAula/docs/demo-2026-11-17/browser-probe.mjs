// Real production UI + configured backend/Supabase; only the dedicated Camila account.
import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';
const out='docs/demo-2026-11-17',accounts=JSON.parse(fs.readFileSync(out+'/CUENTAS_PRIVADAS.local','utf8'));
const camila=accounts.accounts.find(a=>a.role==='camila'),teacher=accounts.accounts.find(a=>a.role==='diego');
const resources=JSON.parse(fs.readFileSync(out+'/recorrido.json','utf8'));
const tabs=await(await fetch('http://127.0.0.1:9235/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map(),exceptions=[],checks=[];ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(fn,...args)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error('Browser evaluation failed');return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await wait(200);}throw Error('Timeout waiting for demo screen');};
const go=async url=>{await send('Page.navigate',{url:'http://localhost'+url});await wait(450);};
const text=()=>ev(()=>document.body.innerText);
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name,Buffer.from(r.data,'base64'));};
try{
 await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Storage.clearDataForOrigin',{origin:'http://localhost',storageTypes:'local_storage'});
 await go('/login');await until(()=>ev(()=>!!document.querySelector('#login-email')));exceptions.length=0;
 await ev((email,password)=>{for(const [selector,value]of[['#login-email',email],['#login-password',password]]){const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}},camila.email,camila.password);
 await ev(()=>document.querySelector('button[type=submit]').click());await until(()=>ev(()=>location.pathname==='/dashboard'));
 if(process.argv.includes('--room-only')){const room=resources.find(r=>r.module==='Aula virtual: preparación');await go(room.path);await until(async()=>(await text()).includes('Entrar al Aula Virtual'));await shot('aula-preview-demo.png');assert.deepEqual(exceptions,[]);fs.writeFileSync(out+'/room-preview-verification.json',JSON.stringify({passed:true,scope:'Real Camila DEMO login and authorized room preview; did not enter Jitsi or grant media access.'},null,2));console.log('Room preview passed');ws.close();process.exit(0);}
 const routes=[
  ['/dashboard','Para ti','inicio-demo.png'],['/learning-space?tab=paths','De funciones a derivadas',null],['/learning-space?tab=tasks','Preparar mi próxima tutoría','tareas-demo.png'],['/learning-space?tab=adaptive','Regla de la cadena','adaptativo-demo.png'],
  ['/learning-space?tab=profile','[DEMO 17] Cálculo diferencial',null],['/tutoring?tab=tutors&search=DEMO','[DEMO] Diego Tutor','tutor-demo.png'],['/tutoring?tab=my_classes','[DEMO 17]',null],['/tutoring?tab=workshops','[DEMO 17] Derivadas paso a paso',null],
  [resources.find(r=>r.module==='Material de Cálculo').path,'Derivar paso a paso','material-demo.png'],['/resources?tab=mine','Mis dudas privadas',null],[resources.find(r=>r.module==='Foro').path,'Cómo reconozco una función compuesta',null],
  [resources.find(r=>r.module==='Equipo y entregables').path,'Agenda de estudio accesible','proyecto-demo.png'],['/support','Tu bandeja',null],['/profile?tab=interests','Me interesa',null],['/settings#notifications','Correos de tutorías y talleres',null],['/profile/'+teacher.id,'[DEMO] Diego Tutor',null],['/my-tutoring?tab=student_sessions','Confirmar realización',null],
 ];
 for(const [route,expected,photo]of routes){
  await go(route);await until(async()=> (await text()).includes(expected));await wait(400);
  assert.ok(!await ev(()=>!!document.querySelector('vite-error-overlay')));assert.ok((await text()).length>150);
  checks.push({route,passed:true,expected});if(photo)await shot(photo);
 }
 await go('/learning-space?tab=adaptive');await until(async()=>/Regla de la cadena/.test(await text()));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1050,deviceScaleFactor:1,mobile:false});await wait(300);
 const size=await ev(()=>({body:document.body.scrollWidth,viewport:window.innerWidth}));assert.ok(size.body<=size.viewport);await shot('adaptativo-movil-demo.png');
 checks.push({name:'Ruta adaptativa en móvil',passed:true,...size});
 // The local rehearsal guide contains no account credentials or access tokens.
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:pathToFileURL(path.resolve(out,'RECORRIDO_DEMO.html')).href});
 await until(()=>ev(()=>document.querySelectorAll('.case').length===26));
 await ev(()=>document.querySelector('.case input').click());assert.match(await text(),/1 de 26 pruebas ensayadas/);await ev(()=>document.querySelector('#reset').click());await shot('recorrido-demo.png');
 checks.push({name:'Guía local y marcas de ensayo',passed:true});
 assert.deepEqual(exceptions,[]);
 fs.writeFileSync(out+'/browser-verification.json',JSON.stringify({passed:true,checks,exceptions,scope:'Production React UI in Docker, actual login of the dedicated fictitious Camila identity, configured Express and Supabase. No auth or application API mocks. Screenshots exclude login credentials. No session was completed and no review was submitted.'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(error){console.error(error.message);console.error(JSON.stringify({completed:checks.map(c=>c.route||c.name),exceptions:exceptions.map(e=>e.slice(0,250))}));process.exitCode=1;}finally{ws.close();}
