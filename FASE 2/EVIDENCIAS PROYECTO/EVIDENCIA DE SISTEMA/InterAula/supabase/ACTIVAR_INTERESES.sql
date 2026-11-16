-- Archivo generado por scripts/build-activation.mjs.
-- Ejecutar completo en SQL Editor del mismo proyecto Supabase que usa InterAula.
-- Reune solo las migraciones 016-018. No repite las migraciones antiguas de limpieza.
-- Revisar y respaldar el proyecto antes de ejecutar cambios de esquema y permisos.
-- Cada cambio se confirma junto al resto; un error revierte la transaccion completa.
BEGIN;
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.profiles','public.subjects','public.profile_offered_subjects',
    'public.projects','public.project_positions','public.project_members','public.project_applications',
    'public.forum_posts','public.forum_replies','public.forum_post_votes','public.academic_notes',
    'public.tutoring_sessions','public.tutoring_workshops','public.workshop_enrollments',
    'public.tutor_verification_requests','public.academic_validators',
    'public.learning_paths','public.learning_path_stages','public.study_tasks','public.topic_assessments',
    'storage.buckets','storage.objects','auth.users'
  ] LOOP
    IF to_regclass(v_table) IS NULL THEN
      RAISE EXCEPTION 'Falta la tabla previa %. Revise el esquema 001-015 antes de activar.',v_table;
    END IF;
  END LOOP;
END $$;

-- Fuente: 016_privacy_and_transactional_persistence.sql
-- Privacy, transactional persistence and scheduling. Apply after migration 015.
-- Existing local JSON files are never imported automatically.

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
GRANT SELECT ON public.subjects TO anon, authenticated;
DROP POLICY IF EXISTS subjects_select_public ON public.subjects;
CREATE POLICY subjects_select_public ON public.subjects FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND (
    p.owner_id = auth.uid()
    OR (p.visibility = 'public' AND p.status <> 'draft')
    OR (p.status <> 'draft' AND EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.profile_id = auth.uid()))
  ));
$$;
REVOKE ALL ON FUNCTION public.can_view_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO anon, authenticated, service_role;
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO anon, authenticated USING (owner_id=auth.uid() OR (visibility='public' AND status<>'draft') OR public.can_view_project(id));
DROP POLICY IF EXISTS project_positions_select ON public.project_positions;
CREATE POLICY project_positions_select ON public.project_positions FOR SELECT TO anon, authenticated USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS project_members_select ON public.project_members;
CREATE POLICY project_members_select ON public.project_members FOR SELECT TO anon, authenticated USING (public.can_view_project(project_id));

-- Uploaded files follow the note's visibility. New uploads remain readable to their owner.
UPDATE storage.buckets SET public = false WHERE id = 'academic-notes';
DROP POLICY IF EXISTS academic_notes_storage_select ON storage.objects;
CREATE POLICY academic_notes_storage_select ON storage.objects FOR SELECT TO authenticated, anon USING (
  bucket_id = 'academic-notes' AND (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.academic_notes n
      WHERE n.file_url = 'storage://academic-notes/' || storage.objects.name
      AND ((n.author_id = auth.uid()) OR (NOT n.is_draft AND
        (n.visibility = 'public' OR (n.visibility = 'shared' AND auth.uid() IS NOT NULL)))))
  )
);
CREATE OR REPLACE FUNCTION public.guard_note_file_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.file_url IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.file_url IS DISTINCT FROM OLD.file_url) THEN
    IF NEW.file_url NOT LIKE 'storage://academic-notes/' || NEW.author_id::text || '/%'
      OR NEW.file_url LIKE '%..%' THEN
      RAISE EXCEPTION 'El archivo debe pertenecer al autor del apunte' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_note_file_owner ON public.academic_notes;
CREATE TRIGGER guard_note_file_owner BEFORE INSERT OR UPDATE ON public.academic_notes FOR EACH ROW EXECUTE FUNCTION public.guard_note_file_owner();

