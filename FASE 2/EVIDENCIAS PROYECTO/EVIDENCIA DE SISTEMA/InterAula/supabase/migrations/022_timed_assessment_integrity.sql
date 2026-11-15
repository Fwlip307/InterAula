BEGIN;
ALTER TABLE public.tutor_assessment_attempts
  ADD COLUMN IF NOT EXISTS policy_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS time_mode text NOT NULL DEFAULT 'standard' CHECK(time_mode IN('standard','extended')),
  ADD COLUMN IF NOT EXISTS question_source text NOT NULL DEFAULT 'reviewed' CHECK(question_source IN('reviewed','generated')),
  ADD COLUMN IF NOT EXISTS question_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS integrity_count integer NOT NULL DEFAULT 0 CHECK(integrity_count>=0),
  ADD COLUMN IF NOT EXISTS integrity_events jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(integrity_events)='array');
-- Questions, solutions and evidence stay server-only; no client table grants.
REVOKE ALL ON public.tutor_assessment_attempts FROM anon,authenticated;
GRANT ALL ON public.tutor_assessment_attempts TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
