import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
const root=path.resolve(import.meta.dirname,'../../..');dotenv.config({path:path.join(root,'backend/.env')});
const seed='interaula-demo-presentacion-v1',file=JSON.parse(await fs.readFile(path.join(root,'docs/demo-2026-11-17/CUENTAS_PRIVADAS.local'),'utf8'));
if(file.dataset!==seed)throw Error('Conjunto privado inesperado.');
const c=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
let removed=0;
for(const account of file.accounts){
 if(!account.id)continue;
 const {data,error}=await c.auth.admin.getUserById(account.id);if(error||data.user?.app_metadata?.interaula_demo_set!==seed)throw Error('No se borró nada de una identidad que no coincide.');
 const prefix=account.id+'/demo-presentacion-v1',bucket=c.storage.from('academic-notes');
 const listed=await bucket.list(prefix,{limit:100});if(listed.error)throw Error('No se pudo listar la carpeta DEMO.');
 const paths=(listed.data||[]).map(item=>{if(!item.id||item.name.includes('/')||item.name.includes('..'))throw Error('Carpeta anidada inesperada; revisión manual.');return prefix+'/'+item.name;});
 if(paths.length){const result=await bucket.remove(paths);if(result.error)throw Error('No se pudieron retirar archivos DEMO.');removed+=paths.length;}
}
console.log(JSON.stringify({dataset:seed,filesRemoved:removed,accountsDeleted:false}));
