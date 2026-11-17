import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
const root=path.resolve(import.meta.dirname,'../../..');
dotenv.config({path:path.join(root,'backend/.env')});
const dataset='interaula-demo-presentacion-v1';
const file=path.join(root,'docs/demo-2026-11-17/CUENTAS_PRIVADAS.local');
const definitions=[['camila','Camila','Estudiante'],['diego','Diego','Tutor'],['valentina','Valentina','Equipo'],['historia2','Andrea','Historial'],['historia3','Tomás','Historial'],['historia4','Martina','Historial'],['historia5','Benjamín','Historial']];
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!secret||!process.env.SUPABASE_URL)throw Error('Falta la configuración privada de Supabase en backend/.env.');
const admin=createClient(process.env.SUPABASE_URL,secret,{auth:{persistSession:false,autoRefreshToken:false}});
function fail(code:string):never{throw Error(code);}
async function main(){
 const command=process.argv[2]||'status';
 if(!['prepare','status'].includes(command))fail('Usa prepare o status. La retirada de datos tiene un SQL separado.');
 let saved:any={dataset,accounts:[]};try{saved=JSON.parse(await fs.readFile(file,'utf8'));}catch(error:any){if(error.code!=='ENOENT')fail('No se pudo leer el archivo privado de cuentas.');}
 if(saved.dataset!==dataset)fail('El archivo privado corresponde a otro conjunto.');
 await fs.mkdir(path.dirname(file),{recursive:true});
 const write=()=>fs.writeFile(file,JSON.stringify(saved,null,2),'utf8');
 for(const [role,first,last] of definitions){
  const email=`presentacion.${role}@interaula.example.invalid`;
  let account=saved.accounts.find((a:any)=>a.role===role);
  if(!account){if(command==='status')continue;account={role,email,name:`[DEMO] ${first} ${last}`,password:crypto.randomBytes(24).toString('base64url')+'aA1!',id:null};saved.accounts.push(account);await write();}
  if(account.email!==email)fail('La cuenta guardada no coincide con la definición DEMO.');
  const {data:profile,error}=await admin.from('profiles').select('id').eq('email',email).maybeSingle();if(error)fail('No se pudo buscar el perfil DEMO: '+error.code);
  if(profile){
   const {data,error}=await admin.auth.admin.getUserById(profile.id);if(error||data.user?.app_metadata?.interaula_demo_set!==dataset||data.user.email!==email)fail('Colisión con una cuenta ajena; no se modificó.');
   if(account.id&&account.id!==profile.id)fail('El identificador guardado cambió; revisión manual requerida.');account.id=profile.id;
  }else if(command==='prepare'){
   const {data,error}=await admin.auth.admin.createUser({email,password:account.password,email_confirm:true,user_metadata:{first_name:'[DEMO] '+first,last_name:last,display_name:account.name},app_metadata:{interaula_demo_set:dataset,demo_role:role}});
   if(error||!data.user)fail('No se pudo crear una cuenta DEMO: '+(error?.code||'AUTH_UNAVAILABLE'));account.id=data.user.id;await write();
  }
  if(command==='prepare'&&account.id){
   const {data,error}=await createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signInWithPassword({email,password:account.password});
   if(error||data.user?.id!==account.id)fail('No se pudo comprobar el acceso de una cuenta DEMO. No se rotaron credenciales.');
  }
 }
 if(command==='prepare')await write();
 console.log(JSON.stringify({dataset,accounts:saved.accounts.filter((a:any)=>a.id).length,credentialsFile:'docs/demo-2026-11-17/CUENTAS_PRIVADAS.local',permissions:'No reviewers, validators or administrators assigned',passwordsPrinted:false}));
}
main().catch(error=>{console.error('[Presentation accounts]',error.message);process.exitCode=1;});
