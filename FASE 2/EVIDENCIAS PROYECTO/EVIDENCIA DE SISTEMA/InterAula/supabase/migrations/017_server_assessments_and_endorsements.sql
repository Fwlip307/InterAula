-- Server-owned accreditation attempts and real in-app teacher requests.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tutor_assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  level text NOT NULL DEFAULT 'basic' CHECK(level='basic'),
  questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions)>=5),
  answers jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(answers)='array'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','passed','failed','granted')),
  score integer NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100),
  revision integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tutor_assessment_attempts ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS tutor_assessment_user_created ON public.tutor_assessment_attempts(user_id,created_at);
ALTER TABLE public.tutor_assessment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_assessment_attempts FROM anon,authenticated;
GRANT ALL ON public.tutor_assessment_attempts TO service_role;
ALTER TABLE public.tutor_verification_requests
  ADD COLUMN IF NOT EXISTS verification_source text NOT NULL DEFAULT 'teacher',
  ADD COLUMN IF NOT EXISTS assessment_attempt_id uuid UNIQUE REFERENCES public.tutor_assessment_attempts(id),
  ADD COLUMN IF NOT EXISTS assigned_validator_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS requested_reviewer_name text,
  ADD COLUMN IF NOT EXISTS requested_reviewer_email text,
  ADD COLUMN IF NOT EXISTS endorsement_message text;

