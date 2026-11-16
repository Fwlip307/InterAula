-- Activación de medidas privadas de convivencia. No sanciona cuentas ni asigna revisores.
-- Ejecutar completo en el mismo proyecto Supabase. Requiere incidencias y avisos (027).
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.community_incidents') IS NULL OR to_regprocedure('public.act_on_incident(uuid,text,text,integer)') IS NULL THEN
  RAISE EXCEPTION 'Primero activa ACTIVAR_INCIDENCIAS_Y_AVISOS.sql';
 END IF;
END $$;
-- No real permissions or sanctions are assigned by this migration.
ALTER TABLE public.community_reviewers ADD COLUMN IF NOT EXISTS can_sanction boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS can_suspend_accounts boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.moderation_findings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),incident_id uuid NOT NULL UNIQUE REFERENCES public.community_incidents(id),
 subject_id uuid NOT NULL REFERENCES public.profiles(id),reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
 severity text NOT NULL CHECK(severity IN('minor','serious')),reason text NOT NULL CHECK(length(reason) BETWEEN 40 AND 4000),
 fact_key text NOT NULL,confirmed_at timestamptz NOT NULL DEFAULT now(),strike_expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
 overturned_at timestamptz,overturned_by uuid REFERENCES public.profiles(id),UNIQUE(subject_id,fact_key)
);
CREATE TABLE IF NOT EXISTS public.moderation_measures(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),incident_id uuid NOT NULL REFERENCES public.community_incidents(id),finding_id uuid REFERENCES public.moderation_findings(id),
 subject_id uuid NOT NULL REFERENCES public.profiles(id),issued_by uuid NOT NULL REFERENCES public.profiles(id),
 scope text NOT NULL CHECK(scope IN('warning','subject','tutoring','community','account')),
 subject_course_id uuid REFERENCES public.subjects(id),reason text NOT NULL CHECK(length(reason) BETWEEN 40 AND 4000),
 precautionary boolean NOT NULL DEFAULT false,starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz,
 revoked_at timestamptz,revoked_by uuid REFERENCES public.profiles(id),revocation_reason text,
 CHECK((scope='subject')=(subject_course_id IS NOT NULL)),CHECK(ends_at IS NULL OR ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS measures_subject ON public.moderation_measures(subject_id,scope,ends_at) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS public.moderation_case_links(incident_id uuid PRIMARY KEY REFERENCES public.community_incidents(id),finding_id uuid NOT NULL REFERENCES public.moderation_findings(id));
CREATE TABLE IF NOT EXISTS public.moderation_appeal_reviews(
 incident_id uuid PRIMARY KEY REFERENCES public.community_incidents(id),reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
 outcome text NOT NULL CHECK(outcome IN('uphold','overturn')),reason text NOT NULL,expected_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_findings ENABLE ROW LEVEL SECURITY;ALTER TABLE public.moderation_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_case_links ENABLE ROW LEVEL SECURITY;ALTER TABLE public.moderation_appeal_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_findings,public.moderation_measures,public.moderation_case_links,public.moderation_appeal_reviews FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.moderation_findings,public.moderation_measures,public.moderation_case_links,public.moderation_appeal_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.user_capability_blocked(p_user uuid,p_cap text,p_subject uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.moderation_measures m WHERE m.subject_id=p_user AND m.revoked_at IS NULL
  AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
  AND (m.scope='account' OR m.scope=p_cap OR (p_cap='tutoring' AND p_subject IS NOT NULL AND m.scope='subject' AND m.subject_course_id=p_subject)))
$$;
REVOKE ALL ON FUNCTION public.user_capability_blocked(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.can_review_incidents() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND NOT public.user_capability_blocked(auth.uid(),'account') AND EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=auth.uid() AND active)
$$;
CREATE OR REPLACE FUNCTION public.can_apply_measures() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.can_review_incidents() AND EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=auth.uid() AND active AND can_sanction)
$$;
REVOKE ALL ON FUNCTION public.can_apply_measures() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_apply_measures() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_my_moderation_summary() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('enabled',true,'account',public.user_capability_blocked(auth.uid(),'account'),
  'tutoring',public.user_capability_blocked(auth.uid(),'tutoring'),'community',public.user_capability_blocked(auth.uid(),'community')) WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_my_moderation_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_moderation_summary() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_my_measures() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); items jsonb; strikes integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Inicia sesión' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO strikes FROM public.moderation_findings WHERE subject_id=actor AND severity='minor' AND overturned_at IS NULL AND strike_expires_at>now();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'caseId',m.incident_id,'scope',m.scope,'subjectName',s.name,'reason',m.reason,'precautionary',m.precautionary,
  'startsAt',m.starts_at,'endsAt',m.ends_at,'revokedAt',m.revoked_at,'revocationReason',m.revocation_reason,
  'active',m.revoked_at IS NULL AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())) ORDER BY m.starts_at DESC),'[]') INTO items
 FROM (SELECT * FROM public.moderation_measures WHERE subject_id=actor ORDER BY starts_at DESC LIMIT 100) m LEFT JOIN public.subjects s ON s.id=m.subject_course_id;
 RETURN jsonb_build_object('summary',public.get_my_moderation_summary(),'strikes',strikes,'windowDays',90,'items',items);
