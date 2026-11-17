import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const source=await fs.readFile(path.join(root,'supabase/migrations/030_demo_environment_safety.sql'),'utf8');
const data=await fs.readFile(path.join(root,'supabase/demo/presentation-data.sql'),'utf8');
const sql=`-- Datos ficticios para la demo. Ejecutar completo después de preparar las cuentas.
-- No elimina datos reales ni concede permisos de revisión. No envía correos.
BEGIN;
${source}
${data}
COMMIT;
SELECT 'Escenario DEMO preparado' AS estado,
 (SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'interaula_demo_set'='interaula-demo-presentacion-v1') AS cuentas_demo,
 (SELECT count(*) FROM public.tutoring_sessions WHERE notes LIKE '[DEMO 17]%') AS sesiones_demo,
 (SELECT count(*) FROM public.academic_notes WHERE 'interaula-demo-presentacion-v1'=ANY(tags)) AS materiales_demo,
 (SELECT count(*) FROM public.projects WHERE 'interaula-demo-presentacion-v1'=ANY(tags)) AS proyectos_demo;
`;
const target=path.join(root,'supabase/PREPARAR_DEMO_PRESENTACION.sql');
if(process.argv.includes('--check')){if(await fs.readFile(target,'utf8')!==sql)throw Error('Regenera PREPARAR_DEMO_PRESENTACION.sql');console.log('Escenario SQL actualizado.');}
else{await fs.writeFile(target,sql,'utf8');console.log('Generado PREPARAR_DEMO_PRESENTACION.sql');}
