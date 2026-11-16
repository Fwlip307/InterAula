-- Requires 019. Safe to repeat; does not delete application data.
BEGIN;
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
COMMIT;