END $$;
REVOKE ALL ON FUNCTION public.get_my_measures() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.get_my_measures() TO authenticated;

CREATE OR REPLACE VIEW public.tutor_availability_limits WITH(security_barrier=true) AS
 SELECT m.subject_id AS profile_id,bool_or(m.scope IN('account','tutoring')) AS tutoring_unavailable,
  bool_or(m.scope IN('account','community')) AS community_unavailable,
  coalesce(array_agg(DISTINCT m.subject_course_id) FILTER(WHERE m.scope='subject'),'{}'::uuid[]) AS subject_ids
 FROM public.moderation_measures m JOIN public.public_profiles p ON p.id=m.subject_id
 WHERE m.scope<>'warning' AND m.revoked_at IS NULL AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now()) GROUP BY m.subject_id;
REVOKE ALL ON public.tutor_availability_limits FROM PUBLIC;GRANT SELECT ON public.tutor_availability_limits TO anon,authenticated,service_role;

-- SQL write enforcement also applies to direct Supabase calls and existing SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.enforce_member_measures() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); j jsonb; oldj jsonb; owner_id uuid; course uuid; teacher uuid;
BEGIN
 IF actor IS NULL OR coalesce(auth.role(),'')='service_role' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF public.user_capability_blocked(actor,'account') THEN RAISE EXCEPTION 'La cuenta está restringida. Puedes consultar ayuda y apelar' USING ERRCODE='42501'; END IF;
 j:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME='profiles' AND TG_OP='UPDATE' THEN
  IF NEW.available_for_tutoring AND NOT OLD.available_for_tutoring AND public.user_capability_blocked(actor,'tutoring') THEN
   RAISE EXCEPTION 'No puedes reactivar la oferta de tutorías durante la restricción' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='profile_offered_subjects' AND TG_OP<>'DELETE' THEN
  IF NEW.profile_id=actor AND public.user_capability_blocked(actor,'tutoring',NEW.subject_id) THEN RAISE EXCEPTION 'La oferta de esta materia está restringida' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='tutoring_sessions' THEN
  IF TG_OP='INSERT' AND (public.user_capability_blocked(NEW.student_id,'account') OR public.user_capability_blocked(NEW.tutor_id,'tutoring',NEW.subject_id)) THEN
   RAISE EXCEPTION 'Uno de los participantes no está disponible para esta tutoría' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND NEW.tutor_id=actor AND NEW.status IN('accepted','in_progress') AND NEW.status<>OLD.status AND public.user_capability_blocked(actor,'tutoring',NEW.subject_id) THEN
   RAISE EXCEPTION 'No puedes aceptar nuevas tutorías durante la restricción' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='tutoring_workshops' AND TG_OP<>'DELETE' THEN
  IF NEW.status IN('scheduled','in_progress') AND public.user_capability_blocked(NEW.tutor_id,'tutoring',NEW.subject_id) THEN RAISE EXCEPTION 'El taller no está disponible durante la restricción' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='workshop_enrollments' AND TG_OP='INSERT' THEN
  SELECT tutor_id,subject_id INTO teacher,course FROM public.tutoring_workshops WHERE id=NEW.workshop_id;
  IF public.user_capability_blocked(teacher,'tutoring',course) THEN RAISE EXCEPTION 'El taller no está disponible' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_TABLE_NAME IN('forum_posts','forum_replies','forum_post_votes','academic_notes','projects','project_positions','project_applications','project_members','project_deliverables') AND TG_OP<>'DELETE' THEN
  IF TG_TABLE_NAME='project_members' AND public.user_capability_blocked((j->>'profile_id')::uuid,'community') THEN RAISE EXCEPTION 'Esta persona no puede incorporarse al equipo ahora' USING ERRCODE='42501'; END IF;
  IF public.user_capability_blocked(actor,'community') THEN
   IF TG_TABLE_NAME='academic_notes' THEN
    IF j->>'visibility'='private' THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND (j-ARRAY['downloads_count','updated_at'])=(to_jsonb(OLD)-ARRAY['downloads_count','updated_at']) THEN RETURN NEW; END IF;
   END IF;
   RAISE EXCEPTION 'Las publicaciones e interacciones de comunidad están restringidas' USING ERRCODE='42501';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'moderation_%'
  AND tablename NOT IN('community_reviewers','community_incidents','community_incident_events','user_notifications') LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS aa_member_measures ON public.%I',t.tablename);
  EXECUTE format('CREATE TRIGGER aa_member_measures BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_member_measures()',t.tablename);
 END LOOP;