CREATE OR REPLACE FUNCTION public.register_note_download(p_note_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.academic_notes SET downloads_count = downloads_count + 1
  WHERE id = p_note_id AND (author_id = auth.uid() OR (NOT is_draft AND
    (visibility = 'public' OR (visibility = 'shared' AND auth.uid() IS NOT NULL))))
  RETURNING downloads_count INTO v_count;
  IF NOT FOUND THEN RAISE EXCEPTION 'Apunte no encontrado' USING ERRCODE = '42501'; END IF;
  RETURN v_count;
END $$;

-- Forum counters and solution changes are atomic, including direct Supabase writes.
CREATE OR REPLACE FUNCTION public.toggle_forum_vote(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count integer; v_voted boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.forum_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Consulta no encontrada' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.forum_post_votes WHERE post_id = p_post_id AND user_id = auth.uid();
  v_voted := NOT FOUND;
  IF v_voted THEN INSERT INTO public.forum_post_votes(post_id,user_id) VALUES (p_post_id,auth.uid()); END IF;
  SELECT count(*) INTO v_count FROM public.forum_post_votes WHERE post_id = p_post_id;
  UPDATE public.forum_posts SET votes_count = v_count WHERE id = p_post_id;
  RETURN jsonb_build_object('success',true,'votesCount',v_count,'hasVoted',v_voted);
END $$;
CREATE OR REPLACE FUNCTION public.resolve_forum_post(p_post_id uuid,p_reply_id uuid,p_solved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.forum_posts WHERE id = p_post_id AND author_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo el autor puede resolver esta consulta' USING ERRCODE = '42501'; END IF;
  IF p_reply_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.forum_replies WHERE id=p_reply_id AND post_id=p_post_id) THEN
    RAISE EXCEPTION 'La respuesta no pertenece a esta consulta' USING ERRCODE='23514';
  END IF;
  UPDATE public.forum_replies SET is_accepted=(p_reply_id IS NOT NULL AND id=p_reply_id AND p_solved) WHERE post_id=p_post_id;
  UPDATE public.forum_posts SET is_solved=p_solved,accepted_reply_id=CASE WHEN p_solved THEN p_reply_id ELSE NULL END,updated_at=now() WHERE id=p_post_id;
  RETURN jsonb_build_object('success',true,'postId',p_post_id,'acceptedReplyId',CASE WHEN p_solved THEN p_reply_id ELSE NULL END,'isSolved',p_solved);
END $$;
DROP POLICY IF EXISTS forum_replies_update ON public.forum_replies;
CREATE POLICY forum_replies_update ON public.forum_replies FOR UPDATE TO authenticated USING (author_id=auth.uid()) WITH CHECK (author_id=auth.uid());
CREATE OR REPLACE FUNCTION public.protect_forum_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_TABLE_NAME='forum_replies' THEN
      IF NEW.author_id<>OLD.author_id OR NEW.post_id<>OLD.post_id OR NEW.is_accepted IS DISTINCT FROM OLD.is_accepted OR NEW.votes_count<>OLD.votes_count THEN
        RAISE EXCEPTION 'Campos reservados del foro' USING ERRCODE='42501';
      END IF;
    ELSE
      IF NEW.author_id<>OLD.author_id OR NEW.votes_count<>OLD.votes_count OR NEW.replies_count<>OLD.replies_count
        OR NEW.accepted_reply_id IS DISTINCT FROM OLD.accepted_reply_id OR NEW.is_solved IS DISTINCT FROM OLD.is_solved THEN
        RAISE EXCEPTION 'Usa el flujo de resolución o voto' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_forum_post_fields ON public.forum_posts;
CREATE TRIGGER protect_forum_post_fields BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.protect_forum_fields();
DROP TRIGGER IF EXISTS protect_forum_reply_fields ON public.forum_replies;
CREATE TRIGGER protect_forum_reply_fields BEFORE UPDATE ON public.forum_replies FOR EACH ROW EXECUTE FUNCTION public.protect_forum_fields();

CREATE OR REPLACE FUNCTION public.save_collaborative_project(p_project_id uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_project public.projects%ROWTYPE; v_position public.project_positions%ROWTYPE;
  v_item jsonb; v_positions jsonb; v_kept uuid[] := '{}'; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501'; END IF;
  IF p_project_id IS NULL THEN
    INSERT INTO public.projects(owner_id,title) VALUES(auth.uid(),p_payload->>'title') RETURNING * INTO v_project;
  ELSE
    SELECT * INTO v_project FROM public.projects WHERE id=p_project_id AND owner_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proyecto no encontrado o sin permisos' USING ERRCODE='42501'; END IF;
  END IF;
  v_project := jsonb_populate_record(v_project,p_payload - ARRAY['id','owner_id','created_at','updated_at']);
  IF (SELECT count(*) FROM public.project_members WHERE project_id=v_project.id)>v_project.max_members THEN
    RAISE EXCEPTION 'El máximo de miembros no puede ser menor al equipo actual' USING ERRCODE='23514';
  END IF;
  UPDATE public.projects SET title=v_project.title,short_description=v_project.short_description,
    description=v_project.description,problem_statement=v_project.problem_statement,objectives=v_project.objectives,
    category=v_project.category,career=v_project.career,technologies=v_project.technologies,tags=v_project.tags,
    status=v_project.status,visibility=v_project.visibility,modality=v_project.modality,dedication_hours=v_project.dedication_hours,
    max_members=v_project.max_members,requirements=v_project.requirements,compensation_type=v_project.compensation_type,
    compensation_amount=v_project.compensation_amount,compensation_currency=v_project.compensation_currency,
    compensation_periodicity=v_project.compensation_periodicity,compensation_notes=v_project.compensation_notes,
    agreements=v_project.agreements,external_links=v_project.external_links,milestones=v_project.milestones,
    cover_url=v_project.cover_url,start_date=v_project.start_date,updated_at=now() WHERE id=v_project.id;
  IF p_project_id IS NULL THEN
    INSERT INTO public.project_members(project_id,profile_id,member_role,role_name)
      VALUES(v_project.id,auth.uid(),'owner','Líder del proyecto');
  END IF;
  v_positions := coalesce(p_payload->'positions',p_payload->'required_roles');
  IF v_positions IS NOT NULL THEN
    IF jsonb_typeof(v_positions)<>'array' OR jsonb_array_length(v_positions)>15 THEN
      RAISE EXCEPTION 'Lista de vacantes inválida' USING ERRCODE='23514';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_positions) LOOP
      IF jsonb_typeof(v_item)='string' THEN v_item:=jsonb_build_object('title',v_item#>>'{}'); END IF;
      v_position:=NULL;
      SELECT * INTO v_position FROM public.project_positions WHERE project_id=v_project.id AND
        (id::text=v_item->>'id' OR lower(title)=lower(v_item->>'title')) LIMIT 1;
      IF v_position.id IS NULL THEN
        INSERT INTO public.project_positions(project_id,title) VALUES(v_project.id,v_item->>'title') RETURNING * INTO v_position;
      END IF;
      v_id:=v_position.id;
      v_position:=jsonb_populate_record(v_position,v_item-ARRAY['id','project_id','created_at','slots_filled']);
      IF v_position.slots<v_position.slots_filled THEN RAISE EXCEPTION 'La vacante ya tiene integrantes' USING ERRCODE='23514'; END IF;
      UPDATE public.project_positions SET title=v_position.title,description=v_position.description,
        skills_required=v_position.skills_required,mandatory_requirements=v_position.mandatory_requirements,
        optional_requirements=v_position.optional_requirements,level_required=v_position.level_required,
        dedication_hours=v_position.dedication_hours,slots=v_position.slots,compensation_override=v_position.compensation_override,
        status=CASE WHEN slots_filled>=v_position.slots THEN 'filled' ELSE v_position.status END WHERE id=v_id;
      v_kept:=array_append(v_kept,v_id);
    END LOOP;
    -- Keep historical applications and membership links when closing removed positions.
    UPDATE public.project_positions SET status='closed' WHERE project_id=v_project.id AND NOT(id=ANY(v_kept));
  END IF;
  RETURN v_project.id;
END $$;
CREATE OR REPLACE FUNCTION public.apply_collaborative_project(p_project_id uuid,p_position_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_project public.projects%ROWTYPE; v_position public.project_positions%ROWTYPE; v_app public.project_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.can_view_project(p_project_id) OR v_project.owner_id=auth.uid() OR v_project.status NOT IN ('open','recruiting') THEN
    RAISE EXCEPTION 'No puedes postular a este proyecto' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_position FROM public.project_positions WHERE id=p_position_id AND project_id=p_project_id FOR UPDATE;
  IF NOT FOUND OR v_position.status<>'open' OR v_position.slots_filled>=v_position.slots THEN
    RAISE EXCEPTION 'La vacante no está disponible' USING ERRCODE='23514';
  END IF;
  IF NOT coalesce((p_payload->>'accepted_agreements')::boolean,false) THEN
    RAISE EXCEPTION 'Debes aceptar los acuerdos del proyecto' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.project_applications(project_id,position_id,applicant_id,message,relevant_skills,portfolio_url,availability_notes,accepted_agreements,accepted_agreements_at)
    VALUES(p_project_id,p_position_id,auth.uid(),p_payload->>'message',
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'relevant_skills','[]'))),
      p_payload->>'portfolio_url',p_payload->>'availability_notes',true,now()) RETURNING * INTO v_app;
  RETURN to_jsonb(v_app);
END $$;
CREATE OR REPLACE FUNCTION public.review_project_application(p_application_id uuid,p_status text,p_feedback text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_app public.project_applications%ROWTYPE; v_project public.projects%ROWTYPE; v_position public.project_positions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Operación inválida' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_app FROM public.project_applications WHERE id=p_application_id;
  SELECT * INTO v_project FROM public.projects WHERE id=v_app.project_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo el creador puede resolver postulaciones' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_app FROM public.project_applications WHERE id=p_application_id FOR UPDATE;
  IF v_app.status<>'pending' THEN RAISE EXCEPTION 'La postulación ya fue resuelta' USING ERRCODE='40001'; END IF;
  IF p_status='accepted' THEN
    SELECT * INTO v_position FROM public.project_positions WHERE id=v_app.position_id FOR UPDATE;
    IF v_position.status<>'open' OR v_position.slots_filled>=v_position.slots OR
      (SELECT count(*) FROM public.project_members WHERE project_id=v_project.id)>=v_project.max_members THEN
      RAISE EXCEPTION 'No quedan cupos disponibles' USING ERRCODE='40001';
    END IF;
    IF EXISTS(SELECT 1 FROM public.project_members WHERE project_id=v_project.id AND profile_id=v_app.applicant_id) THEN
      RAISE EXCEPTION 'La persona ya integra este equipo' USING ERRCODE='23505';
    END IF;
    INSERT INTO public.project_members(project_id,profile_id,position_id,member_role,role_name)
      VALUES(v_app.project_id,v_app.applicant_id,v_app.position_id,'member',v_position.title);
    UPDATE public.project_positions SET slots_filled=slots_filled+1,
      status=CASE WHEN slots_filled+1>=slots THEN 'filled' ELSE status END WHERE id=v_app.position_id;
  END IF;
  UPDATE public.project_applications SET status=p_status,reviewer_feedback=p_feedback,updated_at=now() WHERE id=p_application_id RETURNING * INTO v_app;
  RETURN to_jsonb(v_app);
END $$;
-- An applicant must never directly accept themselves through the Data API.
CREATE OR REPLACE FUNCTION public.protect_project_application()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.applicant_id<>auth.uid() AND current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Autor inválido' USING ERRCODE='42501'; END IF;
    NEW.status:='pending';
  ELSIF current_user IN ('authenticated','anon') THEN
    IF NEW.project_id<>OLD.project_id OR NEW.position_id<>OLD.position_id OR NEW.applicant_id<>OLD.applicant_id
      OR NEW.status NOT IN ('pending','withdrawn') OR OLD.status<>'pending' THEN
      RAISE EXCEPTION 'Usa el flujo de resolución de postulaciones' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_project_application ON public.project_applications;
CREATE TRIGGER protect_project_application BEFORE INSERT OR UPDATE ON public.project_applications FOR EACH ROW EXECUTE FUNCTION public.protect_project_application();

CREATE OR REPLACE FUNCTION public.remove_collaborative_member(p_project_id uuid,p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_member public.project_members%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.projects WHERE id=p_project_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo el creador puede retirar miembros' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_member FROM public.project_members WHERE project_id=p_project_id AND (id=p_member_id OR profile_id=p_member_id) AND member_role<>'owner' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Integrante no encontrado' USING ERRCODE='P0002'; END IF;
  DELETE FROM public.project_members WHERE id=v_member.id;
  IF v_member.position_id IS NOT NULL THEN
    UPDATE public.project_positions SET slots_filled=greatest(0,slots_filled-1),
      status=CASE WHEN status='filled' THEN 'open' ELSE status END WHERE id=v_member.position_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_learning_config(p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_config jsonb;
BEGIN
  UPDATE public.profiles SET learning_space_config=learning_space_config||p_config,updated_at=now()
    WHERE id=auth.uid() RETURNING learning_space_config INTO v_config;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE='42501'; END IF;
  RETURN v_config;
END $$;
CREATE OR REPLACE FUNCTION public.create_learning_path(p_payload jsonb,p_stages jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_stage jsonb; v_order integer:=0;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(p_stages)<>'array' OR jsonb_array_length(p_stages) NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Ruta inválida' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.learning_paths(user_id,subject_id,subject_name,title,goal,pace,preferred_mode)
    VALUES(auth.uid(),p_payload->>'subject_id',p_payload->>'subject_name',p_payload->>'title',p_payload->>'goal',
      coalesce(p_payload->>'pace','paso_a_paso'),coalesce(p_payload->>'preferred_mode','sencilla')) RETURNING id INTO v_id;
  FOR v_stage IN SELECT value FROM jsonb_array_elements(p_stages) LOOP
    v_order:=v_order+1;
    INSERT INTO public.learning_path_stages(path_id,order_index,title,description,content_topic,practice_prompt)
      VALUES(v_id,v_order,v_stage->>'title',coalesce(v_stage->>'description',''),coalesce(v_stage->>'content_topic',''),coalesce(v_stage->>'practice_prompt',''));
  END LOOP;
  RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.add_learning_stage(p_path_id uuid,p_stage jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_order integer;
BEGIN
  PERFORM 1 FROM public.learning_paths WHERE id=p_path_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ruta no encontrada o sin permisos' USING ERRCODE='42501'; END IF;
  SELECT coalesce(max(order_index),0)+1 INTO v_order FROM public.learning_path_stages WHERE path_id=p_path_id;
  IF v_order>12 THEN RAISE EXCEPTION 'La ruta admite hasta doce etapas' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_path_stages(path_id,order_index,title,description,content_topic,practice_prompt)
    VALUES(p_path_id,v_order,p_stage->>'title',coalesce(p_stage->>'description',''),coalesce(p_stage->>'content_topic',''),coalesce(p_stage->>'practice_prompt',''));
END $$;
CREATE OR REPLACE FUNCTION public.recalculate_learning_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_total integer; v_done integer;
BEGIN
  v_id:=CASE WHEN TG_OP='DELETE' THEN OLD.path_id ELSE NEW.path_id END;
  PERFORM 1 FROM public.learning_paths WHERE id=v_id FOR UPDATE;
  SELECT count(*),count(*) FILTER(WHERE completed) INTO v_total,v_done FROM public.learning_path_stages WHERE path_id=v_id;
  UPDATE public.learning_paths SET progress_percent=CASE WHEN v_total=0 THEN 0 ELSE round(v_done*100.0/v_total)::integer END,
    status=CASE WHEN v_total>0 AND v_done=v_total THEN 'completed' WHEN status='completed' THEN 'active' ELSE status END,
    updated_at=now() WHERE id=v_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS recalculate_learning_progress ON public.learning_path_stages;
CREATE TRIGGER recalculate_learning_progress AFTER INSERT OR UPDATE OR DELETE ON public.learning_path_stages FOR EACH ROW EXECUTE FUNCTION public.recalculate_learning_progress();

CREATE OR REPLACE FUNCTION public.record_learning_assessment(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_record public.topic_assessments%ROWTYPE; v_score integer:=(p_payload->>'score')::integer;
  v_total integer:=(p_payload->>'total_questions')::integer; v_mastery text;
BEGIN
  IF auth.uid() IS NULL OR v_total<1 OR v_score<0 OR v_score>v_total THEN
    RAISE EXCEPTION 'Resultado de práctica inválido' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||lower(p_payload->>'subject_name')||':'||lower(p_payload->>'topic_name'),0));
  v_mastery:=CASE WHEN v_score*100.0/v_total>=80 THEN 'consolidado' WHEN v_score*100.0/v_total>=55 THEN 'en_desarrollo' ELSE 'necesita_practicar' END;
  SELECT * INTO v_record FROM public.topic_assessments WHERE user_id=auth.uid()
    AND lower(subject_name)=lower(p_payload->>'subject_name') AND lower(topic_name)=lower(p_payload->>'topic_name')
    ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF v_record.id IS NULL THEN
    INSERT INTO public.topic_assessments(user_id,subject_name,topic_name,mastery_level,score,total_questions,recurring_errors,last_practiced_at,updated_at)
      VALUES(auth.uid(),p_payload->>'subject_name',p_payload->>'topic_name',v_mastery,v_score,v_total,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'recurring_errors','[]'))),now(),now()) RETURNING * INTO v_record;
  ELSE
    UPDATE public.topic_assessments SET mastery_level=v_mastery,score=v_score,total_questions=v_total,
      recurring_errors=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'recurring_errors','[]'))),
      last_practiced_at=now(),updated_at=now() WHERE id=v_record.id RETURNING * INTO v_record;
  END IF;
  RETURN to_jsonb(v_record);
