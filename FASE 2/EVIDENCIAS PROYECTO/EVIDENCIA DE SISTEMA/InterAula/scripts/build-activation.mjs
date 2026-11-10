import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['016_privacy_and_transactional_persistence.sql','017_server_assessments_and_endorsements.sql','018_interests_and_recommendations.sql'];
const preflight=`-- Archivo generado por scripts/build-activation.mjs.
-- Ejecutar completo en SQL Editor del mismo proyecto Supabase que usa InterAula.
-- Reune solo las migraciones 016-018. No repite las migraciones antiguas de limpieza.
-- Revisar y respaldar el proyecto antes de ejecutar cambios de esquema y permisos.
-- Cada cambio se confirma junto al resto; un error revierte la transaccion completa.
BEGIN;
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.profiles','public.subjects','public.profile_offered_subjects',
    'public.projects','public.project_positions','public.project_members','public.project_applications',
    'public.forum_posts','public.forum_replies','public.forum_post_votes','public.academic_notes',
    'public.tutoring_sessions','public.tutoring_workshops','public.workshop_enrollments',
    'public.tutor_verification_requests','public.academic_validators',
    'public.learning_paths','public.learning_path_stages','public.study_tasks','public.topic_assessments',
    'storage.buckets','storage.objects','auth.users'
  ] LOOP
    IF to_regclass(v_table) IS NULL THEN
      RAISE EXCEPTION 'Falta la tabla previa %. Revise el esquema 001-015 antes de activar.',v_table;
    END IF;
  END LOOP;
END $$;
`;
let sql=preflight;
for(const file of files) {
  const source=await fs.readFile(path.join(root,'supabase','migrations',file),'utf8');
  const begins=source.match(/^BEGIN;\s*$/gm)||[];
  const commits=source.match(/^COMMIT;\s*$/gm)||[];
  if(begins.length!==1||commits.length!==1)throw new Error('Revise los limites de transaccion de '+file);
  sql+='\n-- Fuente: '+file+'\n'+source.replace(/^BEGIN;[ \t]*\r?\n/m,'').replace(/^COMMIT;[ \t]*(?:\r?\n)?/m,'').trim()+'\n';
}
sql+=`\nNOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'Activacion completada' AS estado,
  (SELECT count(*) FROM public.recommendation_topics) AS temas_disponibles,
  to_regclass('public.workshop_summary') IS NOT NULL AS talleres_disponibles;
`;
const target=path.join(root,'supabase','ACTIVAR_INTERESES.sql');
if(process.argv.includes('--check')) {
  if((await fs.readFile(target,'utf8'))!==sql)throw new Error('Regenere ACTIVAR_INTERESES.sql con node scripts/build-activation.mjs');
  console.log('Archivo de activacion actualizado.');
} else {
  await fs.writeFile(target,sql,'utf8');
  console.log('Generado supabase/ACTIVAR_INTERESES.sql');
}