END $$;
DROP TRIGGER IF EXISTS aa_member_measures ON storage.objects;
CREATE TRIGGER aa_member_measures BEFORE INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.enforce_member_measures();

-- Permit only the trusted moderation RPC to cancel affected future individual sessions.
CREATE OR REPLACE FUNCTION public.enforce_tutoring_session_update_security()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() NOT IN(OLD.student_id,OLD.tutor_id) AND coalesce(auth.role(),'')<>'service_role' THEN
  IF NOT(current_user NOT IN('authenticated','anon') AND NEW.status='cancelled' AND OLD.status IN('pending','accepted') AND OLD.scheduled_at>now()
   AND EXISTS(SELECT 1 FROM public.moderation_measures m WHERE m.issued_by=auth.uid() AND m.revoked_at IS NULL AND (m.ends_at IS NULL OR m.ends_at>now())
    AND ((m.subject_id=OLD.tutor_id AND (m.scope IN('account','tutoring') OR (m.scope='subject' AND m.subject_course_id=OLD.subject_id))) OR (m.scope='account' AND m.subject_id=OLD.student_id)))) THEN
   RAISE EXCEPTION 'No perteneces a esta sesión' USING ERRCODE='42501'; END IF;
 END IF;
 IF NEW.status<>OLD.status THEN
  IF NEW.status IN('accepted','rejected','in_progress') AND auth.uid() IS DISTINCT FROM OLD.tutor_id THEN RAISE EXCEPTION 'Solo el tutor puede realizar esta transición' USING ERRCODE='42501'; END IF;
  IF NOT((OLD.status='pending' AND NEW.status IN('accepted','rejected','cancelled')) OR (OLD.status='accepted' AND NEW.status IN('in_progress','completed','cancelled')) OR (OLD.status='in_progress' AND NEW.status IN('completed','cancelled'))) THEN RAISE EXCEPTION 'Transición no válida' USING ERRCODE='23514'; END IF;
 END IF;
 IF current_user IN('authenticated','anon') AND (NEW.attendance_verified IS DISTINCT FROM OLD.attendance_verified OR NEW.actual_duration_minutes IS DISTINCT FROM OLD.actual_duration_minutes OR NEW.student_joined_at IS DISTINCT FROM OLD.student_joined_at OR NEW.tutor_joined_at IS DISTINCT FROM OLD.tutor_joined_at OR NEW.both_connected_at IS DISTINCT FROM OLD.both_connected_at) THEN
  RAISE EXCEPTION 'La asistencia se registra desde el aula' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.moderation_case_context(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.community_incidents%ROWTYPE; allowed boolean; finding jsonb; related jsonb; courses jsonb; measures jsonb;
BEGIN
 PERFORM public.get_incident(p_id); SELECT * INTO c FROM public.community_incidents WHERE id=p_id;
 allowed:=public.can_apply_measures() AND auth.uid() NOT IN(c.reporter_id,c.respondent_id);
 SELECT jsonb_build_object('id',f.id,'severity',f.severity,'reason',f.reason,'confirmedAt',f.confirmed_at,'overturnedAt',f.overturned_at) INTO finding
 FROM public.moderation_findings f WHERE f.incident_id=p_id AND (allowed OR auth.uid()=c.respondent_id);
 IF allowed THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'caseId',f.incident_id,'confirmedAt',f.confirmed_at,'reason',left(f.reason,160),'overturned',f.overturned_at IS NOT NULL) ORDER BY f.confirmed_at DESC),'[]') INTO related FROM public.moderation_findings f WHERE f.subject_id=c.respondent_id AND f.incident_id<>p_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.subject_id,'name',s.name)),'[]') INTO courses FROM public.profile_offered_subjects o JOIN public.subjects s ON s.id=o.subject_id WHERE o.profile_id=c.respondent_id AND o.is_verified;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'scope',m.scope,'reason',m.reason,'precautionary',m.precautionary,'startsAt',m.starts_at,'endsAt',m.ends_at,'revokedAt',m.revoked_at,'active',m.revoked_at IS NULL AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())) ORDER BY m.starts_at DESC),'[]') INTO measures FROM public.moderation_measures m WHERE m.incident_id=p_id AND (allowed OR auth.uid()=c.respondent_id);
 RETURN jsonb_build_object('canSanction',allowed,'canSuspendAccounts',allowed AND EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=auth.uid() AND can_suspend_accounts AND active),
  'finding',finding,'relatedFindings',coalesce(related,'[]'),'subjects',coalesce(courses,'[]'),'measures',measures,
  'hasMeasure',EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=p_id),'needsMeasureAppeal',c.appeal_used AND EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=p_id));