END $$;
REVOKE ALL ON FUNCTION public.record_learning_assessment(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_learning_assessment(jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.enforce_workshop_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_workshop public.tutoring_workshops%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.workshop_id<>OLD.workshop_id OR NEW.student_id<>OLD.student_id) THEN
    RAISE EXCEPTION 'La inscripción no puede cambiar de titular o taller' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_workshop FROM public.tutoring_workshops WHERE id=NEW.workshop_id FOR UPDATE;
  IF NOT FOUND OR v_workshop.tutor_id=NEW.student_id OR (TG_OP='INSERT' AND v_workshop.status NOT IN ('scheduled','in_progress')) THEN
    RAISE EXCEPTION 'No puedes inscribirte a este taller' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND auth.uid() IS DISTINCT FROM v_workshop.tutor_id AND (NEW.attended IS DISTINCT FROM OLD.attended OR NEW.attended_at IS DISTINCT FROM OLD.attended_at) THEN
    RAISE EXCEPTION 'Solo el tutor puede confirmar asistencia al taller' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' AND (SELECT count(*) FROM public.workshop_enrollments WHERE workshop_id=NEW.workshop_id)>=v_workshop.max_students THEN
    RAISE EXCEPTION 'El taller no tiene cupos disponibles' USING ERRCODE='40001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_workshop_capacity ON public.workshop_enrollments;
CREATE TRIGGER enforce_workshop_capacity BEFORE INSERT OR UPDATE ON public.workshop_enrollments FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_capacity();

-- Lock participants in a stable order before checking overlapping bookings.
CREATE OR REPLACE FUNCTION public.enforce_tutoring_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF NEW.student_id=NEW.tutor_id THEN RAISE EXCEPTION 'No puedes agendar contigo mismo' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.student_id<>OLD.student_id OR NEW.tutor_id<>OLD.tutor_id OR NEW.subject_id<>OLD.subject_id
    OR NEW.scheduled_at<>OLD.scheduled_at OR NEW.duration_minutes<>OLD.duration_minutes) THEN
    RAISE EXCEPTION 'Los participantes y horario de una sesión son inmutables' USING ERRCODE='42501';
  END IF;
  IF NEW.status NOT IN ('pending','accepted','in_progress') THEN RETURN NEW; END IF;
  FOR v_id IN SELECT unnest(ARRAY[NEW.student_id,NEW.tutor_id]) ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('tutoring:'||v_id::text,0));
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.tutoring_sessions s WHERE s.id<>NEW.id AND s.status IN ('pending','accepted','in_progress')
    AND (s.student_id IN (NEW.student_id,NEW.tutor_id) OR s.tutor_id IN (NEW.student_id,NEW.tutor_id))
    AND s.scheduled_at<NEW.scheduled_at+make_interval(mins=>NEW.duration_minutes)
    AND NEW.scheduled_at<s.scheduled_at+make_interval(mins=>s.duration_minutes)) THEN
    RAISE EXCEPTION 'El horario coincide con otra tutoría' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_tutoring_booking ON public.tutoring_sessions;
