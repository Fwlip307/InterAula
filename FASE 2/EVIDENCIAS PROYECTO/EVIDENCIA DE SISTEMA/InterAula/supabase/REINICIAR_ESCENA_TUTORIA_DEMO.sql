-- Optional rehearsal reset: only the presentation's tenth session, its review and notices.
BEGIN;
DO $$ DECLARE teacher uuid;student uuid;sid uuid:=md5('interaula-demo-presentacion-v1:session:live')::uuid;
BEGIN
 IF current_user IN('anon','authenticated') THEN RAISE EXCEPTION 'Usa SQL Editor con el operador del proyecto'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('interaula-demo-presentacion-v1',0));
 SELECT id INTO teacher FROM auth.users WHERE raw_app_meta_data->>'interaula_demo_set'='interaula-demo-presentacion-v1' AND raw_app_meta_data->>'demo_role'='diego';
 SELECT id INTO student FROM auth.users WHERE raw_app_meta_data->>'interaula_demo_set'='interaula-demo-presentacion-v1' AND raw_app_meta_data->>'demo_role'='camila';
 IF teacher IS NULL OR student IS NULL OR EXISTS(SELECT 1 FROM public.tutoring_sessions WHERE id=sid AND (tutor_id<>teacher OR student_id<>student OR notes NOT LIKE '[DEMO 17]%')) THEN RAISE EXCEPTION 'El escenario no coincide con las cuentas DEMO'; END IF;
 IF EXISTS(SELECT 1 FROM public.community_incidents WHERE target_id=sid AND assigned_reviewer IS NOT NULL) THEN RAISE EXCEPTION 'La escena tiene una revisión asignada; no se reinicia'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 DELETE FROM public.user_notifications WHERE recipient_id IN(teacher,student) AND event_key LIKE '%'||sid||'%';
 DELETE FROM public.tutoring_sessions WHERE id=sid AND tutor_id=teacher AND student_id=student;
 DELETE FROM public.user_badges u USING public.badges b WHERE u.badge_id=b.id AND u.profile_id=teacher AND b.code='tutoring_10'
  AND (SELECT count(*) FROM public.tutoring_sessions WHERE tutor_id=teacher AND status='completed' AND completion_verified_at IS NOT NULL)<10;
 INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,modality,notes,agenda_preview,camera_policy)
  VALUES(sid,student,teacher,md5('interaula-demo-presentacion-v1:subject:calculo')::uuid,now()-interval '40 minutes','accepted','online',
   '[DEMO 17] Completar esta sesión desde ambas cuentas y valorar para activar el hito de 10 tutorías.',
   '{"what_we_will_see":"Regla de la cadena","step_by_step":"Un ejemplo y una práctica","how_it_ends":"Resumen y siguiente paso"}','optional');
END $$;
COMMIT;
SELECT 'Escena de tutoría DEMO reiniciada' AS estado;