END $$;
REVOKE ALL ON FUNCTION public.moderation_case_context(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.moderation_case_context(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_moderation_measure(p_id uuid,p_revision integer,p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.community_incidents%ROWTYPE; actor uuid:=auth.uid(); severity text:=p_document->>'severity'; requested text:=p_document->>'scope';
 reason text:=trim(p_document->>'reason'); message text:=trim(p_document->>'message'); days integer; course uuid; linked uuid;
 f uuid; m uuid; fact text; strikes integer; actual_scope text; until_at timestamptz; s record;
BEGIN
 SELECT * INTO c FROM public.community_incidents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_apply_measures() OR actor IN(c.reporter_id,c.respondent_id) OR c.assigned_reviewer IS DISTINCT FROM actor OR c.status NOT IN('under_review','awaiting_reply') OR c.appeal_used THEN RAISE EXCEPTION 'No puedes aplicar una medida en este expediente' USING ERRCODE='42501'; END IF;
 IF p_revision IS NULL OR p_revision<>c.revision THEN RAISE EXCEPTION 'Actualiza el expediente' USING ERRCODE='40001'; END IF;
 IF p_document IS NULL OR jsonb_typeof(p_document)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_document) k WHERE k NOT IN('severity','scope','days','subjectId','reason','message','duplicateOf','distinctFact')) OR severity IS NULL OR severity NOT IN('minor','serious','precaution') OR length(coalesce(reason,'')) NOT BETWEEN 40 AND 4000 OR length(coalesce(message,'')) NOT BETWEEN 20 AND 4000 THEN RAISE EXCEPTION 'Revisa la decisión y sus motivos' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.respondent_id::text,28));
 IF EXISTS(SELECT 1 FROM public.moderation_findings WHERE incident_id=c.id) OR EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=c.id) OR EXISTS(SELECT 1 FROM public.moderation_case_links WHERE incident_id=c.id) THEN RAISE EXCEPTION 'Este expediente ya tiene una decisión sobre medidas' USING ERRCODE='23514'; END IF;
 linked:=nullif(p_document->>'duplicateOf','')::uuid;
 IF linked IS NULL AND c.target_kind<>'profile' THEN SELECT id INTO linked FROM public.moderation_findings WHERE subject_id=c.respondent_id AND fact_key=c.target_kind||':'||c.target_id; END IF;
 IF linked IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.moderation_findings WHERE id=linked AND subject_id=c.respondent_id) THEN RAISE EXCEPTION 'La referencia no corresponde a esta persona' USING ERRCODE='23514'; END IF;
  INSERT INTO public.moderation_case_links(incident_id,finding_id) VALUES(c.id,linked);
  PERFORM public.act_on_incident(c.id,'resolve',message,c.revision);RETURN public.moderation_case_context(c.id);
 END IF;
 IF c.target_kind='profile' AND EXISTS(SELECT 1 FROM public.moderation_findings WHERE subject_id=c.respondent_id) AND coalesce(p_document->>'distinctFact','false')<>'true' THEN RAISE EXCEPTION 'Vincula el hecho ya revisado o confirma que es un hecho distinto' USING ERRCODE='23514'; END IF;
 IF severity='minor' THEN
  SELECT count(*)+1 INTO strikes FROM public.moderation_findings mf WHERE mf.subject_id=c.respondent_id AND mf.severity='minor' AND mf.overturned_at IS NULL AND mf.strike_expires_at>now();
  actual_scope:=CASE WHEN strikes=1 THEN 'warning' ELSE 'tutoring' END;days:=CASE WHEN strikes=1 THEN 90 WHEN strikes=2 THEN 7 ELSE 30 END;
 ELSE
  IF requested IS NULL OR p_document->>'days' IS NULL OR requested NOT IN('subject','tutoring','community','account') OR (p_document->>'days') NOT IN('0','1','7','30') THEN RAISE EXCEPTION 'Elige alcance y duración' USING ERRCODE='23514'; END IF;
  actual_scope:=requested;days:=(p_document->>'days')::int;
  IF severity='precaution' AND days NOT IN(1,7) THEN RAISE EXCEPTION 'La medida preventiva debe vencer en uno o siete días' USING ERRCODE='23514'; END IF;
 END IF;
 IF actual_scope='account' AND NOT EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=actor AND active AND can_suspend_accounts) THEN RAISE EXCEPTION 'Falta permiso para restringir cuentas completas' USING ERRCODE='42501'; END IF;
 IF actual_scope='subject' THEN course:=nullif(p_document->>'subjectId','')::uuid;
  IF course IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects WHERE profile_id=c.respondent_id AND subject_id=course AND is_verified) THEN RAISE EXCEPTION 'Elige una materia acreditada de esta persona' USING ERRCODE='23514'; END IF;
 END IF;
 IF severity<>'precaution' THEN
  fact:=CASE WHEN c.target_kind='profile' THEN 'profile-case:'||c.id ELSE c.target_kind||':'||c.target_id END;
  INSERT INTO public.moderation_findings(incident_id,subject_id,reviewer_id,severity,reason,fact_key) VALUES(c.id,c.respondent_id,actor,severity,reason,fact) RETURNING id INTO f;
 END IF;
 until_at:=CASE WHEN days>0 THEN now()+make_interval(days=>days) ELSE NULL END;
 INSERT INTO public.moderation_measures(incident_id,finding_id,subject_id,issued_by,scope,subject_course_id,reason,precautionary,ends_at)
  VALUES(c.id,f,c.respondent_id,actor,actual_scope,course,reason,severity='precaution',until_at) RETURNING id INTO m;
 -- Future appointments are cancelled, never silently reassigned. Past history stays intact.
 FOR s IN UPDATE public.tutoring_sessions SET status='cancelled',cancellation_reason='La sesión se canceló porque un participante no está disponible para nuevas tutorías.'
  WHERE status IN('pending','accepted') AND scheduled_at>now() AND ((tutor_id=c.respondent_id AND (actual_scope IN('tutoring','account') OR (actual_scope='subject' AND subject_id=course))) OR (actual_scope='account' AND student_id=c.respondent_id)) RETURNING id,student_id,tutor_id LOOP
  PERFORM public.enqueue_user_notice(s.student_id,'session-status:'||s.id||':cancelled','Cambio en una tutoría','La sesión se canceló. Revisa tu agenda para coordinar otra alternativa.','/my-tutoring');
  PERFORM public.enqueue_user_notice(s.tutor_id,'session-status:'||s.id||':cancelled','Cambio en una tutoría','La sesión se canceló. Revisa tu agenda.','/my-tutoring');
 END LOOP;
 FOR s IN UPDATE public.tutoring_workshops SET status='cancelled' WHERE tutor_id=c.respondent_id AND status='scheduled' AND scheduled_at>now()
  AND (actual_scope IN('tutoring','account') OR (actual_scope='subject' AND subject_id=course)) RETURNING id LOOP
  PERFORM public.enqueue_user_notice(student_id,'workshop-unavailable:'||s.id,'Cambio en un taller','El taller no está disponible. Revisa tu agenda.','/tutoring?tab=my_classes') FROM public.workshop_enrollments WHERE workshop_id=s.id;
 END LOOP;
 IF actual_scope='account' THEN
  FOR s IN DELETE FROM public.workshop_enrollments e USING public.tutoring_workshops w WHERE e.workshop_id=w.id AND e.student_id=c.respondent_id AND w.status='scheduled' AND w.scheduled_at>now() RETURNING e.workshop_id,w.tutor_id LOOP
   PERFORM public.enqueue_user_notice(s.tutor_id,'enrollment-unavailable:'||s.workshop_id||':'||c.respondent_id,'Cambio de inscripción','Una inscripción se canceló. Revisa los cupos de tu taller.','/my-tutoring');
   PERFORM public.enqueue_user_notice(c.respondent_id,'enrollment-unavailable:'||s.workshop_id,'Cambio de inscripción','Tu reserva del taller se canceló por una restricción de cuenta.','/support?case='||c.id);
  END LOOP;
 END IF;
 PERFORM public.enqueue_user_notice(c.respondent_id,'measure:'||m,'Tienes una decisión para revisar','Consulta en privado el alcance, motivo, duración y opción de apelación.','/support?case='||c.id);
 PERFORM public.act_on_incident(c.id,'resolve',message,c.revision);
 RETURN public.moderation_case_context(c.id);