CREATE TRIGGER enforce_tutoring_booking BEFORE INSERT OR UPDATE ON public.tutoring_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_tutoring_booking();

CREATE TABLE IF NOT EXISTS public.tutoring_attendance (
  session_id uuid NOT NULL REFERENCES public.tutoring_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_joined_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,active_seconds integer NOT NULL DEFAULT 0,
  PRIMARY KEY(session_id,user_id)
);
ALTER TABLE public.tutoring_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutoring_attendance FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.enforce_tutoring_session_update_security()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() NOT IN (OLD.student_id,OLD.tutor_id) AND coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'No perteneces a esta sesión' USING ERRCODE='42501';
  END IF;
  IF NEW.status<>OLD.status THEN
    IF NEW.status IN ('accepted','rejected','completed','in_progress') AND auth.uid() IS DISTINCT FROM OLD.tutor_id THEN
      RAISE EXCEPTION 'Solo el tutor puede realizar esta transición' USING ERRCODE='42501';
    END IF;
    IF NOT ((OLD.status='pending' AND NEW.status IN ('accepted','rejected','cancelled'))
      OR (OLD.status='accepted' AND NEW.status IN ('in_progress','completed','cancelled'))
      OR (OLD.status='in_progress' AND NEW.status IN ('completed','cancelled'))) THEN
      RAISE EXCEPTION 'La sesión ya terminó o la transición no es válida' USING ERRCODE='23514';
    END IF;
  END IF;
  IF current_user IN ('authenticated','anon') AND
    (NEW.attendance_verified IS DISTINCT FROM OLD.attendance_verified OR NEW.actual_duration_minutes IS DISTINCT FROM OLD.actual_duration_minutes
     OR NEW.student_joined_at IS DISTINCT FROM OLD.student_joined_at OR NEW.tutor_joined_at IS DISTINCT FROM OLD.tutor_joined_at
     OR NEW.both_connected_at IS DISTINCT FROM OLD.both_connected_at) THEN
    RAISE EXCEPTION 'La asistencia se registra por el flujo del aula' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.register_session_attendance(p_session_id uuid,p_action text,p_duration_minutes integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_session public.tutoring_sessions%ROWTYPE; v_attendance public.tutoring_attendance%ROWTYPE;
  v_time timestamptz:=clock_timestamp(); v_tutor integer:=0; v_student integer:=0; v_both timestamptz;
BEGIN
  SELECT * INTO v_session FROM public.tutoring_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() NOT IN(v_session.student_id,v_session.tutor_id) THEN
    RAISE EXCEPTION 'No perteneces a esta sesión' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('join','heartbeat','leave') OR v_session.status NOT IN ('accepted','in_progress') THEN
    RAISE EXCEPTION 'La sesión no está disponible para registrar asistencia' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_attendance FROM public.tutoring_attendance WHERE session_id=p_session_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    IF p_action<>'join' THEN RAISE EXCEPTION 'Primero ingresa al aula' USING ERRCODE='23514'; END IF;
    INSERT INTO public.tutoring_attendance(session_id,user_id,first_joined_at,last_seen_at) VALUES(p_session_id,auth.uid(),v_time,v_time);
  ELSE
    UPDATE public.tutoring_attendance SET
      active_seconds=active_seconds+CASE WHEN left_at IS NULL THEN least(90,greatest(0,extract(epoch FROM v_time-last_seen_at)::integer)) ELSE 0 END,
      last_seen_at=v_time,left_at=CASE WHEN p_action='leave' THEN v_time ELSE NULL END
      WHERE session_id=p_session_id AND user_id=auth.uid();
  END IF;
  SELECT active_seconds INTO v_tutor FROM public.tutoring_attendance WHERE session_id=p_session_id AND user_id=v_session.tutor_id;
  SELECT active_seconds INTO v_student FROM public.tutoring_attendance WHERE session_id=p_session_id AND user_id=v_session.student_id;
  SELECT max(first_joined_at) INTO v_both FROM public.tutoring_attendance WHERE session_id=p_session_id HAVING count(*)=2;
  UPDATE public.tutoring_sessions SET
    tutor_joined_at=coalesce(tutor_joined_at,(SELECT first_joined_at FROM public.tutoring_attendance WHERE session_id=p_session_id AND user_id=v_session.tutor_id)),
    student_joined_at=coalesce(student_joined_at,(SELECT first_joined_at FROM public.tutoring_attendance WHERE session_id=p_session_id AND user_id=v_session.student_id)),
    both_connected_at=coalesce(both_connected_at,v_both),
    actual_duration_minutes=least(coalesce(v_tutor,0),coalesce(v_student,0))/60,
    attendance_verified=coalesce(v_tutor,0)>=900 AND coalesce(v_student,0)>=900,
    updated_at=v_time
    WHERE id=p_session_id RETURNING * INTO v_session;
  RETURN jsonb_build_object('session_id',v_session.id,'room_id',v_session.room_id,
    'student_joined_at',v_session.student_joined_at,'tutor_joined_at',v_session.tutor_joined_at,
    'both_connected_at',v_session.both_connected_at,'actual_duration_minutes',v_session.actual_duration_minutes,
    'attendance_verified',v_session.attendance_verified);
END $$;

CREATE OR REPLACE VIEW public.workshop_summary AS
SELECT w.*, (SELECT count(*) FROM public.workshop_enrollments e WHERE e.workshop_id=w.id) AS enrollments_count
FROM public.tutoring_workshops w;
GRANT SELECT ON public.workshop_summary TO anon,authenticated;
DROP POLICY IF EXISTS "Enrollments viewable by workshop participants" ON public.workshop_enrollments;
CREATE POLICY "Enrollments viewable by workshop participants" ON public.workshop_enrollments FOR SELECT TO authenticated
USING (student_id=auth.uid() OR EXISTS(SELECT 1 FROM public.tutoring_workshops w WHERE w.id=workshop_id AND w.tutor_id=auth.uid()));


-- Replace the older MVP rule that required the student to complete a session.
-- Validation reads private profile fields internally without granting their SELECT to students.
CREATE OR REPLACE FUNCTION public.validate_tutoring_session_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.student_id<>auth.uid() THEN
      RAISE EXCEPTION 'No puedes solicitar tutorías por otra persona' USING ERRCODE='42501';
    END IF;
    IF NEW.status<>'pending' OR NEW.scheduled_at<=now() THEN
      RAISE EXCEPTION 'La solicitud debe estar pendiente y tener una fecha futura' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.tutor_id AND available_for_tutoring) THEN
      RAISE EXCEPTION 'El tutor no está disponible' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.profile_offered_subjects WHERE profile_id=NEW.tutor_id AND subject_id=NEW.subject_id) THEN
      RAISE EXCEPTION 'El tutor no ofrece esta asignatura' USING ERRCODE='23514';
    END IF;
  ELSE
    IF OLD.status IN ('completed','rejected','cancelled') THEN
      RAISE EXCEPTION 'La tutoría ya terminó' USING ERRCODE='23514';
    END IF;
    IF NEW.status='completed' AND OLD.status<>NEW.status AND now()<OLD.scheduled_at THEN
      RAISE EXCEPTION 'La tutoría todavía no comienza' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $$;
