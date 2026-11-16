-- Apply after 017. Private preferences, explicit sharing and reversible feedback.
BEGIN;
CREATE TABLE IF NOT EXISTS public.recommendation_topics (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{1,49}$'),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}'
);
INSERT INTO public.recommendation_topics(id,name,category,aliases) VALUES
 ('python','Python','Tecnología',ARRAY['python','pandas','numpy']),
 ('javascript','JavaScript y TypeScript','Tecnología',ARRAY['javascript','typescript','nodejs','node.js']),
 ('java','Java','Tecnología',ARRAY['java','spring boot']),
 ('web','Desarrollo web','Tecnología',ARRAY['desarrollo web','programación web','react','html','css','frontend','backend']),
 ('databases','Bases de datos y SQL','Tecnología',ARRAY['bases de datos','base de datos','sql','postgresql','mysql']),
 ('algorithms','Algoritmos y programación','Tecnología',ARRAY['algoritmos','programación de algoritmos','estructuras de datos','recursividad']),
 ('data-science','Análisis de datos','Tecnología',ARRAY['análisis de datos','analítica de datos','data science','power bi']),
 ('machine-learning','Inteligencia artificial','Tecnología',ARRAY['inteligencia artificial','machine learning','clustering','aprendizaje automático']),
 ('cybersecurity','Ciberseguridad y redes','Tecnología',ARRAY['ciberseguridad','seguridad informática','redes','pentesting']),
 ('software','Arquitectura y calidad de software','Tecnología',ARRAY['arquitectura de software','ingeniería de software','testing','pruebas de software']),
 ('mathematics','Matemáticas','Ciencias',ARRAY['matemáticas','matemática','álgebra','cálculo','ecuaciones']),
 ('statistics','Estadística','Ciencias',ARRAY['estadística','probabilidad','inferencia estadística']),
 ('physics','Física','Ciencias',ARRAY['física','mecánica','termodinámica']),
 ('biology','Biología y salud','Ciencias',ARRAY['biología','salud','anatomía','enfermería']),
 ('design','Diseño y experiencia de usuario','Diseño',ARRAY['diseño','experiencia de usuario','ux','figma','usabilidad']),
 ('business','Administración y emprendimiento','Negocios',ARRAY['administración','emprendimiento','modelo de negocio','gestión de proyectos']),
 ('economics','Economía y finanzas','Negocios',ARRAY['economía','finanzas','contabilidad','presupuesto']),
 ('marketing','Marketing y comunicación','Negocios',ARRAY['marketing','comunicación','publicidad']),
 ('english','Inglés','Humanidades',ARRAY['inglés','english']),
 ('writing','Escritura e investigación','Humanidades',ARRAY['escritura','investigación','redacción','tesis']),
 ('education','Educación','Humanidades',ARRAY['educación','pedagogía','didáctica']),
 ('sustainability','Sustentabilidad','Comunidad',ARRAY['sustentabilidad','sostenibilidad','medio ambiente','reciclaje'])
ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,aliases=excluded.aliases;

CREATE TABLE IF NOT EXISTS public.recommendation_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  personalization_enabled boolean NOT NULL DEFAULT true,
  discoverable boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_topic_interests (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id text NOT NULL REFERENCES public.recommendation_topics(id) ON DELETE RESTRICT,
  intent text NOT NULL CHECK(intent IN ('interest','learn','teach')),
  PRIMARY KEY(user_id,topic_id,intent)
);
CREATE INDEX IF NOT EXISTS topic_interests_topic ON public.user_topic_interests(topic_id,intent);
CREATE TABLE IF NOT EXISTS public.recommendation_dismissals (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('note','post','project','workshop','person')),
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,kind,item_id)
);
ALTER TABLE public.recommendation_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_topic_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommendation_topics_read ON public.recommendation_topics;
CREATE POLICY recommendation_topics_read ON public.recommendation_topics FOR SELECT TO authenticated,anon USING(true);
DROP POLICY IF EXISTS recommendation_preferences_own ON public.recommendation_preferences;
CREATE POLICY recommendation_preferences_own ON public.recommendation_preferences FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS topic_interests_own ON public.user_topic_interests;
CREATE POLICY topic_interests_own ON public.user_topic_interests FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS recommendation_dismissals_own ON public.recommendation_dismissals;
CREATE POLICY recommendation_dismissals_own ON public.recommendation_dismissals FOR ALL TO authenticated
  USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
REVOKE ALL ON public.recommendation_preferences,public.user_topic_interests,public.recommendation_dismissals FROM anon,authenticated;
GRANT SELECT ON public.recommendation_topics TO anon,authenticated;
GRANT SELECT ON public.recommendation_preferences,public.user_topic_interests TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.recommendation_dismissals TO authenticated;
GRANT ALL ON public.recommendation_topics,public.recommendation_preferences,public.user_topic_interests,public.recommendation_dismissals TO service_role;

