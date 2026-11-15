-- Booking a tutor requires an accredited subject, including direct Data API calls.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.profile_offered_subjects') IS NULL OR to_regclass('public.tutoring_sessions') IS NULL THEN
  RAISE EXCEPTION 'Faltan las tablas de tutorias. Aplica primero las migraciones previas.';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.require_accredited_tutoring_subject()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.profile_offered_subjects
  WHERE profile_id=NEW.tutor_id AND subject_id=NEW.subject_id AND is_verified=true
 ) THEN
  RAISE EXCEPTION 'El tutor no tiene acreditada esta asignatura' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_accredited_tutoring_subject() FROM PUBLIC;
DROP TRIGGER IF EXISTS require_accredited_tutoring_subject ON public.tutoring_sessions;
CREATE TRIGGER require_accredited_tutoring_subject BEFORE INSERT ON public.tutoring_sessions
 FOR EACH ROW EXECUTE FUNCTION public.require_accredited_tutoring_subject();
NOTIFY pgrst,'reload schema';
COMMIT;
