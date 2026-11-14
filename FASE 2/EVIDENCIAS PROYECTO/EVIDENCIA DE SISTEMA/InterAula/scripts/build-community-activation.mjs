import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const files=['019_inclusive_learning_features.sql','020_inclusive_flows_integrity.sql','021_academic_community.sql'];
let sql=`-- InterAula: activar comunidad academica y corregir apoyos inclusivos.
-- Ejecutar en el SQL Editor del mismo proyecto Supabase. Requiere 001-018.
-- Transaccion unica; conserva perfiles, intereses, contenidos y datos DEMO.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.recommendation_topics') IS NULL OR to_regclass('public.study_tasks') IS NULL THEN
   RAISE EXCEPTION 'Falta la base previa (migraciones hasta 018). No se realizo la activacion.';
 END IF;
END $$;
`;
for(const file of files) {
  const source=await fs.readFile(path.join(root,'supabase/migrations',file),'utf8');
  sql+='\n-- '+file+'\n'+source.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'')+'\n';
}
sql+=`\nCOMMIT;
SELECT 'Comunidad y apoyos activados' AS estado,
 to_regprocedure('public.convert_quick_idea_to_task(uuid,jsonb)') IS NOT NULL AS ideas_activadas,
 to_regprocedure('public.get_shared_learning_supports(uuid)') IS NOT NULL AS apoyos_activados;
`;
await fs.writeFile(path.join(root,'supabase/ACTIVAR_COMUNIDAD.sql'),sql);
console.log('ACTIVAR_COMUNIDAD.sql generado desde 019-021.');
