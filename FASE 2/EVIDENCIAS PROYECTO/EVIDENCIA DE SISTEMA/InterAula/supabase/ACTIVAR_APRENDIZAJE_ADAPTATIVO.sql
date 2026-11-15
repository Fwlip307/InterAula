BEGIN;
CREATE TABLE IF NOT EXISTS public.adaptive_learning_goals(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 course_id text NOT NULL CHECK(course_id='calculo-piloto-v1'),
 goal_skill_id text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,course_id));
CREATE TABLE IF NOT EXISTS public.adaptive_skill_mastery(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 course_id text NOT NULL CHECK(course_id='calculo-piloto-v1'),
 skill_id text NOT NULL,model_version text NOT NULL DEFAULT 'bkt-calculo-v1',
 mastery double precision NOT NULL DEFAULT 0.2 CHECK(mastery BETWEEN 0 AND 1),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 correct_count integer NOT NULL DEFAULT 0 CHECK(correct_count>=0 AND correct_count<=attempts),
 independent_correct_ids text[] NOT NULL DEFAULT '{}',
 last_correct boolean,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,course_id,skill_id));
CREATE TABLE IF NOT EXISTS public.adaptive_practice_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 course_id text NOT NULL CHECK(course_id='calculo-piloto-v1'),
 skill_id text NOT NULL,model_version text NOT NULL DEFAULT 'bkt-calculo-v1',
 template_id text NOT NULL,exercise jsonb NOT NULL CHECK(jsonb_typeof(exercise)='object'),
 hint_used boolean NOT NULL DEFAULT false,answer_given text,correct boolean,
 predicted_correct double precision,mastery_before double precision,mastery_after double precision,
 response_snapshot jsonb,created_at timestamptz NOT NULL DEFAULT now(),answered_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS adaptive_one_pending_per_course ON public.adaptive_practice_attempts(user_id,course_id) WHERE answered_at IS NULL;
CREATE INDEX IF NOT EXISTS adaptive_practice_history ON public.adaptive_practice_attempts(user_id,course_id,created_at DESC);
ALTER TABLE public.adaptive_learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_skill_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_practice_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.adaptive_learning_goals,public.adaptive_skill_mastery,public.adaptive_practice_attempts FROM anon,authenticated;
GRANT ALL ON public.adaptive_learning_goals,public.adaptive_skill_mastery,public.adaptive_practice_attempts TO service_role;
GRANT SELECT ON public.adaptive_learning_goals,public.adaptive_skill_mastery TO authenticated;
DROP POLICY IF EXISTS adaptive_goals_own ON public.adaptive_learning_goals;
CREATE POLICY adaptive_goals_own ON public.adaptive_learning_goals FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS adaptive_mastery_own ON public.adaptive_skill_mastery;
CREATE POLICY adaptive_mastery_own ON public.adaptive_skill_mastery FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.submit_adaptive_practice(p_attempt_id uuid,p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.adaptive_practice_attempts%ROWTYPE;m public.adaptive_skill_mastery%ROWTYPE;
 is_correct boolean;prediction double precision;observed double precision;posterior double precision;
 ids text[];snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Se requiere autenticacion' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.adaptive_practice_attempts WHERE id=p_attempt_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ejercicio no encontrado' USING ERRCODE='P0002'; END IF;
 IF a.model_version<>'bkt-calculo-v1' THEN RAISE EXCEPTION 'Version de modelo no disponible' USING ERRCODE='23514'; END IF;
 IF a.answered_at IS NOT NULL THEN
  IF a.answer_given IS DISTINCT FROM p_answer THEN RAISE EXCEPTION 'El ejercicio ya fue respondido' USING ERRCODE='40001'; END IF;
  RETURN a.response_snapshot;
 END IF;
 IF p_answer IS NULL OR p_answer NOT IN('a','b','c','d','skip') OR (p_answer<>'skip' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.exercise->'options') o WHERE o->>'id'=p_answer)) THEN
  RAISE EXCEPTION 'Selecciona una alternativa del ejercicio' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.adaptive_skill_mastery(user_id,course_id,skill_id) VALUES(a.user_id,a.course_id,a.skill_id)
  ON CONFLICT(user_id,course_id,skill_id) DO NOTHING;
 SELECT * INTO m FROM public.adaptive_skill_mastery WHERE user_id=a.user_id AND course_id=a.course_id AND skill_id=a.skill_id FOR UPDATE;
 IF m.model_version<>a.model_version THEN RAISE EXCEPTION 'Version de avance incompatible' USING ERRCODE='23514'; END IF;
 is_correct:=p_answer=a.exercise->>'correctOptionId';
 -- Fixed BKT v1: prior=.2, learn=.1, slip=.1, guess=.25. Not fitted to student data.
 prediction:=m.mastery*0.9+(1-m.mastery)*0.25;
 observed:=CASE WHEN a.hint_used THEN m.mastery
  WHEN is_correct THEN m.mastery*0.9/prediction
  ELSE m.mastery*0.1/(m.mastery*0.1+(1-m.mastery)*0.75) END;
 posterior:=CASE WHEN a.hint_used THEN m.mastery ELSE observed+(1-observed)*0.1 END;
 ids:=m.independent_correct_ids;
 IF is_correct AND NOT a.hint_used AND NOT(a.template_id=ANY(ids)) THEN ids:=array_append(ids,a.template_id);END IF;
 snapshot:=jsonb_build_object('attemptId',a.id,'skillId',a.skill_id,'correct',is_correct,
  'feedback',a.exercise->>'explanation','correctOptionId',a.exercise->>'correctOptionId',
  'hintUsed',a.hint_used,'skipped',p_answer='skip','masteryBefore',m.mastery,'masteryAfter',posterior,'predictedCorrect',prediction,
  'distinctIndependentCorrect',cardinality(ids),'modelVersion',a.model_version);
 UPDATE public.adaptive_skill_mastery SET mastery=posterior,attempts=attempts+1,
  correct_count=correct_count+CASE WHEN is_correct THEN 1 ELSE 0 END,
  independent_correct_ids=ids,last_correct=is_correct AND NOT a.hint_used,updated_at=now()
  WHERE user_id=a.user_id AND course_id=a.course_id AND skill_id=a.skill_id;
 UPDATE public.adaptive_practice_attempts SET answer_given=p_answer,correct=is_correct,
  predicted_correct=prediction,mastery_before=m.mastery,mastery_after=posterior,
  answered_at=now(),response_snapshot=snapshot WHERE id=a.id;
 RETURN snapshot;
END $$;
REVOKE ALL ON FUNCTION public.submit_adaptive_practice(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_adaptive_practice(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

SELECT 'Aprendizaje adaptativo activado' AS estado,to_regprocedure('public.submit_adaptive_practice(uuid,text)') IS NOT NULL AS motor_activado;

