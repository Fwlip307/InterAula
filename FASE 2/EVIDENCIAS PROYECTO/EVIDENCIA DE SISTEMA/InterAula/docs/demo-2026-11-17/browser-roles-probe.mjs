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
 await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});exceptions.length=0;
 for(const [role,routes]of[
  ['diego',[['/my-tutoring?tab=requests','Valentina','solicitudes-tutor-demo.png'],['/my-tutoring?tab=offerings','[DEMO 17] Cálculo diferencial',null],['/profile?tab=tutoring','[DEMO 17] Cálculo diferencial','perfil-tutor-demo.png']]],
  ['valentina',[[resources.find(r=>r.module==='Gestionar postulaciones').path,'Agenda de estudio accesible','proyecto-propietaria-demo.png'],['/projects?tab=my_projects','Agenda de estudio accesible',null]]],
 ]){
  const account=accounts.accounts.find(a=>a.role===role);await send('Storage.clearDataForOrigin',{origin:'http://localhost',storageTypes:'local_storage'});
  await go('/login');await until(()=>ev(()=>!!document.querySelector('#login-email')));
  await ev((email,password)=>{for(const [selector,value]of[['#login-email',email],['#login-password',password]]){const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}},account.email,account.password);
  await ev(()=>document.querySelector('button[type=submit]').click());await until(()=>ev(()=>location.pathname==='/dashboard'));
  for(const [route,expected,photo]of routes){await go(route);await until(async()=>(await text()).includes(expected));await wait(350);checks.push({role,route,expected,passed:true});if(photo)await shot(photo);}
 }
 assert.deepEqual(exceptions,[]);
 fs.writeFileSync(out+'/browser-roles-verification.json',JSON.stringify({passed:true,checks,exceptions,scope:'Real production UI and fictitious Diego/Valentina accounts. No profile mocks. No request accepted, session completed or application resolved; those scenes are preserved for the team.'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(error){console.error(error.message);console.error(JSON.stringify({completed:checks,exceptions:exceptions.map(e=>e.slice(0,200))}));process.exitCode=1;}finally{ws.close();}