END $$;
REVOKE ALL ON FUNCTION public.decide_moderation_measure(uuid,integer,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.decide_moderation_measure(uuid,integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_measure_appeal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.appeal_used AND NEW.assigned_reviewer IS NOT NULL AND NEW.assigned_reviewer IS DISTINCT FROM OLD.assigned_reviewer AND EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=OLD.id) THEN
  IF NOT public.can_apply_measures() OR (EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=OLD.id AND scope='account') AND NOT EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=auth.uid() AND active AND can_suspend_accounts)) THEN
   RAISE EXCEPTION 'La revisión requiere permiso para decidir estas medidas' USING ERRCODE='42501'; END IF;
 END IF;
 IF NOT OLD.appeal_used AND NEW.appeal_used AND auth.uid() IS DISTINCT FROM OLD.respondent_id AND EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=OLD.id) THEN
  RAISE EXCEPTION 'La apelación de una medida corresponde a la persona afectada' USING ERRCODE='42501'; END IF;
 IF OLD.appeal_used AND OLD.status IN('under_review','awaiting_reply') AND NEW.status IN('resolved','closed')
  AND EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=OLD.id)
  AND NOT EXISTS(SELECT 1 FROM public.moderation_appeal_reviews WHERE incident_id=OLD.id AND reviewer_id=auth.uid() AND expected_revision=OLD.revision) THEN
  RAISE EXCEPTION 'Revisa expresamente las medidas de esta apelación antes de resolver' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_measure_appeal ON public.community_incidents;
