import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
const root=path.resolve(import.meta.dirname,'../../..');dotenv.config({path:path.join(root,'backend/.env')});
const out=path.join(root,'docs/demo-2026-11-17'),seed='interaula-demo-presentacion-v1';
const file=JSON.parse(await fs.readFile(path.join(out,'CUENTAS_PRIVADAS.local'),'utf8'));
if(file.dataset!==seed)throw Error('Archivo de cuentas inesperado.');
const admin=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const checks:any[]=[],base='http://localhost';
function dataId(label:string){const h=crypto.createHash('md5').update(seed+':'+label).digest('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
async function login(role:string){
 const account=file.accounts.find((a:any)=>a.role===role);if(!account?.id)throw Error('Falta una cuenta ficticia.');
 const client=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.signInWithPassword({email:account.email,password:account.password});
 if(error||data.user?.id!==account.id||data.user?.app_metadata?.interaula_demo_set!==seed)throw Error('No se pudo verificar una identidad DEMO.');
 return {client,account,token:data.session!.access_token};
}
async function call(actor:any,name:string,url:string,expect:(v:any)=>boolean=()=>true,options:RequestInit={}){
 try{
  const response=await fetch(base+url,{...options,headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(35000)});
  const json:any=await response.json();const data=json.data??json;const passed=response.ok&&expect(data);
  checks.push({name,role:actor.account.role,status:response.status,passed});return passed?data:null;
 }catch{checks.push({name,role:actor.account.role,status:0,passed:false});return null;}
}
try{
 const camila=await login('camila'),diego=await login('diego'),valentina=await login('valentina');
 for(const actor of [camila,diego,valentina]){
  const {error}=await actor.client.from('profiles').update({display_name:actor.account.name}).eq('id',actor.account.id);if(error)throw Error('No se pudo nombrar el perfil DEMO.');
 }
 const online=await diego.client.from('tutoring_sessions').update({modality:'online'}).eq('id',dataId('session:live')).eq('tutor_id',diego.account.id).eq('status','accepted');if(online.error)throw Error('No se pudo preparar la previsualización del aula DEMO.');
 // Canonical config uses string[]; repair only this owned demo config if an older seed used objects.
 const {data:profile,error}=await camila.client.from('profiles').select('learning_space_config').eq('id',camila.account.id).single();
 if(error)throw Error('No se pudo consultar la configuración de la cuenta DEMO.');
 if(profile.learning_space_config?.subjectsToReinforce?.some((v:any)=>typeof v!=='string')){
  const {error}=await camila.client.from('profiles').update({learning_space_config:{...profile.learning_space_config,subjectsToReinforce:['[DEMO 17] Cálculo diferencial']}}).eq('id',camila.account.id);
  if(error)throw Error('No se pudo normalizar la configuración DEMO.');
 }
 await call(camila,'Perfil y apoyos','/api/profiles/me',v=>v.id===camila.account.id);
 await call(camila,'Rutas, etapas y tareas','/api/learning-space/overview',v=>v.paths?.length>=1&&v.tasks?.length>=2);
 await call(camila,'Práctica adaptativa privada','/api/learning-space/adaptive/overview',v=>v.ready===true&&v.answeredCount>=1);
 await call(camila,'Simulación BKT','/api/learning-space/adaptive/demo',v=>!!v.before&&!!v.after);
 await call(camila,'Intereses y contenido relacionado','/api/recommendations/feed',v=>v.items?.length>=1);
 await call(camila,'Tutor ficticio acreditado','/api/tutoring/tutors?search=DEMO',v=>v.some((p:any)=>p.id===diego.account.id));
 await call(camila,'Catálogo usado por la pantalla de tutores','/api/tutoring/recommendations?search=DEMO&priority=balanced',v=>v.tutors?.some((p:any)=>p.id===diego.account.id));
 await call(camila,'Sesiones como estudiante','/api/tutoring/my-sessions?role=student',v=>v.some((s:any)=>s.id===dataId('session:live')));
 await call(diego,'Solicitudes para aceptar','/api/tutoring/my-sessions?role=tutor',v=>v.some((s:any)=>s.id===dataId('session:pending')));
 await call(camila,'Sesión preparada para confirmar','/api/tutoring/sessions/'+dataId('session:live'),v=>v.student_id===camila.account.id);
 await call(camila,'Inscripción a taller','/api/workshops/'+dataId('workshop:calculo'),v=>v.is_enrolled===true);
 await call(camila,'Taller con cupos para inscribirse','/api/workshops/'+dataId('workshop:python'),v=>v.is_enrolled===false&&v.max_students>v.enrollments_count);
 await call(diego,'Trayectoria y reputación','/api/tutoring/reputation/'+diego.account.id,v=>v.status==='ready'&&v.reputation?.valid_sessions>=9&&v.reputation?.recent_reviewers>=5);
 await call(camila,'Leer material de Cálculo','/api/notes/'+dataId('note:1'),v=>v.title?.startsWith('[DEMO 17]')&&v.contentHtml?.length>30);
 await call(camila,'Apunte privado y borrador','/api/notes/me',v=>v.some((n:any)=>n.visibility==='private')&&v.some((n:any)=>n.isDraft));
 await call(camila,'Foro con respuesta','/api/forum/posts/'+dataId('forum:calculo'),v=>v.title?.startsWith('[DEMO 17]'));
 await call(valentina,'Proyecto colaborativo','/api/projects/'+dataId('project:estudio'),v=>v.owner_id===valentina.account.id);
 await call(valentina,'Postulación pendiente de Diego','/api/projects/'+dataId('project:estudio')+'/applications',v=>v.some((a:any)=>a.applicant_id===diego.account.id));
 await call(camila,'Avisos internos','/api/support/inbox',v=>v.items?.length>=1);
 await call(camila,'Incidencia pendiente sin sanciones','/api/support/cases/'+dataId('incident:pending'),v=>v.status==='open'&&v.canClaim===false);
 await call(camila,'Canal de alertas','/api/support/channels',v=>v.activated===true&&v.emailEnabled===false);
 // Exercise the actual upload/registration path only for the dedicated tutor.
 const objectPath=diego.account.id+'/demo-presentacion-v1/guia-calculo-demo.pdf';
 const {data:existing,error:noteError}=await admin.from('academic_notes').select('id').eq('author_id',diego.account.id).eq('file_url','storage://academic-notes/'+objectPath).maybeSingle();
 if(noteError)throw Error('No se pudo comprobar el PDF DEMO.');
 if(!existing){
  const bytes=await fs.readFile(path.join(out,'GUIA_CALCULO_DEMO.pdf'));
  const {error}=await diego.client.storage.from('academic-notes').upload(objectPath,bytes,{contentType:'application/pdf',upsert:true});
  checks.push({name:'Subida privada del PDF DEMO',role:'diego',passed:!error,status:error?400:200});
  if(!error)await call(diego,'Publicación del material PDF','/api/notes',v=>!!v.id,{method:'POST',body:JSON.stringify({title:'[DEMO 17] PDF: guía breve de Cálculo',summary:'Archivo ficticio para probar vista previa y descarga. No es material académico validado.',subject_id:dataId('subject:calculo'),subject_name:'Cálculo',source_type:'upload',file_url:'storage://academic-notes/'+objectPath,file_name:'GUIA_CALCULO_DEMO.pdf',file_mime:'application/pdf',file_extension:'.pdf',file_size:bytes.length,tags:[seed,'mathematics'],visibility:'public'})});
 }else checks.push({name:'PDF DEMO disponible sin duplicados',role:'diego',status:200,passed:true});
 const signed=await camila.client.storage.from('academic-notes').createSignedUrl(objectPath,60);
 if(signed.error||!signed.data?.signedUrl)checks.push({name:'Acceso autorizado al PDF como estudiante',role:'camila',passed:false,status:403});
 else{const response=await fetch(signed.data.signedUrl,{signal:AbortSignal.timeout(15000)});const bytes=Buffer.from(await response.arrayBuffer());checks.push({name:'Acceso autorizado al PDF como estudiante',role:'camila',passed:response.ok&&bytes.subarray(0,5).toString()==='%PDF-',status:response.status});}
 const privateNote=await fetch(base+'/api/notes/'+dataId('note:5'),{headers:{Authorization:'Bearer '+diego.token},signal:AbortSignal.timeout(15000)});
 checks.push({name:'El tutor no lee el apunte privado de Camila',role:'diego',passed:[403,404].includes(privateNote.status),status:privateNote.status});
 await call(diego,'Sin strikes ni restricciones por reportes pendientes','/api/moderation/mine',v=>v.strikes===0&&!v.summary.account&&!v.summary.tutoring);
 if(process.argv.includes('--ai'))await call(camila,'Conversación IA real sin datos personales','/api/ai/orientation-chat',v=>typeof v.message==='string'&&v.message.length>15,{method:'POST',body:JSON.stringify({message:'Necesito organizar mi estudio de derivadas dentro de InterAula. ¿Qué puedo hacer primero?',history:[],context:{page:'/dashboard'}})});
 const count=await admin.from('email_notification_outbox').select('id',{count:'exact',head:true}).in('recipient_id',file.accounts.map((a:any)=>a.id));
 checks.push({name:'Ningún correo encolado para cuentas DEMO',passed:!count.error&&count.count===0,status:200});
 const result={checkedAt:new Date().toISOString(),dataset:seed,passed:checks.every(c=>c.passed),checks,scope:'Real login and API requests using only dedicated fictitious accounts; one PDF upload/registration. No production identities or roles changed. The optional AI check sends a generic study question.'};
 await fs.writeFile(path.join(out,'live-verification.json'),JSON.stringify(result,null,2),'utf8');console.log(JSON.stringify({passed:result.passed,checks:checks.length,failed:checks.filter(c=>!c.passed).map(c=>({name:c.name,status:c.status})),passwordsPrinted:false}));if(!result.passed)process.exitCode=1;
}catch(error:any){console.error('[Demo verification]',error.message);process.exitCode=1;}
