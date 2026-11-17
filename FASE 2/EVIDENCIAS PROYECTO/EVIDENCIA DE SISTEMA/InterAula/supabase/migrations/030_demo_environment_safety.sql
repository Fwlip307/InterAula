-- Demonstration identities are designated only by server-owned app metadata.
-- Older remote installations of module 015 lacked the task priority column.
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media' CHECK(priority IN('baja','media','alta'));
CREATE OR REPLACE FUNCTION public.demo_environment_tag(p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT nullif(raw_app_meta_data->>'interaula_demo_set','') FROM auth.users WHERE id=p_user
$$;
REVOKE ALL ON FUNCTION public.demo_environment_tag(uuid) FROM PUBLIC,anon,authenticated;
-- Only the server operator can import historical fixtures, and only between this
-- presentation's server-designated accounts. Normal booking rules remain enforced.
CREATE OR REPLACE FUNCTION public.validate_tutoring_session_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE demo_import boolean:=auth.uid() IS NULL AND coalesce(auth.role(),'')='service_role'
 AND public.demo_environment_tag(NEW.student_id)='interaula-demo-presentacion-v1'
 AND public.demo_environment_tag(NEW.tutor_id)='interaula-demo-presentacion-v1'
 AND coalesce(NEW.notes,'') LIKE '[DEMO 17]%';
BEGIN
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NOT NULL AND NEW.student_id<>auth.uid() THEN RAISE EXCEPTION 'No puedes solicitar tutorías por otra persona' USING ERRCODE='42501'; END IF;
  IF (NEW.status<>'pending' OR NEW.scheduled_at<=now()) AND NOT coalesce(demo_import,false) THEN RAISE EXCEPTION 'La solicitud debe estar pendiente y tener una fecha futura' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.tutor_id AND available_for_tutoring) THEN RAISE EXCEPTION 'El tutor no está disponible' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects WHERE profile_id=NEW.tutor_id AND subject_id=NEW.subject_id) THEN RAISE EXCEPTION 'El tutor no ofrece esta asignatura' USING ERRCODE='23514'; END IF;
 ELSE
  IF OLD.status IN('completed','rejected','cancelled') THEN RAISE EXCEPTION 'La tutoría ya terminó' USING ERRCODE='23514'; END IF;
  IF NEW.status='completed' AND OLD.status<>NEW.status AND now()<OLD.scheduled_at THEN RAISE EXCEPTION 'La tutoría todavía no comienza' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.updated_at:=now();RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_demo_environment_boundary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE teacher uuid; participant uuid; a text;b text;
BEGIN
 IF TG_TABLE_NAME='tutoring_sessions' THEN teacher:=NEW.tutor_id;participant:=NEW.student_id;
 ELSIF TG_TABLE_NAME='workshop_enrollments' THEN SELECT tutor_id INTO teacher FROM public.tutoring_workshops WHERE id=NEW.workshop_id;participant:=NEW.student_id;
 ELSIF TG_TABLE_NAME IN('project_applications','project_members') THEN SELECT owner_id INTO teacher FROM public.projects WHERE id=NEW.project_id;
  participant:=CASE WHEN TG_TABLE_NAME='project_applications' THEN (to_jsonb(NEW)->>'applicant_id')::uuid ELSE (to_jsonb(NEW)->>'profile_id')::uuid END;
 END IF;
 a:=public.demo_environment_tag(teacher);b:=public.demo_environment_tag(participant);
 IF (a IS NOT NULL OR b IS NOT NULL) AND a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Este escenario DEMO solo permite participantes de sus cuentas ficticias. Usa las cuentas de presentación.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ab_demo_boundary ON public.tutoring_sessions;
CREATE TRIGGER ab_demo_boundary BEFORE INSERT OR UPDATE ON public.tutoring_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_environment_boundary();
DROP TRIGGER IF EXISTS ab_demo_boundary ON public.workshop_enrollments;
CREATE TRIGGER ab_demo_boundary BEFORE INSERT OR UPDATE ON public.workshop_enrollments FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_environment_boundary();
DROP TRIGGER IF EXISTS ab_demo_boundary ON public.project_applications;
CREATE TRIGGER ab_demo_boundary BEFORE INSERT OR UPDATE ON public.project_applications FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_environment_boundary();
DROP TRIGGER IF EXISTS ab_demo_boundary ON public.project_members;
CREATE TRIGGER ab_demo_boundary BEFORE INSERT OR UPDATE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.enforce_demo_environment_boundary();
CREATE OR REPLACE FUNCTION public.class_email_allowed(p_user uuid,p_reminder boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.demo_environment_tag(p_user) IS NULL AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user
  AND coalesce(p.accessibility_preferences->>'emailTutoring','true')='true'
  AND (NOT p_reminder OR coalesce(p.accessibility_preferences->>'emailClassReminders','true')='true'))
