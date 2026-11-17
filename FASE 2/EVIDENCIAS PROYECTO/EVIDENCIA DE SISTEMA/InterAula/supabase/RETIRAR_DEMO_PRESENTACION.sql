-- Removes only the dedicated presentation accounts. Aborts if real users participated.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('interaula-demo-presentacion-v1',0));
CREATE TEMP TABLE presentation_accounts_to_remove(id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO presentation_accounts_to_remove SELECT id FROM auth.users WHERE raw_app_meta_data->>'interaula_demo_set'='interaula-demo-presentacion-v1'
 AND email LIKE 'presentacion.%@interaula.example.invalid';
DO $$ BEGIN
 IF current_user IN('anon','authenticated') THEN RAISE EXCEPTION 'Usa SQL Editor con el operador del proyecto'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN presentation_accounts_to_remove p ON o.name LIKE p.id::text||'/%') THEN RAISE EXCEPTION 'Primero retira los archivos DEMO mediante removePresentationFiles.ts. No se borran objetos de Storage por SQL'; END IF;
 IF EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id IN(SELECT id FROM presentation_accounts_to_remove))
  OR EXISTS(SELECT 1 FROM public.academic_validators WHERE profile_id IN(SELECT id FROM presentation_accounts_to_remove))
  OR EXISTS(SELECT 1 FROM public.moderation_measures WHERE subject_id IN(SELECT id FROM presentation_accounts_to_remove)) THEN RAISE EXCEPTION 'Una cuenta DEMO tiene permisos elevados o medidas; requiere revisión manual'; END IF;
 IF EXISTS(SELECT 1 FROM public.tutoring_sessions WHERE (student_id IN(SELECT id FROM presentation_accounts_to_remove))<>(tutor_id IN(SELECT id FROM presentation_accounts_to_remove)))
  OR EXISTS(SELECT 1 FROM public.workshop_enrollments e JOIN public.tutoring_workshops w ON w.id=e.workshop_id WHERE (w.tutor_id IN(SELECT id FROM presentation_accounts_to_remove))<>(e.student_id IN(SELECT id FROM presentation_accounts_to_remove)))
  OR EXISTS(SELECT 1 FROM public.forum_replies r JOIN public.forum_posts p ON p.id=r.post_id WHERE p.author_id IN(SELECT id FROM presentation_accounts_to_remove) AND r.author_id NOT IN(SELECT id FROM presentation_accounts_to_remove))
  OR EXISTS(SELECT 1 FROM public.project_members m JOIN public.projects p ON p.id=m.project_id WHERE p.owner_id IN(SELECT id FROM presentation_accounts_to_remove) AND m.profile_id NOT IN(SELECT id FROM presentation_accounts_to_remove))
  OR EXISTS(SELECT 1 FROM public.project_applications a JOIN public.projects p ON p.id=a.project_id WHERE p.owner_id IN(SELECT id FROM presentation_accounts_to_remove) AND a.applicant_id NOT IN(SELECT id FROM presentation_accounts_to_remove))
  OR EXISTS(SELECT 1 FROM public.community_incidents WHERE (reporter_id IN(SELECT id FROM presentation_accounts_to_remove) OR respondent_id IN(SELECT id FROM presentation_accounts_to_remove))
    AND (reporter_id NOT IN(SELECT id FROM presentation_accounts_to_remove) OR respondent_id NOT IN(SELECT id FROM presentation_accounts_to_remove) OR assigned_reviewer IS NOT NULL))
 THEN RAISE EXCEPTION 'Hay participación de personas ajenas al DEMO. Se conserva todo; revisión manual requerida'; END IF;
END $$;
DELETE FROM public.community_incidents WHERE reporter_id IN(SELECT id FROM presentation_accounts_to_remove) AND respondent_id IN(SELECT id FROM presentation_accounts_to_remove);
DELETE FROM auth.users WHERE id IN(SELECT id FROM presentation_accounts_to_remove);
DELETE FROM public.subjects s WHERE id IN(md5('interaula-demo-presentacion-v1:subject:calculo')::uuid,md5('interaula-demo-presentacion-v1:subject:python')::uuid) AND name LIKE '[DEMO 17]%'
 AND NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.profile_needed_subjects WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.tutoring_sessions WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.tutoring_workshops WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.tutor_verification_requests WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.tutor_assessment_attempts WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.academic_notes WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.forum_posts WHERE subject_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.learning_paths WHERE subject_id=s.id::text);
COMMIT;
SELECT 'Escenario DEMO retirado' AS estado;
