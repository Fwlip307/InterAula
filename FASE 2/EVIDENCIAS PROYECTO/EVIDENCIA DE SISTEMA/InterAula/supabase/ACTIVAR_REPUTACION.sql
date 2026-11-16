-- Ejecutar completo en SQL Editor del proyecto InterAula. Conserva registros e insignias.
BEGIN;
-- Valid completion, historical milestones and dynamic recent quality. No record deletions.
ALTER TABLE public.tutoring_sessions
 ADD COLUMN IF NOT EXISTS completion_policy_version integer NOT NULL DEFAULT 1 CHECK(completion_policy_version IN(0,1)),
 ADD COLUMN IF NOT EXISTS completion_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS completion_method text CHECK(completion_method IN('attendance','both_confirmed')),
 ADD COLUMN IF NOT EXISTS tutor_completion_confirmed_at timestamptz,
 ADD COLUMN IF NOT EXISTS student_completion_confirmed_at timestamptz;

-- Preserve transition authorization; completion itself is now restricted by the proof guard/RPC.
CREATE OR REPLACE FUNCTION public.enforce_tutoring_session_update_security()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() NOT IN(OLD.student_id,OLD.tutor_id) AND coalesce(auth.role(),'')<>'service_role' THEN
  RAISE EXCEPTION 'No perteneces a esta sesión' USING ERRCODE='42501';
 END IF;
 IF NEW.status<>OLD.status THEN
  IF NEW.status IN('accepted','rejected','in_progress') AND auth.uid() IS DISTINCT FROM OLD.tutor_id THEN
   RAISE EXCEPTION 'Solo el tutor puede realizar esta transición' USING ERRCODE='42501';
  END IF;
  IF NOT ((OLD.status='pending' AND NEW.status IN('accepted','rejected','cancelled'))
   OR (OLD.status='accepted' AND NEW.status IN('in_progress','completed','cancelled'))
   OR (OLD.status='in_progress' AND NEW.status IN('completed','cancelled'))) THEN
   RAISE EXCEPTION 'La sesión ya terminó o la transición no es válida' USING ERRCODE='23514';
  END IF;
 END IF;
 IF current_user IN('authenticated','anon') AND
  (NEW.attendance_verified IS DISTINCT FROM OLD.attendance_verified OR NEW.actual_duration_minutes IS DISTINCT FROM OLD.actual_duration_minutes
   OR NEW.student_joined_at IS DISTINCT FROM OLD.student_joined_at OR NEW.tutor_joined_at IS DISTINCT FROM OLD.tutor_joined_at
   OR NEW.both_connected_at IS DISTINCT FROM OLD.both_connected_at) THEN
  RAISE EXCEPTION 'La asistencia se registra por el flujo del aula' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_tutoring_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN('authenticated','anon') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.completion_policy_version<>1 OR NEW.completion_verified_at IS NOT NULL OR NEW.completion_method IS NOT NULL
    OR NEW.tutor_completion_confirmed_at IS NOT NULL OR NEW.student_completion_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'No puedes asignar evidencia de realización' USING ERRCODE='42501';
   END IF;
  ELSE
   IF NEW.completion_policy_version IS DISTINCT FROM OLD.completion_policy_version OR NEW.completion_verified_at IS DISTINCT FROM OLD.completion_verified_at
    OR NEW.completion_method IS DISTINCT FROM OLD.completion_method OR NEW.tutor_completion_confirmed_at IS DISTINCT FROM OLD.tutor_completion_confirmed_at
    OR NEW.student_completion_confirmed_at IS DISTINCT FROM OLD.student_completion_confirmed_at THEN
    RAISE EXCEPTION 'La confirmación se registra por su función segura' USING ERRCODE='42501';
   END IF;
   IF NEW.status='completed' AND OLD.status<>'completed' THEN
    RAISE EXCEPTION 'Confirma la realización desde la sesión' USING ERRCODE='42501';
   END IF;
  END IF;
 END IF;
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status<>'completed') THEN
  IF NEW.completion_policy_version<>1 OR NEW.completion_verified_at IS NULL OR NEW.completion_method IS NULL THEN
   RAISE EXCEPTION 'Falta evidencia de realización' USING ERRCODE='23514';
  END IF;
  IF NEW.completion_method='attendance' AND NOT NEW.attendance_verified THEN
   RAISE EXCEPTION 'Falta asistencia registrada' USING ERRCODE='23514';
  END IF;
  IF NEW.completion_method='both_confirmed' AND (NEW.tutor_completion_confirmed_at IS NULL OR NEW.student_completion_confirmed_at IS NULL) THEN
   RAISE EXCEPTION 'Ambos participantes deben confirmar' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_protect_tutoring_completion ON public.tutoring_sessions;