-- RPC permissions are explicit; none inherit the default PUBLIC execute grant.
REVOKE ALL ON FUNCTION public.register_note_download(uuid),public.toggle_forum_vote(uuid),public.resolve_forum_post(uuid,uuid,boolean),
  public.save_collaborative_project(uuid,jsonb),public.apply_collaborative_project(uuid,uuid,jsonb),
  public.review_project_application(uuid,text,text),public.remove_collaborative_member(uuid,uuid),
  public.update_learning_config(jsonb),public.create_learning_path(jsonb,jsonb),public.add_learning_stage(uuid,jsonb),
  public.register_session_attendance(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_note_download(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_forum_vote(uuid),public.resolve_forum_post(uuid,uuid,boolean),
  public.save_collaborative_project(uuid,jsonb),public.apply_collaborative_project(uuid,uuid,jsonb),
  public.review_project_application(uuid,text,text),public.remove_collaborative_member(uuid,uuid),
  public.update_learning_config(jsonb),public.create_learning_path(jsonb,jsonb),public.add_learning_stage(uuid,jsonb),
  public.register_session_attendance(uuid,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Fuente: 017_server_assessments_and_endorsements.sql
-- Server-owned accreditation attempts and real in-app teacher requests.
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

-- Fuente: 018_interests_and_recommendations.sql
-- Apply after 017. Private preferences, explicit sharing and reversible feedback.
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

NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'Activacion completada' AS estado,
  (SELECT count(*) FROM public.recommendation_topics) AS temas_disponibles,
  to_regclass('public.workshop_summary') IS NOT NULL AS talleres_disponibles;
