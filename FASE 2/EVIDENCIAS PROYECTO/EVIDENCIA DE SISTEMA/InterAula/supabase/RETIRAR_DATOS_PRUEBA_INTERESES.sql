-- Retira solo el conjunto interaula-demo-interests-v1 y sus interacciones de prueba.
-- Conserva cuentas reales, intereses elegidos y asignaturas DEMO usadas por contenido real.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('interaula-demo-interests-v1',0));
CREATE TEMP TABLE interaula_demo_users_to_remove(id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO interaula_demo_users_to_remove(id)
SELECT u.id FROM auth.users u WHERE u.raw_user_meta_data->>'interaula_demo_set'='interaula-demo-interests-v1'
  AND u.email LIKE '%@interaula.example.invalid'
  AND (u.id IN (SELECT md5('interaula-demo-interests-v1:'||r||':'||t.id)::uuid
      FROM public.recommendation_topics t CROSS JOIN unnest(ARRAY['teach','learn','hidden']) r)
    OR u.id IN (md5('interaula-demo-interests-v1:seat:a')::uuid,md5('interaula-demo-interests-v1:seat:b')::uuid));
DO $$
BEGIN
  IF to_regclass('auth.identities') IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM auth.identities WHERE user_id IN (SELECT id FROM interaula_demo_users_to_remove)) THEN
      RAISE EXCEPTION 'Un perfil DEMO tiene una identidad de acceso. Revise esa cuenta antes de retirarla.';
    END IF;
  END IF;
END $$;
DELETE FROM public.recommendation_dismissals d WHERE
  (d.kind='note' AND d.item_id IN (SELECT id FROM public.academic_notes WHERE author_id IN (SELECT id FROM interaula_demo_users_to_remove))) OR
  (d.kind='post' AND d.item_id IN (SELECT id FROM public.forum_posts WHERE author_id IN (SELECT id FROM interaula_demo_users_to_remove))) OR
  (d.kind='project' AND d.item_id IN (SELECT id FROM public.projects WHERE owner_id IN (SELECT id FROM interaula_demo_users_to_remove))) OR
  (d.kind='workshop' AND d.item_id IN (SELECT id FROM public.tutoring_workshops WHERE tutor_id IN (SELECT id FROM interaula_demo_users_to_remove))) OR
  (d.kind='person' AND d.item_id IN (SELECT id FROM interaula_demo_users_to_remove));
DELETE FROM auth.users WHERE id IN (SELECT id FROM interaula_demo_users_to_remove);
DELETE FROM public.subjects s
WHERE s.id IN (SELECT md5('interaula-demo-interests-v1:subject:'||id)::uuid FROM public.recommendation_topics)
  AND s.name LIKE '[DEMO] %'
  AND NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.profile_needed_subjects x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.tutoring_sessions x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.tutoring_workshops x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.tutor_verification_requests x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.academic_notes x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.forum_posts x WHERE x.subject_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_paths x WHERE x.subject_id=s.id::text);
COMMIT;
SELECT 'Datos DEMO retirados' AS estado,
  (SELECT count(*) FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'='interaula-demo-interests-v1') AS perfiles_demo_restantes;