CREATE TRIGGER zz_protect_tutoring_completion BEFORE INSERT OR UPDATE ON public.tutoring_sessions
 FOR EACH ROW EXECUTE FUNCTION public.protect_tutoring_completion();

CREATE OR REPLACE FUNCTION public.confirm_tutoring_completion(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.tutoring_sessions%ROWTYPE; actor uuid:=auth.uid(); stamp timestamptz:=clock_timestamp(); proof text;
BEGIN
 SELECT * INTO s FROM public.tutoring_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR actor IS NULL OR actor NOT IN(s.tutor_id,s.student_id) THEN
  RAISE EXCEPTION 'No perteneces a esta sesión' USING ERRCODE='42501';
 END IF;
 IF s.status='completed' THEN
  RETURN jsonb_build_object('status',s.status,'verified',s.completion_verified_at IS NOT NULL);
 END IF;
 IF s.status NOT IN('accepted','in_progress') THEN
  RAISE EXCEPTION 'Esta sesión no admite confirmación' USING ERRCODE='23514';
 END IF;
 IF stamp<s.scheduled_at+interval '15 minutes' THEN
  RAISE EXCEPTION 'Confirma después de al menos 15 minutos desde el horario acordado' USING ERRCODE='23514';
 END IF;
 IF actor=s.tutor_id THEN s.tutor_completion_confirmed_at:=coalesce(s.tutor_completion_confirmed_at,stamp);
 ELSE s.student_completion_confirmed_at:=coalesce(s.student_completion_confirmed_at,stamp); END IF;
 proof:=CASE WHEN s.attendance_verified AND s.tutor_completion_confirmed_at IS NOT NULL THEN 'attendance'
  WHEN s.tutor_completion_confirmed_at IS NOT NULL AND s.student_completion_confirmed_at IS NOT NULL THEN 'both_confirmed' ELSE NULL END;
 UPDATE public.tutoring_sessions SET tutor_completion_confirmed_at=s.tutor_completion_confirmed_at,
  student_completion_confirmed_at=s.student_completion_confirmed_at,completion_method=proof,
  completion_verified_at=CASE WHEN proof IS NOT NULL THEN stamp ELSE NULL END,
  status=CASE WHEN proof IS NOT NULL THEN 'completed' ELSE s.status END,updated_at=stamp WHERE id=s.id;
 RETURN jsonb_build_object('status',CASE WHEN proof IS NOT NULL THEN 'completed' ELSE s.status END,'verified',proof IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.confirm_tutoring_completion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_tutoring_completion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_award_tutoring_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE total integer;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completion_verified_at IS NOT NULL THEN
  -- Serialize milestone calculations for a tutor so concurrent completions cannot miss a threshold.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tutor_id::text,26));
  SELECT count(*) INTO total FROM public.tutoring_sessions WHERE tutor_id=NEW.tutor_id AND status='completed' AND completion_verified_at IS NOT NULL;
  INSERT INTO public.user_badges(profile_id,badge_id)
   SELECT NEW.tutor_id,id FROM public.badges WHERE code IN('tutoring_1','tutoring_10','tutoring_25','tutoring_50') AND required_count<=total
   ON CONFLICT(profile_id,badge_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
UPDATE public.badges SET name=CASE code WHEN 'tutoring_1' THEN 'Primera tutoría realizada' WHEN 'tutoring_10' THEN '10 tutorías realizadas'
 WHEN 'tutoring_25' THEN '25 tutorías realizadas' WHEN 'tutoring_50' THEN '50 tutorías realizadas' END,
 description='Hito de trayectoria. Las nuevas sesiones requieren evidencia de realización; los reconocimientos anteriores se conservan como históricos.'
 WHERE code IN('tutoring_1','tutoring_10','tutoring_25','tutoring_50');

-- Public aggregate only: never exposes student identities, comments or confirmation timestamps.
CREATE OR REPLACE VIEW public.tutor_reputation_public WITH(security_barrier=true) AS
WITH sessions AS (
 SELECT tutor_id,count(*) FILTER(WHERE completion_verified_at IS NOT NULL)::int AS valid_sessions,
  count(*) FILTER(WHERE completion_verified_at IS NULL)::int AS legacy_sessions
 FROM public.tutoring_sessions WHERE status='completed' GROUP BY tutor_id
), recent AS (
 SELECT r.tutor_id,count(*)::int AS recent_reviews,count(DISTINCT r.student_id)::int AS recent_reviewers,
  round(avg(r.communication_score),2) AS communication_average,round(avg(r.knowledge_score),2) AS knowledge_average,
  round(avg(r.punctuality_score),2) AS punctuality_average,
  round((sum(r.communication_score)+35)::numeric/(count(*)+5),2) AS communication_adjusted,
  round((sum(r.knowledge_score)+35)::numeric/(count(*)+5),2) AS knowledge_adjusted,
  round((sum(r.punctuality_score)+35)::numeric/(count(*)+5),2) AS punctuality_adjusted
 FROM public.tutoring_reviews r JOIN public.tutoring_sessions s ON s.id=r.session_id AND s.status='completed' AND s.completion_verified_at IS NOT NULL
 WHERE r.created_at>=now()-interval '90 days' GROUP BY r.tutor_id
)
SELECT p.id AS profile_id,coalesce(s.valid_sessions,0) AS valid_sessions,coalesce(s.legacy_sessions,0) AS legacy_sessions,
 coalesce(r.recent_reviews,0) AS recent_reviews,coalesce(r.recent_reviewers,0) AS recent_reviewers,
 r.communication_average,r.knowledge_average,r.punctuality_average,r.communication_adjusted,r.knowledge_adjusted,r.punctuality_adjusted,
 coalesce(r.recent_reviews>=10 AND r.recent_reviewers>=5 AND r.communication_adjusted>=8.5,false) AS communication_highlight,
 coalesce(r.recent_reviews>=10 AND r.recent_reviewers>=5 AND r.knowledge_adjusted>=8.5,false) AS knowledge_highlight,
 coalesce(r.recent_reviews>=10 AND r.recent_reviewers>=5 AND r.punctuality_adjusted>=8.5,false) AS punctuality_highlight
FROM public.public_profiles p LEFT JOIN sessions s ON s.tutor_id=p.id LEFT JOIN recent r ON r.tutor_id=p.id;
REVOKE ALL ON public.tutor_reputation_public FROM PUBLIC,anon;
GRANT SELECT ON public.tutor_reputation_public TO authenticated,service_role;
NOTIFY pgrst,'reload schema';

COMMIT;
SELECT 'Reputacion y sesiones verificables activadas' AS estado,
 to_regprocedure('public.confirm_tutoring_completion(uuid)') IS NOT NULL AS confirmaciones_activadas,
 to_regclass('public.tutor_reputation_public') IS NOT NULL AS reputacion_activada;
