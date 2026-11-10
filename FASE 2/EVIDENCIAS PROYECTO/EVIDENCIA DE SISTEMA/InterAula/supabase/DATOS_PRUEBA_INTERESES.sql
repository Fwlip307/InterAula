-- DATOS FICTICIOS para probar las recomendaciones. Ejecutar completo en SQL Editor.
-- Requiere ACTIVAR_INTERESES.sql. No es una migracion ni se ejecuta al iniciar Docker.
-- Los autores [DEMO] son placeholders sin password ni identidad de acceso.
-- No envia correos, no acredita tutores y no modifica preferencias de cuentas reales.
BEGIN;
DO $$
DECLARE
  t record; v_role text; v_user uuid; v_teacher uuid; v_learner uuid;
  v_subject uuid; v_project uuid; v_workshop uuid; v_visibility text; v_state text;
  v_id uuid; v_email text; v_name text; v_existing jsonb; v_column text;
  v_users uuid[]:=ARRAY[]::uuid[];
  v_seat_a uuid:=md5('interaula-demo-interests-v1:seat:a')::uuid;
  v_seat_b uuid:=md5('interaula-demo-interests-v1:seat:b')::uuid;
  v_seed constant text:='interaula-demo-interests-v1';
BEGIN
  IF to_regclass('public.recommendation_topics') IS NULL OR to_regclass('public.workshop_summary') IS NULL THEN
    RAISE EXCEPTION 'Primero ejecute ACTIVAR_INTERESES.sql';
  END IF;
  IF current_user IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Ejecute este archivo desde SQL Editor con el rol administrativo';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_seed,0));
  -- Two unavailable placeholders supply the seats for the full-workshop controls.
  FOR v_role IN SELECT unnest(ARRAY['a','b']) LOOP
    v_user:=md5(v_seed||':seat:'||v_role)::uuid;
    v_users:=array_append(v_users,v_user);
    v_email:='demo-seat-'||v_role||'@interaula.example.invalid';
    SELECT raw_user_meta_data INTO v_existing FROM auth.users WHERE id=v_user;
    IF FOUND AND coalesce(v_existing->>'interaula_demo_set','')<>v_seed THEN
      RAISE EXCEPTION 'ID de demostracion ocupado por otra cuenta: %',v_user;
    END IF;
    IF EXISTS(SELECT 1 FROM auth.users WHERE email=v_email AND id<>v_user) THEN
      RAISE EXCEPTION 'Correo de demostracion ocupado por otra cuenta';
    END IF;
    INSERT INTO auth.users(id,email,raw_user_meta_data)
      VALUES(v_user,v_email,jsonb_build_object('full_name','[DEMO] Participante '||upper(v_role),'interaula_demo_set',v_seed))
      ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.profiles(id,email,display_name,first_name,last_name,available_for_tutoring,available_for_projects,profile_completed)
      VALUES(v_user,v_email,'[DEMO] Participante '||upper(v_role),'[DEMO]','Participante',false,false,true)
      ON CONFLICT(id) DO UPDATE SET available_for_tutoring=false,available_for_projects=false;
  END LOOP;

  FOR t IN SELECT id,name,category FROM public.recommendation_topics ORDER BY id LOOP
    v_teacher:=md5(v_seed||':teach:'||t.id)::uuid;
    v_learner:=md5(v_seed||':learn:'||t.id)::uuid;
    v_subject:=md5(v_seed||':subject:'||t.id)::uuid;
    -- Three profiles per topic: shares knowledge, wants to learn, and no sharing.
    FOREACH v_role IN ARRAY ARRAY['teach','learn','hidden'] LOOP
      v_user:=md5(v_seed||':'||v_role||':'||t.id)::uuid;
      v_users:=array_append(v_users,v_user);
      v_email:='demo-'||t.id||'-'||v_role||'@interaula.example.invalid';
      v_name:='[DEMO] '||CASE v_role WHEN 'teach' THEN 'Comparte ' WHEN 'learn' THEN 'Aprende ' ELSE 'Temas ocultos: ' END||t.name;
      SELECT raw_user_meta_data INTO v_existing FROM auth.users WHERE id=v_user;
      IF FOUND AND coalesce(v_existing->>'interaula_demo_set','')<>v_seed THEN
        RAISE EXCEPTION 'ID de demostracion ocupado por otra cuenta: %',v_user;
      END IF;
      IF EXISTS(SELECT 1 FROM auth.users WHERE email=v_email AND id<>v_user) THEN
        RAISE EXCEPTION 'Correo de demostracion ocupado por otra cuenta';
      END IF;
      INSERT INTO auth.users(id,email,raw_user_meta_data)
        VALUES(v_user,v_email,jsonb_build_object('full_name',v_name,'first_name','[DEMO]','last_name',t.name,'interaula_demo_set',v_seed))
        ON CONFLICT(id) DO NOTHING;
      INSERT INTO public.profiles(id,email,first_name,last_name,display_name,bio,institution,career,
        available_for_tutoring,available_for_projects,profile_completed,show_email,show_phone)
        VALUES(v_user,v_email,'[DEMO]',t.name,v_name,
          'Perfil ficticio para probar recomendaciones. No representa una persona ni una acreditacion real.',
          'Comunidad de demostracion',t.category,v_role='teach',true,true,false,false)
        ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,bio=excluded.bio,
          available_for_tutoring=excluded.available_for_tutoring,available_for_projects=true,show_email=false,show_phone=false;
      INSERT INTO public.recommendation_preferences(user_id,personalization_enabled,discoverable,revision)
        VALUES(v_user,true,v_role<>'hidden',1)
        ON CONFLICT(user_id) DO UPDATE SET personalization_enabled=true,discoverable=excluded.discoverable;
      DELETE FROM public.user_topic_interests WHERE user_id=v_user;
      INSERT INTO public.user_topic_interests(user_id,topic_id,intent)
        VALUES(v_user,t.id,CASE WHEN v_role='hidden' THEN 'interest' ELSE v_role END);
    END LOOP;
    IF EXISTS(SELECT 1 FROM public.subjects WHERE id=v_subject AND name<>'[DEMO] '||t.name) THEN
      RAISE EXCEPTION 'ID de asignatura de demostracion ocupado';
    END IF;
    INSERT INTO public.subjects(id,name,category) VALUES(v_subject,'[DEMO] '||t.name,'Demostracion de intereses')
      ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,description,is_verified)
      VALUES(v_teacher,v_subject,'basic','Disponibilidad ficticia de prueba; no es una acreditacion.',false)
      ON CONFLICT(profile_id,subject_id) DO NOTHING;

    -- Public and shared notes should match; private and draft notes must stay out.
    FOREACH v_state IN ARRAY ARRAY['public','shared','private','draft'] LOOP
      v_id:=md5(v_seed||':note-'||v_state||':'||t.id)::uuid;
      IF EXISTS(SELECT 1 FROM public.academic_notes WHERE id=v_id AND author_id<>v_teacher) THEN
        RAISE EXCEPTION 'ID de apunte de demostracion ocupado';
      END IF;
      INSERT INTO public.academic_notes(id,author_id,subject_id,subject_name,title,summary,
        content_html,content_markdown,source_type,tags,visibility,is_draft)
        VALUES(v_id,v_teacher,v_subject,t.name,
          '[DEMO] '||CASE v_state WHEN 'private' THEN 'NO RECOMENDAR: privado - ' WHEN 'draft' THEN 'NO RECOMENDAR: borrador - ' WHEN 'shared' THEN 'Apunte compartido - ' ELSE 'Guia de ' END||t.name,
          'Material ficticio para comprobar coincidencias de temas; no es contenido academico validado.',
          '<p>Contenido ficticio de prueba para verificar recomendaciones. No es una leccion validada.</p>',
          'Contenido ficticio de prueba.', 'editor',ARRAY[v_seed,t.id,t.name],
          CASE WHEN v_state='draft' THEN 'public' ELSE v_state END,v_state='draft')
        ON CONFLICT(id) DO NOTHING;
    END LOOP;
    v_id:=md5(v_seed||':post:'||t.id)::uuid;
    IF EXISTS(SELECT 1 FROM public.forum_posts WHERE id=v_id AND author_id<>v_learner) THEN
      RAISE EXCEPTION 'ID de publicacion de demostracion ocupado';
    END IF;
    INSERT INTO public.forum_posts(id,author_id,subject_id,title,description,category,tags,post_type)
      VALUES(v_id,v_learner,v_subject,'[DEMO] Practiquemos '||t.name,
        'Pregunta ficticia para verificar el tema '||t.name||'. Sirve para probar el foro y sus recomendaciones.',
        t.category,ARRAY[v_seed,t.id,t.name],'pregunta') ON CONFLICT(id) DO NOTHING;

    FOREACH v_state IN ARRAY ARRAY['public','private','draft'] LOOP
      v_project:=md5(v_seed||':project-'||v_state||':'||t.id)::uuid;
      IF EXISTS(SELECT 1 FROM public.projects WHERE id=v_project AND owner_id<>v_teacher) THEN
        RAISE EXCEPTION 'ID de proyecto de demostracion ocupado';
      END IF;
      INSERT INTO public.projects(id,owner_id,title,short_description,description,category,tags,status,visibility,max_members,modality)
        VALUES(v_project,v_teacher,
          '[DEMO] '||CASE WHEN v_state='public' THEN 'Proyecto de ' ELSE 'NO RECOMENDAR: '||v_state||' - ' END||t.name,
          'Proyecto ficticio para formar equipos de prueba.',
          'Datos de demostracion para verificar recomendaciones, detalle de proyectos y vacantes.',
          t.category,ARRAY[v_seed,t.id,t.name],CASE WHEN v_state='draft' THEN 'draft' ELSE 'open' END,
          CASE WHEN v_state='private' THEN 'private' ELSE 'public' END,5,'online')
        ON CONFLICT(id) DO NOTHING;
      INSERT INTO public.project_members(id,project_id,profile_id,member_role,role_name)
        SELECT md5(v_seed||':member-'||v_state||':'||t.id)::uuid,v_project,v_teacher,'owner','Responsable [DEMO]'
        WHERE NOT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=v_project AND profile_id=v_teacher);
      INSERT INTO public.project_positions(id,project_id,title,description,slots,level_required,skills_required,status)
        VALUES(md5(v_seed||':position-'||v_state||':'||t.id)::uuid,v_project,'Colaborador [DEMO]',
          'Vacante ficticia para probar la navegacion.',2,'basic',ARRAY[t.name],'open') ON CONFLICT(id) DO NOTHING;
    END LOOP;

    -- Only the scheduled workshop with available seats should be recommended.
    FOREACH v_state IN ARRAY ARRAY['available','past','cancelled','completed','full'] LOOP
      v_workshop:=md5(v_seed||':workshop-'||v_state||':'||t.id)::uuid;
      IF EXISTS(SELECT 1 FROM public.tutoring_workshops WHERE id=v_workshop AND tutor_id<>v_teacher) THEN
        RAISE EXCEPTION 'ID de taller de demostracion ocupado';
      END IF;
      INSERT INTO public.tutoring_workshops(id,tutor_id,subject_id,title,description,scheduled_at,duration_minutes,max_students,room_id,status)
        VALUES(v_workshop,v_teacher,v_subject,
          '[DEMO] '||CASE WHEN v_state='available' THEN 'Taller de ' ELSE 'NO RECOMENDAR: '||v_state||' - ' END||t.name,
          'Taller ficticio del conjunto '||v_seed||'. No corresponde a una clase real.',
          CASE WHEN v_state='past' THEN now()-interval '7 days' ELSE now()+interval '7 days' END,60,
          CASE WHEN v_state='full' THEN 2 ELSE 20 END,'demo-'||v_state||'-'||t.id,
          CASE WHEN v_state IN ('cancelled','completed') THEN v_state ELSE 'scheduled' END)
        ON CONFLICT(id) DO UPDATE SET scheduled_at=excluded.scheduled_at;
      IF v_state='full' THEN
        INSERT INTO public.workshop_enrollments(workshop_id,student_id)
          SELECT v_workshop,s FROM unnest(ARRAY[v_seat_a,v_seat_b]) s
          WHERE NOT EXISTS(SELECT 1 FROM public.workshop_enrollments e WHERE e.workshop_id=v_workshop AND e.student_id=s);
      END IF;
    END LOOP;
  END LOOP;

  -- A deliberate two-topic example must match Python OR data analysis.
  v_teacher:=md5(v_seed||':teach:python')::uuid;
  IF EXISTS(SELECT 1 FROM public.recommendation_topics WHERE id='python') AND EXISTS(SELECT 1 FROM public.recommendation_topics WHERE id='data-science') THEN
    v_id:=md5(v_seed||':note-cross:python-data-science')::uuid;
    IF EXISTS(SELECT 1 FROM public.academic_notes WHERE id=v_id AND author_id<>v_teacher) THEN RAISE EXCEPTION 'ID de caso combinado ocupado'; END IF;
    INSERT INTO public.academic_notes(id,author_id,title,summary,content_html,content_markdown,tags,visibility,is_draft)
      VALUES(v_id,v_teacher,'[DEMO] Analisis de datos con Python',
        'Caso combinado de dos intereses para comprobar coincidencias y prioridad.',
        '<p>Ejemplo ficticio de un material con dos temas.</p>','Ejemplo ficticio de dos temas.',
        ARRAY[v_seed,'python','data-science','Python','Análisis de datos'],'public',false) ON CONFLICT(id) DO NOTHING;
  END IF;

  -- Fill optional Auth string columns on these placeholders only. They have no passwords/identities.
  FOREACH v_column IN ARRAY ARRAY['aud','role','encrypted_password','confirmation_token','recovery_token','email_change_token_new','email_change','email_change_token_current','phone_change','phone_change_token','reauthentication_token'] LOOP
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name=v_column AND data_type IN ('text','character varying')) THEN
      EXECUTE format('UPDATE auth.users SET %I=coalesce(%I,$1) WHERE id=ANY($2) AND raw_user_meta_data->>''interaula_demo_set''=$3',v_column,v_column)
        USING CASE WHEN v_column IN ('aud','role') THEN 'authenticated' ELSE '' END,v_users,v_seed;
    END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'Datos DEMO listos' AS estado,
  (SELECT count(*) FROM public.recommendation_topics) AS intereses_cubiertos,
  (SELECT count(*) FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'='interaula-demo-interests-v1') AS perfiles_demo,
  (SELECT count(*) FROM public.academic_notes WHERE 'interaula-demo-interests-v1'=ANY(tags)) AS apuntes_demo,
  (SELECT count(*) FROM public.forum_posts WHERE 'interaula-demo-interests-v1'=ANY(tags)) AS publicaciones_demo,
  (SELECT count(*) FROM public.projects WHERE 'interaula-demo-interests-v1'=ANY(tags)) AS proyectos_demo,
  (SELECT count(*) FROM public.tutoring_workshops WHERE tutor_id IN
    (SELECT id FROM auth.users WHERE raw_user_meta_data->>'interaula_demo_set'='interaula-demo-interests-v1')) AS talleres_demo;