$$;
REVOKE ALL ON FUNCTION public.class_email_allowed(uuid,boolean) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';

-- The legacy trigger also runs on DELETE; handle deletion before inspecting NEW.
CREATE OR REPLACE FUNCTION public.process_tutor_verification_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_validator boolean:=public.is_academic_validator(auth.uid()); v_assessment boolean;
BEGIN
  IF TG_OP='DELETE' THEN
    IF (v_actor=OLD.tutor_id AND OLD.status='pending') OR (v_actor IS NULL AND coalesce(auth.role(),'')='service_role') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'No puedes eliminar esta solicitud de acreditación' USING ERRCODE='42501';
  END IF;
  v_assessment:=NEW.verification_source='assessment'
    AND public.valid_assessment_resolution(NEW.tutor_id,NEW.subject_id,NEW.assessment_attempt_id);
  IF TG_OP='INSERT' THEN
    IF v_actor IS NOT NULL AND NEW.tutor_id<>v_actor AND NOT v_assessment THEN
      RAISE EXCEPTION 'No puedes postular por otra persona' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects WHERE profile_id=NEW.tutor_id AND subject_id=NEW.subject_id) THEN
      RAISE EXCEPTION 'Primero registra la asignatura ofrecida' USING ERRCODE='23514';
    END IF;
    IF NOT v_assessment THEN
      NEW.verification_source:='teacher'; NEW.assessment_attempt_id:=NULL; NEW.status:='pending';
      NEW.reviewed_by:=NULL; NEW.reviewed_at:=NULL; NEW.reviewer_feedback:=NULL; NEW.practical_exercise_title:=NULL;
    END IF;
  ELSE
    IF NEW.tutor_id<>OLD.tutor_id OR NEW.subject_id<>OLD.subject_id
      OR NEW.verification_source<>OLD.verification_source OR NEW.assessment_attempt_id IS DISTINCT FROM OLD.assessment_attempt_id
      OR NEW.assigned_validator_id IS DISTINCT FROM OLD.assigned_validator_id THEN
      RAISE EXCEPTION 'Los datos de la postulación son inmutables' USING ERRCODE='42501';
    END IF;
    NEW.created_at:=OLD.created_at;
    IF v_actor=OLD.tutor_id THEN
      IF OLD.status IN ('approved','rejected') THEN RAISE EXCEPTION 'La solicitud ya fue resuelta' USING ERRCODE='23514'; END IF;
      IF NEW.status IN ('approved','rejected','requires_reevaluation') THEN
        RAISE EXCEPTION 'No puedes dictaminar tu propia postulación' USING ERRCODE='42501';
      END IF;
      NEW.practical_exercise_title:=OLD.practical_exercise_title; NEW.reviewer_feedback:=OLD.reviewer_feedback;
      NEW.reviewed_by:=OLD.reviewed_by; NEW.reviewed_at:=OLD.reviewed_at;
      NEW.status:=CASE WHEN nullif(trim(NEW.practical_submission),'') IS NOT NULL THEN 'under_review' ELSE OLD.status END;
    ELSIF v_validator THEN
      IF OLD.assigned_validator_id IS NOT NULL AND OLD.assigned_validator_id<>v_actor THEN
        RAISE EXCEPTION 'Esta solicitud está asignada a otro docente' USING ERRCODE='42501';
      END IF;
      IF NEW.status IN ('approved','rejected','requires_reevaluation') THEN NEW.reviewed_by:=v_actor; NEW.reviewed_at:=now(); END IF;
    ELSE
      RAISE EXCEPTION 'Se requiere un docente validador' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NEW.assigned_validator_id IS NOT NULL AND NOT public.is_academic_validator(NEW.assigned_validator_id) THEN
    RAISE EXCEPTION 'El docente debe estar registrado como validador' USING ERRCODE='23514';
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $$;