CREATE TRIGGER guard_measure_appeal BEFORE UPDATE ON public.community_incidents FOR EACH ROW EXECUTE FUNCTION public.guard_measure_appeal();
CREATE OR REPLACE FUNCTION public.decide_measure_appeal(p_id uuid,p_revision integer,p_outcome text,p_reason text,p_message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.community_incidents%ROWTYPE; actor uuid:=auth.uid();
BEGIN
 SELECT * INTO c FROM public.community_incidents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_apply_measures() OR actor IN(c.reporter_id,c.respondent_id) OR c.assigned_reviewer IS DISTINCT FROM actor OR NOT c.appeal_used OR c.status NOT IN('under_review','awaiting_reply') OR c.resolved_by=actor THEN RAISE EXCEPTION 'Se requiere otro revisor autorizado' USING ERRCODE='42501'; END IF;
 IF p_revision IS NULL OR p_revision<>c.revision THEN RAISE EXCEPTION 'Actualiza el expediente' USING ERRCODE='40001'; END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN('uphold','overturn') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 40 AND 4000 OR length(trim(coalesce(p_message,''))) NOT BETWEEN 20 AND 4000
  OR NOT EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=c.id) THEN RAISE EXCEPTION 'Explica la revisión de la medida' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=c.id AND issued_by=actor) THEN RAISE EXCEPTION 'No puedes revisar tu propia medida' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.moderation_measures WHERE incident_id=c.id AND scope='account') AND NOT EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=actor AND active AND can_suspend_accounts) THEN RAISE EXCEPTION 'Falta permiso de revisión de cuentas completas' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.respondent_id::text,28));
 INSERT INTO public.moderation_appeal_reviews(incident_id,reviewer_id,outcome,reason,expected_revision) VALUES(c.id,actor,p_outcome,trim(p_reason),c.revision);
 IF p_outcome='overturn' THEN
  UPDATE public.moderation_findings SET overturned_at=clock_timestamp(),overturned_by=actor WHERE incident_id=c.id AND overturned_at IS NULL;
  UPDATE public.moderation_measures SET revoked_at=clock_timestamp(),revoked_by=actor,revocation_reason=trim(p_reason) WHERE incident_id=c.id AND revoked_at IS NULL;
  -- An overturned strike must not keep later minor measures artificially escalated.
  WITH ranks AS (
   SELECT f.id,f.confirmed_at,(SELECT count(*) FROM public.moderation_findings prior WHERE prior.subject_id=f.subject_id AND prior.severity='minor' AND prior.overturned_at IS NULL
    AND (prior.confirmed_at,prior.id)<=(f.confirmed_at,f.id) AND prior.confirmed_at>f.confirmed_at-interval '90 days') AS n
   FROM public.moderation_findings f WHERE f.subject_id=c.respondent_id AND f.severity='minor' AND f.overturned_at IS NULL
  ) UPDATE public.moderation_measures mm SET scope=CASE WHEN r.n=1 THEN 'warning' ELSE 'tutoring' END,
   ends_at=r.confirmed_at+make_interval(days=>CASE WHEN r.n=1 THEN 90 WHEN r.n=2 THEN 7 ELSE 30 END)
   FROM ranks r WHERE mm.finding_id=r.id AND mm.revoked_at IS NULL AND mm.ends_at>now() AND mm.scope IN('warning','tutoring');
 END IF;
 PERFORM public.act_on_incident(c.id,'resolve',p_message,c.revision);
 PERFORM public.enqueue_user_notice(c.respondent_id,'measure-appeal:'||c.id,'Resultado de la revisión independiente','Consulta tu seguimiento privado. Las sesiones canceladas no se reactivan automáticamente.','/support?case='||c.id);
 RETURN public.moderation_case_context(c.id);
END $$;
REVOKE ALL ON FUNCTION public.decide_measure_appeal(uuid,integer,text,text,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.decide_measure_appeal(uuid,integer,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
SELECT 'Medidas de convivencia activadas' AS estado,
 to_regprocedure('public.decide_moderation_measure(uuid,integer,jsonb)') IS NOT NULL AS medidas_activadas,
 to_regprocedure('public.decide_measure_appeal(uuid,integer,text,text,text)') IS NOT NULL AS apelaciones_activadas;