CREATE OR REPLACE FUNCTION public.valid_assessment_resolution(p_user_id uuid,p_subject_id uuid,p_attempt_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(auth.role(),'')='service_role' AND EXISTS(
    SELECT 1 FROM public.tutor_assessment_attempts a WHERE a.id=p_attempt_id AND a.user_id=p_user_id
      AND a.subject_id=p_subject_id AND a.state='granted' AND a.score>=70 AND a.level='basic'
      AND jsonb_array_length(a.answers)=jsonb_array_length(a.questions));
$$;
REVOKE ALL ON FUNCTION public.valid_assessment_resolution(uuid,uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.process_tutor_verification_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_validator boolean:=public.is_academic_validator(auth.uid()); v_assessment boolean;
BEGIN
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

CREATE OR REPLACE FUNCTION public.protect_profile_offered_subjects_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_authorized boolean;
BEGIN
  IF TG_OP='INSERT' THEN NEW.is_verified:=false; NEW.verified_at:=NULL; RETURN NEW; END IF;
  IF auth.uid()=OLD.profile_id THEN
    NEW.is_verified:=OLD.is_verified; NEW.verified_at:=OLD.verified_at;
    IF OLD.is_verified THEN NEW.level:=OLD.level; END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.level<>OLD.level THEN
    SELECT EXISTS(SELECT 1 FROM public.tutor_verification_requests r WHERE r.tutor_id=NEW.profile_id AND r.subject_id=NEW.subject_id AND r.status='approved'
      AND ((r.reviewed_by IS NOT NULL AND r.reviewed_by<>r.tutor_id AND public.is_academic_validator(r.reviewed_by))
        OR (r.verification_source='assessment' AND public.valid_assessment_resolution(r.tutor_id,r.subject_id,r.assessment_attempt_id)))) INTO v_authorized;
    IF NEW.is_verified AND NOT v_authorized THEN RAISE EXCEPTION 'Falta una resolución válida' USING ERRCODE='42501'; END IF;
    IF NOT NEW.is_verified THEN
      IF NOT public.is_academic_validator(auth.uid()) AND coalesce(auth.role(),'')<>'service_role' THEN
        RAISE EXCEPTION 'Se requiere un validador para revocar la acreditación' USING ERRCODE='42501';
      END IF;
      NEW.verified_at:=NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.sync_tutor_verification_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status='approved' THEN
    UPDATE public.profile_offered_subjects SET is_verified=true,verified_at=coalesce(NEW.reviewed_at,now()),
      level=CASE WHEN NEW.verification_source='assessment' THEN 'basic' ELSE coalesce(NEW.calculated_level,level) END
      WHERE profile_id=NEW.tutor_id AND subject_id=NEW.subject_id;
  ELSIF TG_OP='UPDATE' AND OLD.status='approved' THEN
    UPDATE public.profile_offered_subjects SET is_verified=false,verified_at=NULL WHERE profile_id=NEW.tutor_id AND subject_id=NEW.subject_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sync_tutor_verification_resolution ON public.tutor_verification_requests;
CREATE TRIGGER sync_tutor_verification_resolution AFTER INSERT OR UPDATE ON public.tutor_verification_requests FOR EACH ROW EXECUTE FUNCTION public.sync_tutor_verification_resolution();

CREATE OR REPLACE FUNCTION public.grant_tutor_assessment(p_attempt_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_attempt public.tutor_assessment_attempts%ROWTYPE; v_request public.tutor_verification_requests%ROWTYPE; v_verified boolean;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Operación reservada al servidor' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_attempt FROM public.tutor_assessment_attempts WHERE id=p_attempt_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evaluación no encontrada' USING ERRCODE='P0002'; END IF;
  IF v_attempt.state='granted' THEN
    SELECT * INTO v_request FROM public.tutor_verification_requests WHERE assessment_attempt_id=p_attempt_id;
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects WHERE profile_id=p_user_id AND subject_id=v_attempt.subject_id AND is_verified) THEN
      RAISE EXCEPTION 'La acreditación fue revocada o requiere revisión' USING ERRCODE='23514';
    END IF;
  ELSE
    IF v_attempt.state<>'passed' OR v_attempt.score<70 OR jsonb_array_length(v_attempt.answers)<>jsonb_array_length(v_attempt.questions)
      OR v_attempt.expires_at<=now() THEN RAISE EXCEPTION 'La evaluación no está aprobada o expiró' USING ERRCODE='23514'; END IF;
    PERFORM 1 FROM public.profile_offered_subjects WHERE profile_id=p_user_id AND subject_id=v_attempt.subject_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La asignatura ya no está ofrecida' USING ERRCODE='23514'; END IF;
    UPDATE public.tutor_assessment_attempts SET state='granted',granted_at=now(),updated_at=now() WHERE id=p_attempt_id;
    INSERT INTO public.tutor_verification_requests(tutor_id,subject_id,status,verification_source,assessment_attempt_id,reviewed_at,reviewer_feedback,calculated_level)
      VALUES(p_user_id,v_attempt.subject_id,'approved','assessment',p_attempt_id,now(),
        'Evaluación básica corregida por el servidor: '||v_attempt.score||'%.','basic') RETURNING * INTO v_request;
    SELECT is_verified INTO v_verified FROM public.profile_offered_subjects WHERE profile_id=p_user_id AND subject_id=v_attempt.subject_id;
    IF NOT coalesce(v_verified,false) OR v_request.status<>'approved' THEN RAISE EXCEPTION 'No se pudo confirmar la acreditación' USING ERRCODE='23514'; END IF;
    UPDATE public.profiles SET available_for_tutoring=true WHERE id=p_user_id;
  END IF;
  RETURN jsonb_build_object('success',true,'subject_id',v_attempt.subject_id,'level','basic','score',v_attempt.score,'request',to_jsonb(v_request));
END $$;
REVOKE ALL ON FUNCTION public.grant_tutor_assessment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tutor_assessment(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_teacher_endorsement(p_subject_id uuid,p_name text,p_email text,p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_validator uuid; v_request public.tutor_verification_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501'; END IF;
  IF length(p_name)>120 OR length(p_email)>254 OR length(p_message)>1500 THEN RAISE EXCEPTION 'Solicitud demasiado extensa' USING ERRCODE='23514'; END IF;
  SELECT a.profile_id INTO v_validator FROM public.academic_validators a JOIN auth.users u ON u.id=a.profile_id
    WHERE lower(u.email)=lower(trim(p_email)) AND a.profile_id<>auth.uid() LIMIT 1;
  IF v_validator IS NULL THEN RAISE EXCEPTION 'El correo debe corresponder a un docente validador registrado en InterAula' USING ERRCODE='23514'; END IF;
  INSERT INTO public.tutor_verification_requests(tutor_id,subject_id,assigned_validator_id,requested_reviewer_name,requested_reviewer_email,endorsement_message)
    VALUES(auth.uid(),p_subject_id,v_validator,trim(p_name),lower(trim(p_email)),p_message) RETURNING * INTO v_request;
  RETURN jsonb_build_object('id',v_request.id,'status',v_request.status,'delivery','in_app','assigned_validator_id',v_validator);
END $$;
REVOKE ALL ON FUNCTION public.request_teacher_endorsement(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_teacher_endorsement(uuid,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
