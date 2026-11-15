-- InterAula: activar comunidad academica y corregir apoyos inclusivos.
-- Ejecutar en el SQL Editor del mismo proyecto Supabase. Requiere 001-018.
-- Transaccion unica; conserva perfiles, intereses, contenidos y datos DEMO.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.recommendation_topics') IS NULL OR to_regclass('public.study_tasks') IS NULL THEN
   RAISE EXCEPTION 'Falta la base previa (migraciones hasta 018). No se realizo la activacion.';
 END IF;
END $$;

-- 019_inclusive_learning_features.sql
-- ==============================================================================
-- MIGRACIÓN 019: FUNCIONALIDADES DE APRENDIZAJE INCLUSIVO, TEA, TDAH, DISLEXIA Y ACOMPAÑAMIENTO
-- Idempotente, transaccional y con políticas RLS estrictas.
-- ==============================================================================

-- 1. Bandeja de ideas y dudas rápidas ("Ideas y dudas para después")
CREATE TABLE IF NOT EXISTS public.quick_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context_type text NOT NULL DEFAULT 'learning_space'
    CHECK (context_type IN ('learning_space', 'tutoring', 'workshop', 'general')),
  context_id text,
  content text NOT NULL CHECK (length(trim(content)) >= 2 AND length(content) <= 1000),
  resolved boolean NOT NULL DEFAULT false,
  converted_task_id uuid REFERENCES public.study_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_ideas_user_id ON public.quick_ideas(user_id, created_at DESC);

ALTER TABLE public.quick_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quick_ideas_owner_all ON public.quick_ideas;
CREATE POLICY quick_ideas_owner_all
  ON public.quick_ideas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Guion anticipado, previsualización de sesiones y material anticipado en tutorías y talleres
ALTER TABLE public.tutoring_sessions
  ADD COLUMN IF NOT EXISTS agenda_preview jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS camera_policy text NOT NULL DEFAULT 'optional'
    CHECK (camera_policy IN ('optional', 'recommended', 'required')),
  ADD COLUMN IF NOT EXISTS participation_mode text NOT NULL DEFAULT 'chat_or_voice'
    CHECK (participation_mode IN ('chat_only', 'chat_or_voice', 'voice_preferred')),
  ADD COLUMN IF NOT EXISTS participation_rules text NOT NULL DEFAULT 'Puedes participar por chat escrito o voz según tu comodidad. Las pausas están permitidas en cualquier momento.',
  ADD COLUMN IF NOT EXISTS anticipated_materials jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.tutoring_workshops
  ADD COLUMN IF NOT EXISTS agenda_preview jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS camera_policy text NOT NULL DEFAULT 'optional'
    CHECK (camera_policy IN ('optional', 'recommended', 'required')),
  ADD COLUMN IF NOT EXISTS participation_mode text NOT NULL DEFAULT 'chat_or_voice'
    CHECK (participation_mode IN ('chat_only', 'chat_or_voice', 'voice_preferred')),
  ADD COLUMN IF NOT EXISTS participation_rules text NOT NULL DEFAULT 'Puedes participar por chat escrito o voz según tu comodidad. No es obligatorio encender la cámara.',
  ADD COLUMN IF NOT EXISTS anticipated_materials jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Semáforo de comunicación en Aula Virtual (privado a la sala de la sesión/taller)