-- This deliberately public projection exposes only opted-in topics, never private preferences.
CREATE OR REPLACE VIEW public.discoverable_topic_interests WITH (security_barrier=true) AS
SELECT i.user_id,i.topic_id,i.intent FROM public.user_topic_interests i
JOIN public.recommendation_preferences p ON p.user_id=i.user_id
WHERE p.discoverable AND p.personalization_enabled;
REVOKE ALL ON public.discoverable_topic_interests FROM PUBLIC,anon;
GRANT SELECT ON public.discoverable_topic_interests TO authenticated;

CREATE OR REPLACE FUNCTION public.save_recommendation_preferences(p_document jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_user uuid:=auth.uid(); v_revision integer; v_intent text; v_values jsonb;
BEGIN
  IF v_user IS NULL OR coalesce(auth.role(),'')<>'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_document)<>'object' OR jsonb_typeof(p_document->'revision') IS DISTINCT FROM 'number'
     OR (p_document->>'revision') !~ '^[0-9]{1,9}$'
     OR jsonb_typeof(p_document->'personalization_enabled') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_document->'discoverable') IS DISTINCT FROM 'boolean'
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_document) k WHERE k NOT IN ('revision','personalization_enabled','discoverable','interest','learn','teach')) THEN
    RAISE EXCEPTION 'Invalid preference document' USING ERRCODE='23514';
  END IF;
  FOREACH v_intent IN ARRAY ARRAY['interest','learn','teach'] LOOP
    v_values:=p_document->v_intent;
    IF jsonb_typeof(v_values) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Expected topics array' USING ERRCODE='23514';
    END IF;
    IF jsonb_array_length(v_values)>12 OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_values) x WHERE jsonb_typeof(x)<>'string')
       OR (SELECT count(*) FROM jsonb_array_elements_text(v_values))<>(SELECT count(DISTINCT x) FROM jsonb_array_elements_text(v_values) x)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_values) x WHERE NOT EXISTS(SELECT 1 FROM public.recommendation_topics t WHERE t.id=x)) THEN
      RAISE EXCEPTION 'Invalid or repeated topics' USING ERRCODE='23514';
    END IF;
  END LOOP;
  INSERT INTO public.recommendation_preferences(user_id) VALUES(v_user) ON CONFLICT(user_id) DO NOTHING;
  SELECT revision INTO v_revision FROM public.recommendation_preferences WHERE user_id=v_user FOR UPDATE;
  IF v_revision<>(p_document->>'revision')::integer THEN
    RAISE EXCEPTION 'Preference version conflict' USING ERRCODE='40001';
  END IF;
  UPDATE public.recommendation_preferences SET
    personalization_enabled=(p_document->>'personalization_enabled')::boolean,
    discoverable=(p_document->>'discoverable')::boolean,revision=revision+1,updated_at=now()
    WHERE user_id=v_user;
  DELETE FROM public.user_topic_interests WHERE user_id=v_user;
  FOREACH v_intent IN ARRAY ARRAY['interest','learn','teach'] LOOP
    INSERT INTO public.user_topic_interests(user_id,topic_id,intent)
      SELECT v_user,x,v_intent FROM jsonb_array_elements_text(p_document->v_intent) x;
  END LOOP;
  RETURN (p_document - 'revision') || jsonb_build_object('revision',v_revision+1);
END $$;
REVOKE ALL ON FUNCTION public.save_recommendation_preferences(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_recommendation_preferences(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_recommendation_preferences()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object(
    'revision',coalesce((SELECT revision FROM public.recommendation_preferences WHERE user_id=auth.uid()),0),
    'personalization_enabled',coalesce((SELECT personalization_enabled FROM public.recommendation_preferences WHERE user_id=auth.uid()),true),
    'discoverable',coalesce((SELECT discoverable FROM public.recommendation_preferences WHERE user_id=auth.uid()),false),
    'interest',coalesce((SELECT jsonb_agg(topic_id ORDER BY topic_id) FROM public.user_topic_interests WHERE user_id=auth.uid() AND intent='interest'),'[]'::jsonb),
    'learn',coalesce((SELECT jsonb_agg(topic_id ORDER BY topic_id) FROM public.user_topic_interests WHERE user_id=auth.uid() AND intent='learn'),'[]'::jsonb),
    'teach',coalesce((SELECT jsonb_agg(topic_id ORDER BY topic_id) FROM public.user_topic_interests WHERE user_id=auth.uid() AND intent='teach'),'[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_recommendation_preferences() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_recommendation_preferences() TO authenticated;
COMMIT;
