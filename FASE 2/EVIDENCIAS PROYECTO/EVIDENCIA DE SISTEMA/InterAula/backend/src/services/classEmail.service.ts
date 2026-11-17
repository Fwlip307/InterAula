import {getAdminSupabase} from '../lib/supabase.js';
import {env} from '../config/env.js';

export interface ClassEmailJob{id:string;lease:string;attempt:number;to:string;payload:{title:string;body:string;href:string;scheduledAt:string|null;kind:'session'|'workshop'}}
interface EmailConfig{enabled:boolean;ready:boolean;apiKey:string;from:string;publicUrl:string;reason:string}
export function classEmailConfig():EmailConfig{
 const enabled=process.env.EMAIL_ENABLED==='true',apiKey=process.env.RESEND_API_KEY?.trim()||'',from=process.env.EMAIL_FROM?.trim()||'',publicUrl=process.env.APP_PUBLIC_URL?.trim()||'';
 let validUrl=false;try{const u=new URL(publicUrl);validUrl=u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&!u.search&&!u.hash;}catch{/* Missing URL keeps delivery disabled. */}
 const ready=enabled&&!!apiKey&&/^[^\r\n]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$|^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(from)&&validUrl&&!!env.supabaseServiceRoleKey;
 return {enabled,ready,apiKey,from,publicUrl,reason:!enabled?'disabled':ready?'configured':'missing_configuration'};
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderClassEmail(job:ClassEmailJob,publicUrl:string){
 const p=job.payload,validHref=p.href.startsWith('/')&&!p.href.startsWith('//')&&!/[\\\r\n]/.test(p.href),href=new URL(validHref?p.href:'/support',publicUrl).toString();
 const settings=new URL('/settings#notifications',publicUrl).toString();
 const scheduled=p.scheduledAt?new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',dateStyle:'full',timeStyle:'short'}).format(new Date(p.scheduledAt)):null;
 const detail=scheduled?'Horario de la clase: '+scheduled+' (hora de Chile, America/Santiago).':'';
 const subject='InterAula · '+p.title.replace(/[\r\n]/g,' ').slice(0,140);
 const text=[p.title,p.body,detail,'Ver en InterAula: '+href,'Puedes ajustar los correos y recordatorios: '+settings,'Mensaje automático de InterAula. No respondas con datos personales.'].filter(Boolean).join('\n\n');
 const html=`<!doctype html><html lang="es"><body style="margin:0;background:#f5f7fb;color:#14213d;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:560px;margin:24px auto;padding:28px;background:#ffffff;border:1px solid #dce4f0;border-radius:14px"><p style="font-weight:bold;color:#2459d3">InterAula</p><h1 style="font-size:22px">${escape(p.title)}</h1><p>${escape(p.body)}</p>${detail?`<p>${escape(detail)}</p>`:''}<p><a href="${escape(href)}" style="display:inline-block;padding:12px 18px;background:#2459d3;color:white;border-radius:8px;text-decoration:none">Ver mi agenda</a></p><p style="font-size:13px">Decides qué avisos recibir. <a href="${escape(settings)}">Ajustar correos y recordatorios</a></p><p style="font-size:12px;color:#5c687b">Mensaje automático. No respondas con datos personales.</p></main></body></html>`;
 return {subject,text,html};
}
export class EmailProviderError extends Error{constructor(public code:string,public retryable:boolean){super(code);}}
export async function sendClassEmail(job:ClassEmailJob,config=classEmailConfig()){
 if(!config.ready)throw new EmailProviderError('EMAIL_NOT_CONFIGURED',false);
 let response:Response;
 try{response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'interaula-class/'+job.id},
  body:JSON.stringify({from:config.from,to:[job.to],...renderClassEmail(job,config.publicUrl)}),signal:AbortSignal.timeout(12000)});}
 catch{throw new EmailProviderError('PROVIDER_NETWORK',true);}
 if(!response.ok)throw new EmailProviderError('PROVIDER_HTTP_'+response.status,response.status===429||response.status>=500);
 let data:any;try{data=await response.json();}catch{throw new EmailProviderError('PROVIDER_INVALID_RESPONSE',true);}
 if(typeof data?.id!=='string'||!data.id)throw new EmailProviderError('PROVIDER_INVALID_RESPONSE',true);
 return data.id;
}
async function rpc(name:string,args:Record<string,unknown>={}){
 const {data,error}=await getAdminSupabase().rpc(name,args);if(error)throw new Error(['PGRST202','PGRST205','42883','42P01'].includes(String(error.code))?'ALERTS_NOT_ACTIVATED':'ALERTS_DATABASE_UNAVAILABLE');return data;
}
export const classEmailService={
 async channelStatus(){
  const config=classEmailConfig();let activated=false;
  if(env.supabaseServiceRoleKey){const {error}=await getAdminSupabase().from('email_notification_outbox').select('id').limit(0);if(error&&!['PGRST205','42P01'].includes(String(error.code)))throw new Error('ALERTS_DATABASE_UNAVAILABLE');activated=!error;}
  return {activated,emailConfigured:config.ready,emailEnabled:config.enabled,automaticReminders:activated&&!!env.supabaseServiceRoleKey,provider:'Resend',emailState:!activated?'not_activated':config.ready?'configured':config.reason,reminderMinutes:[1440,60],delivery:'provider_acceptance'};
 },
 async runOnce(){
  if(!env.supabaseServiceRoleKey)return {reminders:0,accepted:0};
  const reminders=await rpc('generate_class_reminders',{p_actor:null});let accepted=0;
  // The SQL reminder job remains active even when email is disabled.
  const config=classEmailConfig();if(!config.ready)return {reminders,accepted};
  for(let i=0;i<10;i++){
   const claimed=await rpc('claim_class_email') as ClassEmailJob|null;if(!claimed)break;
   const job=await rpc('prepare_class_email',{p_id:claimed.id,p_lease:claimed.lease}) as ClassEmailJob|null;if(!job)continue;
   let state='accepted',providerId:string|null=null,code:string|null=null;
   try{providerId=await sendClassEmail(job,config);}
   catch(error){const failure=error instanceof EmailProviderError?error:new EmailProviderError('EMAIL_RENDER_FAILED',false);state=failure.retryable?'pending':'failed';code=failure.code;}
   // If this acknowledgement fails, retain the lease; a retry uses the same provider idempotency key.
   const saved=await rpc('finish_class_email',{p_id:job.id,p_lease:job.lease,p_state:state,p_provider_id:providerId,p_error_code:code});
   if(!saved)throw new Error('ALERTS_LEASE_LOST');if(state==='accepted')accepted++;
   if(code==='PROVIDER_HTTP_429')break;
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return {reminders,accepted};
 },
};
export function startClassAlerts(){
 let running=false,stopped=false,lastCode='';
 const tick=async()=>{if(running||stopped)return;running=true;try{await classEmailService.runOnce();lastCode='';}catch(error){const code=error instanceof Error?error.message:'ALERTS_UNAVAILABLE';if(code!==lastCode){console.warn('[Class alerts]',code);lastCode=code;}}finally{running=false;}};
 const timer=setInterval(()=>void tick(),60000);timer.unref();void tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