CREATE TABLE IF NOT EXISTS public.virtual_classroom_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal text NOT NULL CHECK (signal IN ('green', 'yellow', 'blue', 'red')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_classroom_user_signal UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_signals_room ON public.virtual_classroom_signals(room_id, updated_at DESC);

ALTER TABLE public.virtual_classroom_signals ENABLE ROW LEVEL SECURITY;

-- Función de pertenencia a sala virtual (sesión 1:1 o taller)
CREATE OR REPLACE FUNCTION public.can_access_classroom_room(p_room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tutoring_sessions ts
    WHERE (ts.id::text = p_room_id OR ('session-' || ts.id::text) = p_room_id)
      AND (ts.student_id = auth.uid() OR ts.tutor_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.tutoring_workshops tw
    WHERE tw.room_id = p_room_id
      AND (
        tw.tutor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workshop_enrollments we
          WHERE we.workshop_id = tw.id AND we.student_id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_classroom_room(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_classroom_room(text) TO authenticated, service_role;

DROP POLICY IF EXISTS classroom_signals_select ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_select
  ON public.virtual_classroom_signals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.can_access_classroom_room(room_id));

DROP POLICY IF EXISTS classroom_signals_insert ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_insert
  ON public.virtual_classroom_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_access_classroom_room(room_id));

DROP POLICY IF EXISTS classroom_signals_update ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_update
  ON public.virtual_classroom_signals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.can_access_classroom_room(room_id))
  WITH CHECK (auth.uid() = user_id AND public.can_access_classroom_room(room_id));

DROP POLICY IF EXISTS classroom_signals_delete ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_delete
  ON public.virtual_classroom_signals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Acreditación verificable de tutores con formación en acompañamiento inclusivo
CREATE TABLE IF NOT EXISTS public.inclusive_tutor_accreditations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  training_name text NOT NULL CHECK (length(trim(training_name)) >= 3 AND length(training_name) <= 200),
  evidence_notes text NOT NULL DEFAULT '',
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inclusive_accreditations_status ON public.inclusive_tutor_accreditations(status);

ALTER TABLE public.inclusive_tutor_accreditations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inclusive_accreditations_select ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_select
  ON public.inclusive_tutor_accreditations
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'
    OR tutor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.academic_validators av WHERE av.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS inclusive_accreditations_insert ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_insert
  ON public.inclusive_tutor_accreditations
  FOR INSERT
  TO authenticated
  WITH CHECK (tutor_id = auth.uid() AND status = 'pending' AND verified_by IS NULL);

DROP POLICY IF EXISTS inclusive_accreditations_validator_update ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_validator_update
  ON public.inclusive_tutor_accreditations
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academic_validators av WHERE av.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.academic_validators av WHERE av.profile_id = auth.uid()));

-- 5. Micro-entregables y roles claros en ProjectsHub
CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) >= 2 AND length(title) <= 200),
  description text NOT NULL DEFAULT '',
  expected_format text NOT NULL DEFAULT 'Documento o avance escrito',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed')),
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_deliverables_project_id ON public.project_deliverables(project_id, created_at ASC);

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_deliverables_select ON public.project_deliverables;
CREATE POLICY project_deliverables_select
  ON public.project_deliverables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deliverables.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS project_deliverables_write ON public.project_deliverables;
CREATE POLICY project_deliverables_write
  ON public.project_deliverables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deliverables.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deliverables.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
          )
        )
    )
  );



-- 020_inclusive_flows_integrity.sql
-- Requires 019. Safe to repeat; does not delete application data.

ALTER TABLE public.tutoring_workshops ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'online'
  CHECK(modality IN('online','in_person','hybrid'));
ALTER TABLE public.tutoring_workshops ADD COLUMN IF NOT EXISTS location_details text;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tutoring_sessions','tutoring_workshops'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',t,t||'_camera_policy_check');
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',t,t||'_participation_mode_check');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN participation_mode SET DEFAULT ''mixed''',t);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK(camera_policy IN (''optional'',''recommended'',''required'',''off''))',t,t||'_camera_policy_check');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK(participation_mode IN (''mixed'',''chat_first'',''voice_or_chat'',''chat_only'',''chat_or_voice'',''voice_preferred''))',t,t||'_participation_mode_check');
  END LOOP;
END $$;

