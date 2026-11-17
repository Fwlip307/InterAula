import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const header=`-- Generado por scripts/build-class-alerts-activation.mjs.
-- Ejecutar completo en el proyecto Supabase de InterAula. No envía correos ni concede roles.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.user_notifications') IS NULL OR to_regprocedure('public.enqueue_user_notice(uuid,text,text,text,text)') IS NULL THEN
  RAISE EXCEPTION 'Primero activa ACTIVAR_INCIDENCIAS_Y_AVISOS.sql';
 END IF;
END $$;
`;
const footer=`
COMMIT;
SELECT 'Alertas de clases y correo preparadas' AS estado,
 to_regclass('public.email_notification_outbox') IS NOT NULL AS cola_activada,
 to_regprocedure('public.generate_class_reminders(uuid)') IS NOT NULL AS recordatorios_activados;
`;
const sql=header+await fs.readFile(path.join(root,'supabase/migrations/029_class_alerts_and_email.sql'),'utf8')+footer;
const target=path.join(root,'supabase/ACTIVAR_ALERTAS_DE_CLASES.sql');
if(process.argv.includes('--check')){if(await fs.readFile(target,'utf8')!==sql)throw Error('Regenere ACTIVAR_ALERTAS_DE_CLASES.sql');console.log('Activador actualizado.');}
else{await fs.writeFile(target,sql,'utf8');console.log('Generado ACTIVAR_ALERTAS_DE_CLASES.sql');}