-- Preserve the existing view column order when appending the new fields.
DO $$ DECLARE fields text; name text; BEGIN
  SELECT string_agg(CASE WHEN attname='enrollments_count'
    THEN '(SELECT count(*) FROM public.workshop_enrollments e WHERE e.workshop_id=w.id) AS enrollments_count'
    ELSE format('w.%I',attname) END,',' ORDER BY attnum) INTO fields
    FROM pg_attribute WHERE attrelid='public.workshop_summary'::regclass AND attnum>0 AND NOT attisdropped;
  FOREACH name IN ARRAY ARRAY['agenda_preview','camera_policy','participation_mode','participation_rules','anticipated_materials','modality','location_details'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.workshop_summary'::regclass AND attname=name AND attnum>0 AND NOT attisdropped) THEN
      fields:=fields||format(',w.%I',name);
    END IF;
  END LOOP;
  EXECUTE 'CREATE OR REPLACE VIEW public.workshop_summary AS SELECT '||fields||' FROM public.tutoring_workshops w';
END $$;

CREATE OR REPLACE FUNCTION public.can_access_classroom_room(p_room_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.tutoring_sessions s
    WHERE (s.room_id=p_room_id OR s.id::text=p_room_id OR 'session-'||s.id::text=p_room_id)
      AND auth.uid() IN(s.student_id,s.tutor_id))
  OR EXISTS(SELECT 1 FROM public.tutoring_workshops w WHERE w.room_id=p_room_id
    AND (w.tutor_id=auth.uid() OR EXISTS(SELECT 1 FROM public.workshop_enrollments e WHERE e.workshop_id=w.id AND e.student_id=auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.can_access_classroom_room(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_classroom_room(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_session_preparation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.role()<>'service_role' AND auth.uid()<>OLD.tutor_id
    AND (NEW.agenda_preview IS DISTINCT FROM OLD.agenda_preview OR NEW.camera_policy IS DISTINCT FROM OLD.camera_policy
      OR NEW.participation_mode IS DISTINCT FROM OLD.participation_mode OR NEW.participation_rules IS DISTINCT FROM OLD.participation_rules
      OR NEW.anticipated_materials IS DISTINCT FROM OLD.anticipated_materials) THEN
    RAISE EXCEPTION 'Solo el tutor configura la preparacion de la sesion' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_session_preparation ON public.tutoring_sessions;
CREATE TRIGGER guard_session_preparation BEFORE UPDATE ON public.tutoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_preparation();

DROP POLICY IF EXISTS inclusive_accreditations_validator_update ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_validator_update ON public.inclusive_tutor_accreditations FOR UPDATE TO authenticated
  USING(tutor_id<>auth.uid() AND public.is_academic_validator(auth.uid()))
  WITH CHECK(tutor_id<>auth.uid() AND public.is_academic_validator(auth.uid()));
DROP POLICY IF EXISTS inclusive_accreditations_resubmit ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_resubmit ON public.inclusive_tutor_accreditations FOR UPDATE TO authenticated
  USING(tutor_id=auth.uid() AND status<>'approved')
  WITH CHECK(tutor_id=auth.uid() AND status='pending' AND verified_by IS NULL AND verified_at IS NULL);

CREATE OR REPLACE FUNCTION public.guard_inclusive_accreditation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role()='service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Se requiere autenticacion' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.tutor_id<>OLD.tutor_id OR NEW.created_at<>OLD.created_at) THEN
    RAISE EXCEPTION 'No se puede cambiar el titular de la acreditacion' USING ERRCODE='42501';
  END IF;
  IF NEW.tutor_id=auth.uid() THEN
    IF NEW.status<>'pending' OR (TG_OP='UPDATE' AND OLD.status='approved') THEN
      RAISE EXCEPTION 'No puedes revisar tu propia acreditacion' USING ERRCODE='42501';
    END IF;
    NEW.verified_by:=NULL; NEW.verified_at:=NULL;
  ELSE
    IF TG_OP='INSERT' OR NOT public.is_academic_validator(auth.uid()) OR NEW.status NOT IN('approved','revoked') THEN
      RAISE EXCEPTION 'Se requiere otro validador' USING ERRCODE='42501';
    END IF;
    IF NEW.training_name<>OLD.training_name OR NEW.evidence_notes<>OLD.evidence_notes THEN
      RAISE EXCEPTION 'El validador no puede cambiar la evidencia' USING ERRCODE='42501';
    END IF;
    NEW.verified_by:=auth.uid(); NEW.verified_at:=now();
  END IF;
  NEW.updated_at:=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_inclusive_accreditation ON public.inclusive_tutor_accreditations;
CREATE TRIGGER guard_inclusive_accreditation BEFORE INSERT OR UPDATE ON public.inclusive_tutor_accreditations
  FOR EACH ROW EXECUTE FUNCTION public.guard_inclusive_accreditation();

CREATE OR REPLACE FUNCTION public.convert_quick_idea_to_task(p_id uuid,p_options jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE idea public.quick_ideas%ROWTYPE; task public.study_tasks%ROWTYPE; title text;
BEGIN
  SELECT * INTO idea FROM public.quick_ideas WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Idea no encontrada' USING ERRCODE='42501'; END IF;
  IF idea.converted_task_id IS NOT NULL THEN
    SELECT * INTO task FROM public.study_tasks WHERE id=idea.converted_task_id AND user_id=auth.uid();
    IF FOUND THEN RETURN jsonb_build_object('idea',to_jsonb(idea),'task',to_jsonb(task)); END IF;
  END IF;
  title:=coalesce(nullif(trim(p_options->>'title'),''),left(idea.content,180));
  IF length(title)<3 THEN title:='Revisar: '||title; END IF;
  INSERT INTO public.study_tasks(user_id,title,subject_name,priority,subtasks)
    VALUES(auth.uid(),title,coalesce(nullif(trim(p_options->>'subject_name'),''),'General'),coalesce(p_options->>'priority','media'),
      jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','Revisar los conceptos principales','completed',false))) RETURNING * INTO task;
  UPDATE public.quick_ideas SET resolved=true,converted_task_id=task.id,updated_at=now() WHERE id=idea.id RETURNING * INTO idea;
  RETURN jsonb_build_object('idea',to_jsonb(idea),'task',to_jsonb(task));
END $$;
REVOKE ALL ON FUNCTION public.convert_quick_idea_to_task(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_quick_idea_to_task(uuid,jsonb) TO authenticated;

-- Return only explicitly shared supports, never private notes or the whole profile.
CREATE OR REPLACE FUNCTION public.get_shared_learning_supports(p_project_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('student_id',id,'display_name',display_name,'supports',supports)),'[]'::jsonb)
  FROM (SELECT p.id,coalesce(p.display_name,p.first_name,'Estudiante') AS display_name,
    (SELECT coalesce(jsonb_agg(k),'[]'::jsonb) FROM jsonb_array_elements_text(coalesce(p.learning_space_config->'supportPassport'->'selectedSupports','[]'::jsonb)) k
      WHERE coalesce(p.learning_space_config->'supportPassport'->'sharedItemKeys','[]'::jsonb) ? k) AS supports
    FROM public.profiles p WHERE auth.uid() IS NOT NULL AND p.id<>auth.uid()
    AND CASE WHEN p_project_id IS NULL THEN
      coalesce(p.learning_space_config->'supportPassport'->'sharedWithTutorIds','[]'::jsonb) ? auth.uid()::text
    ELSE coalesce(p.learning_space_config->'supportPassport'->'sharedWithProjectIds','[]'::jsonb) ? p_project_id::text
      AND EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=p_project_id AND m.profile_id=auth.uid())
      AND EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=p_project_id AND m.profile_id=p.id)
    END LIMIT 100) selected WHERE jsonb_array_length(supports)>0;
$$;
REVOKE ALL ON FUNCTION public.get_shared_learning_supports(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_learning_supports(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_project_deliverable()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE last_comment jsonb;
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=NEW.project_id AND m.profile_id=NEW.assignee_id) THEN
    RAISE EXCEPTION 'El responsable debe pertenecer al proyecto' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.created_by<>auth.uid() OR NEW.comments<>'[]'::jsonb THEN RAISE EXCEPTION 'Autor no valido' USING ERRCODE='42501'; END IF;
  ELSE
    IF NEW.project_id<>OLD.project_id OR NEW.created_by<>OLD.created_by THEN RAISE EXCEPTION 'No puedes cambiar el autor o proyecto' USING ERRCODE='42501'; END IF;
    IF NEW.comments IS DISTINCT FROM OLD.comments THEN
      last_comment:=NEW.comments->-1;
      IF jsonb_typeof(NEW.comments)<>'array' OR jsonb_array_length(NEW.comments)<>jsonb_array_length(OLD.comments)+1
        OR (NEW.comments - (jsonb_array_length(NEW.comments)-1))<>OLD.comments
        OR last_comment->>'author_id' IS DISTINCT FROM auth.uid()::text THEN
        RAISE EXCEPTION 'Solo puedes agregar tu propio comentario' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_project_deliverable ON public.project_deliverables;
CREATE TRIGGER guard_project_deliverable BEFORE INSERT OR UPDATE ON public.project_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_deliverable();
CREATE OR REPLACE FUNCTION public.append_deliverable_comment(p_project_id uuid,p_id uuid,p_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE entry public.project_deliverables%ROWTYPE; author text;
BEGIN
  IF length(trim(p_content)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Comentario no valido' USING ERRCODE='23514'; END IF;
  SELECT * INTO entry FROM public.project_deliverables WHERE id=p_id AND project_id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entregable no encontrado' USING ERRCODE='42501'; END IF;
  SELECT coalesce(display_name,first_name,'Integrante') INTO author FROM public.profiles WHERE id=auth.uid();
  UPDATE public.project_deliverables SET comments=comments||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'author_id',auth.uid(),'author_name',author,'content',trim(p_content),'created_at',now())),updated_at=now()
    WHERE id=entry.id RETURNING * INTO entry;
  RETURN to_jsonb(entry);
END $$;
REVOKE ALL ON FUNCTION public.append_deliverable_comment(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.append_deliverable_comment(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';


-- 021_academic_community.sql

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS community_preferences jsonb;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_community_preferences_object;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_community_preferences_object
  CHECK(community_preferences IS NULL OR jsonb_typeof(community_preferences)='object');
COMMENT ON COLUMN public.profiles.community_preferences IS 'Private recommendation scope and campus reference. Does not change public affiliation and contains no GPS or diagnosis.';
NOTIFY pgrst,'reload schema';


-- 023_verified_inclusive_evidence.sql
ALTER TABLE public.inclusive_tutor_accreditations
 ADD COLUMN IF NOT EXISTS issuer_name text,
 ADD COLUMN IF NOT EXISTS completed_on date,
 ADD COLUMN IF NOT EXISTS credential_code text,
 ADD COLUMN IF NOT EXISTS verification_url text,
 ADD COLUMN IF NOT EXISTS document_path text,
 ADD COLUMN IF NOT EXISTS document_filename text,
 ADD COLUMN IF NOT EXISTS document_size_bytes bigint,
 ADD COLUMN IF NOT EXISTS proof_version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS reviewer_notes text,
 ADD COLUMN IF NOT EXISTS verification_checks jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS review_history jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.inclusive_tutor_accreditations DROP CONSTRAINT IF EXISTS inclusive_tutor_accreditations_status_check;
ALTER TABLE public.inclusive_tutor_accreditations ADD CONSTRAINT inclusive_tutor_accreditations_status_check CHECK(status IN('pending','approved','rejected','revoked'));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('inclusive-evidence','inclusive-evidence',false,5242880,ARRAY['application/pdf'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['application/pdf'];

DROP POLICY IF EXISTS inclusive_evidence_insert ON storage.objects;
CREATE POLICY inclusive_evidence_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='inclusive-evidence' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS inclusive_evidence_read ON storage.objects;
CREATE POLICY inclusive_evidence_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='inclusive-evidence' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_academic_validator(auth.uid())));
DROP POLICY IF EXISTS inclusive_evidence_delete ON storage.objects;
CREATE POLICY inclusive_evidence_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='inclusive-evidence' AND (storage.foldername(name))[1]=auth.uid()::text
  AND NOT EXISTS(SELECT 1 FROM public.inclusive_tutor_accreditations a WHERE a.document_path=name
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.review_history) h WHERE h->>'document_path'=name)));

DROP POLICY IF EXISTS inclusive_accreditations_select ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_select ON public.inclusive_tutor_accreditations FOR SELECT TO authenticated
 USING(tutor_id=auth.uid() OR public.is_academic_validator(auth.uid()));
DROP POLICY IF EXISTS inclusive_accreditations_resubmit ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_resubmit ON public.inclusive_tutor_accreditations FOR UPDATE TO authenticated
 USING(tutor_id=auth.uid() AND (status<>'approved' OR proof_version<2))
 WITH CHECK(tutor_id=auth.uid() AND status='pending' AND verified_by IS NULL AND verified_at IS NULL);

CREATE OR REPLACE FUNCTION public.guard_inclusive_accreditation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); entry jsonb;
BEGIN
 IF auth.role()='service_role' THEN RETURN NEW; END IF;
 IF actor IS NULL THEN RAISE EXCEPTION 'Se requiere autenticacion' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.tutor_id<>OLD.tutor_id OR NEW.created_at<>OLD.created_at) THEN
  RAISE EXCEPTION 'No se puede cambiar el titular de la acreditacion' USING ERRCODE='42501';
 END IF;
 IF NEW.tutor_id=actor THEN
  IF NEW.status<>'pending' OR (TG_OP='UPDATE' AND OLD.status='approved' AND OLD.proof_version>=2) THEN
   RAISE EXCEPTION 'No puedes revisar tu propia acreditacion' USING ERRCODE='42501';
  END IF;
  IF NEW.proof_version<>2 OR length(trim(coalesce(NEW.issuer_name,'')))<3
    OR NEW.completed_on IS NULL OR NEW.completed_on>current_date
    OR length(trim(coalesce(NEW.credential_code,'')))<2
    OR coalesce(NEW.verification_url,'') !~ '^https://[^/[:space:]]+'
    OR length(trim(NEW.evidence_notes))<100
    OR coalesce(NEW.document_size_bytes,0) NOT BETWEEN 1 AND 5242880
    OR coalesce(NEW.document_path,'') NOT LIKE actor::text||'/%'
    OR coalesce(NEW.document_filename,'') !~* '\.pdf$'
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='inclusive-evidence' AND name=NEW.document_path) THEN
   RAISE EXCEPTION 'Falta certificado PDF, datos verificables del emisor o caso practico' USING ERRCODE='23514';
  END IF;
  NEW.verified_by:=NULL;NEW.verified_at:=NULL;NEW.reviewer_notes:=NULL;NEW.verification_checks:='{}';
  NEW.review_history:=CASE WHEN TG_OP='UPDATE' THEN OLD.review_history ELSE '[]'::jsonb END;
 ELSE
  IF TG_OP='INSERT' OR NOT public.is_academic_validator(actor) THEN
   RAISE EXCEPTION 'Se requiere otro validador autorizado' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','verified_by','verified_at','updated_at','reviewer_notes','verification_checks','review_history'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','verified_by','verified_at','updated_at','reviewer_notes','verification_checks','review_history']) THEN
   RAISE EXCEPTION 'El revisor no puede modificar la evidencia del solicitante' USING ERRCODE='42501';
  END IF;
  IF NEW.status NOT IN('approved','rejected','revoked') OR NEW.status=OLD.status
    OR (NEW.status='revoked' AND OLD.status<>'approved')
    OR (OLD.status='approved' AND NEW.status<>'revoked')
    OR length(trim(coalesce(NEW.reviewer_notes,'')))<30 THEN
   RAISE EXCEPTION 'La decision requiere un cambio valido y justificacion escrita' USING ERRCODE='23514';
  END IF;
  IF NEW.status='approved' AND (NEW.proof_version<>2 OR NOT(
    coalesce(NEW.verification_checks->>'identity_matches','false')='true'
    AND coalesce(NEW.verification_checks->>'issuer_verified','false')='true'
    AND coalesce(NEW.verification_checks->>'training_relevant','false')='true'
    AND coalesce(NEW.verification_checks->>'practical_passed','false')='true')) THEN
   RAISE EXCEPTION 'Debes verificar certificado, emisor, formacion y caso practico antes de aprobar' USING ERRCODE='23514';
  END IF;
  NEW.verified_by:=actor;NEW.verified_at:=now();
  entry:=jsonb_build_object('status',NEW.status,'reviewer_id',actor,'reviewed_at',now(),'notes',NEW.reviewer_notes,'checks',NEW.verification_checks,'document_path',NEW.document_path);
  NEW.review_history:=OLD.review_history||jsonb_build_array(entry);
 END IF;
 NEW.updated_at:=now();RETURN NEW;
END $$;

-- Only this minimal, verified badge is public. The certificate and case remain private.
CREATE OR REPLACE VIEW public.inclusive_tutor_public_credentials WITH(security_barrier=true) AS
 SELECT tutor_id,status,training_name,issuer_name,verified_at
 FROM public.inclusive_tutor_accreditations
 WHERE status='approved' AND proof_version>=2 AND verified_by IS NOT NULL AND verified_by<>tutor_id;
GRANT SELECT ON public.inclusive_tutor_public_credentials TO anon,authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
SELECT 'Comunidad y apoyos activados' AS estado,
 to_regprocedure('public.convert_quick_idea_to_task(uuid,jsonb)') IS NOT NULL AS ideas_activadas,
 to_regprocedure('public.get_shared_learning_supports(uuid)') IS NOT NULL AS apoyos_activados;
