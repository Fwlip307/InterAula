-- Only the seven dedicated Auth accounts created by presentationAccounts.ts are used.
-- All records are fictional; no reviewers, validators, sanctions or outgoing emails.
CREATE OR REPLACE FUNCTION pg_temp.presentation_id(label text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5('interaula-demo-presentacion-v1:'||label)::uuid $$;
DO $$
DECLARE seed constant text:='interaula-demo-presentacion-v1'; camila uuid;diego uuid;valentina uuid;students uuid[];accounts uuid[];
 calc uuid:=pg_temp.presentation_id('subject:calculo');python uuid:=pg_temp.presentation_id('subject:python');
 subject uuid; who uuid; sid uuid; aid uuid; rid uuid; i integer; profile record; title text;
 base timestamptz:=(date_trunc('day',now() AT TIME ZONE 'America/Santiago')+interval '1 day 15 hours') AT TIME ZONE 'America/Santiago';
 project uuid:=pg_temp.presentation_id('project:estudio'); vacancy uuid:=pg_temp.presentation_id('position:frontend'); post uuid:=pg_temp.presentation_id('forum:calculo');path_id uuid:=pg_temp.presentation_id('path:camila');
BEGIN
 IF current_user IN('anon','authenticated') THEN RAISE EXCEPTION 'Ejecuta el archivo completo desde SQL Editor con el operador del proyecto'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(seed,0));
 SELECT array_agg(id) INTO accounts FROM auth.users WHERE raw_app_meta_data->>'interaula_demo_set'=seed AND email IN(
  'presentacion.camila@interaula.example.invalid','presentacion.diego@interaula.example.invalid','presentacion.valentina@interaula.example.invalid',
  'presentacion.historia2@interaula.example.invalid','presentacion.historia3@interaula.example.invalid','presentacion.historia4@interaula.example.invalid','presentacion.historia5@interaula.example.invalid');
 IF coalesce(array_length(accounts,1),0)<>7 THEN RAISE EXCEPTION 'Primero prepara las siete cuentas con presentationAccounts.ts prepare. No se cambiaron datos'; END IF;
 SELECT id INTO camila FROM auth.users WHERE id=ANY(accounts) AND raw_app_meta_data->>'demo_role'='camila';
 SELECT id INTO diego FROM auth.users WHERE id=ANY(accounts) AND raw_app_meta_data->>'demo_role'='diego';
 SELECT id INTO valentina FROM auth.users WHERE id=ANY(accounts) AND raw_app_meta_data->>'demo_role'='valentina';
 SELECT array_agg(id ORDER BY email) INTO students FROM auth.users WHERE id=ANY(accounts) AND (id=camila OR raw_app_meta_data->>'demo_role' LIKE 'historia%');
 IF camila IS NULL OR diego IS NULL OR valentina IS NULL OR array_length(students,1)<>5 THEN RAISE EXCEPTION 'Las identidades DEMO no coinciden con el escenario'; END IF;
 IF EXISTS(SELECT 1 FROM public.academic_validators WHERE profile_id=ANY(accounts)) OR EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=ANY(accounts)) THEN RAISE EXCEPTION 'Una cuenta DEMO tiene permisos elevados; revísala antes de continuar'; END IF;
 -- SQL Editor is privileged. These claims are LOCAL to this transaction, never session credentials.
 PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 IF EXISTS(SELECT 1 FROM public.subjects WHERE id IN(calc,python) AND name NOT LIKE '[DEMO 17]%') THEN RAISE EXCEPTION 'Colisión con una asignatura ajena'; END IF;
 INSERT INTO public.subjects(id,name,category) VALUES(calc,'[DEMO 17] Cálculo diferencial','ciencias'),(python,'[DEMO 17] Python y análisis de datos','tecnologia') ON CONFLICT(id) DO NOTHING;
 UPDATE public.profiles SET display_name=CASE id WHEN camila THEN '[DEMO] Camila Estudiante' WHEN diego THEN '[DEMO] Diego Tutor' WHEN valentina THEN '[DEMO] Valentina Equipo' ELSE '[DEMO] Estudiante de historial' END,institution='IP DUOC UC',career='Ingeniería en Informática',location='SEDE PLAZA VESPUCIO',profile_completed=true,
  bio='[DEMO 17] Perfil ficticio para ensayar InterAula. No corresponde a una persona, acreditación o actividad docente real.',
  available_for_tutoring=(id=diego),available_for_projects=true,
  community_preferences='{"institutionId":"ies_111","campusId":"sede_9","scope":"all","modality":"any"}',
  accessibility_preferences='{"themeMode":"light","calmMode":false,"fontSize":"normal","contrast":"standard","reduceMotion":true,"spacing":"standard","untimedQuizzes":true,"quietNotifications":true,"emailTutoring":false,"emailClassReminders":false,"emailProjects":false,"literalLanguage":true}',
  learning_preferences=CASE WHEN id=camila THEN ARRAY['step_by_step','practical_examples','literal_language'] ELSE ARRAY[]::text[] END
 WHERE id=ANY(accounts);
 UPDATE public.profiles SET location='SEDE ANTONIO VARAS',community_preferences='{"institutionId":"ies_111","campusId":"sede_5","scope":"all","modality":"any"}' WHERE id=valentina;
 UPDATE public.profiles SET learning_space_config=jsonb_build_object('onboardingCompleted',true,'shareWithTutors',false,'explanationStyle',jsonb_build_array('step_by_step','practical_examples'),
  'organizationStyle',jsonb_build_array('short_tasks','frequent_breaks'),'communicationStyle',jsonb_build_array('message_first','individual_tutoring'),
  'environmentStyle',jsonb_build_array('calm_interface','untimed_practice'),'defaultStudyIntervalMinutes',15,'defaultBreakMinutes',5,
  'subjectsToReinforce',jsonb_build_array('[DEMO 17] Cálculo diferencial'),'learningGoalSummary','Preparar una evaluación de derivadas y organizar el estudio en pasos pequeños.') WHERE id=camila;
 INSERT INTO public.profile_needed_subjects(profile_id,subject_id) VALUES(camila,calc) ON CONFLICT DO NOTHING;
 FOREACH who IN ARRAY accounts LOOP
  INSERT INTO public.recommendation_preferences(user_id,personalization_enabled,discoverable) VALUES(who,true,true) ON CONFLICT(user_id) DO NOTHING;
 END LOOP;
 INSERT INTO public.user_topic_interests(user_id,topic_id,intent) VALUES
  (camila,'mathematics','interest'),(camila,'python','interest'),(camila,'mathematics','learn'),(camila,'python','learn'),
  (diego,'mathematics','teach'),(diego,'python','teach'),(diego,'mathematics','interest'),(diego,'python','interest'),
  (valentina,'python','interest'),(valentina,'design','interest'),(valentina,'software','teach') ON CONFLICT DO NOTHING;
 FOREACH subject IN ARRAY ARRAY[calc,python] LOOP
  aid:=pg_temp.presentation_id('assessment:'||subject);rid:=pg_temp.presentation_id('credential:'||subject);
  INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level,description) VALUES(diego,subject,'basic','[DEMO 17] Oferta de práctica: habilitación ficticia, solo para las cuentas de esta presentación.') ON CONFLICT DO NOTHING;
  INSERT INTO public.tutor_assessment_attempts(id,user_id,subject_id,questions,answers,state,score,revision,expires_at,submitted_at,granted_at)
   VALUES(aid,diego,subject,'[{"id":"demo1","prompt":"[DEMO] Evidencia ficticia 1"},{"id":"demo2","prompt":"[DEMO] Evidencia ficticia 2"},{"id":"demo3","prompt":"[DEMO] Evidencia ficticia 3"},{"id":"demo4","prompt":"[DEMO] Evidencia ficticia 4"},{"id":"demo5","prompt":"[DEMO] Evidencia ficticia 5"}]',
    '[{"demo":true},{"demo":true},{"demo":true},{"demo":true},{"demo":true}]','granted',100,5,now()+interval '2 days',now(),now()) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.tutor_verification_requests(id,tutor_id,subject_id,status,verification_source,assessment_attempt_id,reviewed_at,reviewer_feedback)
   VALUES(rid,diego,subject,'approved','assessment',aid,now(),'[DEMO 17] Resolución ficticia cargada como escenario. No representa un examen rendido ni formación real.') ON CONFLICT(id) DO NOTHING;
 END LOOP;
 -- Nine completed fictional sessions; the tenth is left available for a real UI confirmation/review.
 FOR i IN 1..9 LOOP
  sid:=pg_temp.presentation_id('history:'||i);who:=students[1+(i-1)%5];
  INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,modality,notes,completion_verified_at,completion_method,tutor_completion_confirmed_at,student_completion_confirmed_at)
   VALUES(sid,who,diego,calc,now()-make_interval(days=>i+1),'completed','in_person','[DEMO 17] Historial ficticio para explicar reputación e hitos.',now()-make_interval(days=>i+1)+interval '1 hour','both_confirmed',now()-make_interval(days=>i+1)+interval '1 hour',now()-make_interval(days=>i+1)+interval '1 hour') ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.tutoring_reviews(id,session_id,student_id,tutor_id,communication_score,knowledge_score,punctuality_score,comment,created_at)
   VALUES(pg_temp.presentation_id('review:'||i),sid,who,diego,10,10,10,'[DEMO 17] Valoración ficticia: sesión preparada, explicación clara y buen trato.',now()-make_interval(days=>i)) ON CONFLICT(session_id) DO NOTHING;
 END LOOP;
 INSERT INTO public.user_badges(profile_id,badge_id) SELECT diego,id FROM public.badges WHERE code='tutoring_1' ON CONFLICT DO NOTHING;
 INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,modality,notes,agenda_preview,camera_policy,participation_mode,participation_rules)
  VALUES(pg_temp.presentation_id('session:live'),camila,diego,calc,now()-interval '40 minutes','accepted','online','[DEMO 17] Completar esta sesión desde ambas cuentas y valorar para activar el hito de 10 tutorías.',
   '{"what_we_will_see":"Regla de la cadena","step_by_step":"Un ejemplo, práctica acompañada y una comprobación final","how_it_ends":"Resumen de dudas y siguiente paso"}','optional','chat_or_voice','Puedes preguntar por escrito y pedir una pausa.') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,modality,notes,agenda_preview,camera_policy)
  VALUES(pg_temp.presentation_id('session:upcoming'),camila,diego,calc,base,'accepted','online','[DEMO 17] Próxima sesión: preparar derivadas.',
  '{"what_we_will_see":"Derivadas con ejemplos","step_by_step":"Repaso de funciones; regla de la potencia; regla de la cadena","how_it_ends":"Una práctica corta y material para después"}','optional') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.tutoring_sessions(id,student_id,tutor_id,subject_id,scheduled_at,status,notes)
  VALUES(pg_temp.presentation_id('session:pending'),valentina,diego,python,base+interval '2 hours','pending','[DEMO 17] Solicitud pendiente para aceptar desde la cuenta de Diego.') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.tutoring_workshops(id,tutor_id,subject_id,title,description,scheduled_at,max_students,status,agenda_preview,camera_policy)
  VALUES(pg_temp.presentation_id('workshop:calculo'),diego,calc,'[DEMO 17] Derivadas paso a paso','Taller ficticio para demostrar cupos, preparación y apoyos opcionales.',base+interval '1 hour',8,'scheduled',
   '{"what_we_will_see":"Regla de la potencia y de la cadena","step_by_step":"Ejemplo resuelto, pausa y ejercicios","how_it_ends":"Resumen de fórmulas y dudas pendientes"}','optional'),
   (pg_temp.presentation_id('workshop:python'),diego,python,'[DEMO 17] Primer análisis de datos con Python','Taller ficticio al que Camila todavía puede inscribirse.',base+interval '3 hours',8,'scheduled',NULL,'optional') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES(pg_temp.presentation_id('workshop:calculo'),camila),(pg_temp.presentation_id('workshop:calculo'),valentina) ON CONFLICT DO NOTHING;
 INSERT INTO public.learning_paths(id,user_id,subject_id,subject_name,title,goal,pace,preferred_mode)
  VALUES(path_id,camila,calc::text,'Cálculo','[DEMO 17] De funciones a derivadas','Resolver una composición de funciones explicando cada paso.','paso_a_paso','paso_a_paso') ON CONFLICT(id) DO NOTHING;
 FOR i IN 1..3 LOOP
  INSERT INTO public.learning_path_stages(id,path_id,order_index,title,description,content_topic,practice_prompt,completed,completed_at)
   VALUES(pg_temp.presentation_id('stage:'||i),path_id,i,CASE i WHEN 1 THEN 'Repasar funciones' WHEN 2 THEN 'Practicar regla de la potencia' ELSE 'Aplicar regla de la cadena' END,
    'Trabaja un ejemplo breve y comprueba el resultado.','Derivadas','Explica qué regla utilizaste.',i=1,CASE WHEN i=1 THEN now()-interval '1 day' ELSE NULL END) ON CONFLICT(id) DO NOTHING;
 END LOOP;
 INSERT INTO public.study_tasks(id,user_id,subject_name,title,priority,status,study_interval_minutes,break_minutes,subtasks) VALUES
  (pg_temp.presentation_id('task:camila'),camila,'Cálculo','[DEMO 17] Preparar mi próxima tutoría','alta','in_progress',15,5,'[{"id":"demo-sub-1","title":"Leer el ejemplo de derivadas","completed":true},{"id":"demo-sub-2","title":"Anotar dos dudas","completed":false},{"id":"demo-sub-3","title":"Intentar un ejercicio","completed":false}]'),
  (pg_temp.presentation_id('task:project'),camila,'Proyecto','[DEMO 17] Revisar el diseño de la agenda','media','pending',15,5,'[]') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.quick_ideas(id,user_id,content) VALUES(pg_temp.presentation_id('idea:camila'),camila,'[DEMO 17] Preguntar cuándo usar la regla de la cadena en una composición.') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.topic_assessments(id,user_id,subject_name,topic_name,mastery_level,score,total_questions,recurring_errors)
  VALUES(pg_temp.presentation_id('topic:camila'),camila,'Cálculo','Regla de la cadena','necesita_practicar',1,3,ARRAY['Identificar la función interior']) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.adaptive_learning_goals(user_id,course_id,goal_skill_id) VALUES(camila,'calculo-piloto-v1','chain') ON CONFLICT DO NOTHING;
 INSERT INTO public.adaptive_skill_mastery(user_id,course_id,skill_id,mastery,attempts,correct_count,last_correct)
  VALUES(camila,'calculo-piloto-v1','chain',0.12903225806451613,1,0,false) ON CONFLICT DO NOTHING;
 INSERT INTO public.adaptive_practice_attempts(id,user_id,course_id,skill_id,template_id,exercise,answer_given,correct,predicted_correct,mastery_before,mastery_after,answered_at)
  VALUES(pg_temp.presentation_id('adaptive:camila'),camila,'calculo-piloto-v1','chain','chain-1',
   '{"id":"demo-chain","skillId":"chain","templateId":"chain-1","prompt":"Deriva (x² + 1)³.","options":[{"id":"a","text":"6x(x²+1)²"},{"id":"b","text":"3(x²+1)²"},{"id":"c","text":"6x"},{"id":"d","text":"(x²+1)²"}],"correctOptionId":"a","explanation":"Deriva la función exterior y multiplica por 2x.","hint":"Recuerda la derivada de la función interior."}',
   'b',false,0.38,0.2,0.12903225806451613,now()-interval '1 hour') ON CONFLICT(id) DO NOTHING;
 -- Useful editor content; one private note and one draft stay outside public recommendations.
 FOR i IN 1..6 LOOP
  who:=CASE WHEN i>=5 THEN camila ELSE diego END;
  title:=CASE i WHEN 1 THEN '[DEMO 17] Guía breve de derivadas' WHEN 2 THEN '[DEMO 17] Python: listas y promedios' WHEN 3 THEN '[DEMO 17] Funciones antes de derivar' WHEN 4 THEN '[DEMO 17] Errores frecuentes en Cálculo' WHEN 5 THEN '[DEMO 17] Mis dudas privadas' ELSE '[DEMO 17] Borrador de repaso' END;
  INSERT INTO public.academic_notes(id,author_id,subject_id,subject_name,title,summary,content_html,content_markdown,tags,visibility,is_draft,source_type)
   VALUES(pg_temp.presentation_id('note:'||i),who,CASE WHEN i=2 THEN python ELSE calc END,CASE WHEN i=2 THEN 'Python' ELSE 'Cálculo' END,title,
   '[DEMO 17] Material ficticio para ensayar lectura, búsqueda y recomendaciones; no es contenido académico validado.',
   CASE WHEN i=2 THEN '<h2>Un promedio en Python</h2><p>valores = [4, 6, 8]</p><p>promedio = sum(valores) / len(valores)</p><p>Resultado: 6.0. Comprueba el resultado antes de continuar.</p>' ELSE '<h2>Derivar paso a paso</h2><ol><li>Identifica si hay una composición.</li><li>Deriva la función exterior.</li><li>Multiplica por la derivada interior.</li></ol><p>Ejemplo: f(x)=(x²+1)³ → f′(x)=6x(x²+1)².</p><p>Material DEMO, pendiente de validación docente.</p>' END,
   'Material DEMO: lee un ejemplo, anota una duda y comprueba tu resultado.',ARRAY[seed,CASE WHEN i=2 THEN 'python' ELSE 'mathematics' END],CASE WHEN i=5 THEN 'private' WHEN i=4 THEN 'shared' ELSE 'public' END,i=6,'editor') ON CONFLICT(id) DO NOTHING;
 END LOOP;
 INSERT INTO public.forum_posts(id,author_id,title,description,category,subject_id,tags) VALUES
  (post,camila,'[DEMO 17] ¿Cómo reconozco una función compuesta?','Estoy repasando derivadas. ¿Qué paso me ayuda a identificar la función interior antes de empezar? Escenario ficticio.','Matemáticas',calc,ARRAY[seed,'mathematics']),
  (pg_temp.presentation_id('forum:python'),valentina,'[DEMO 17] Buscamos ideas para una agenda de estudio','Queremos organizar tareas en pasos cortos. ¿Qué información debería verse primero? Escenario ficticio.','Proyectos',python,ARRAY[seed,'python']) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.forum_replies(id,post_id,author_id,content) VALUES(pg_temp.presentation_id('reply:calculo'),post,diego,'[DEMO 17] Encierra primero lo que está dentro del paréntesis: esa expresión es la función interior. Luego identifica la operación exterior.') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.projects(id,owner_id,title,short_description,description,problem_statement,objectives,category,technologies,tags,status,visibility,modality,max_members,agreements) VALUES
  (project,valentina,'[DEMO 17] Agenda de estudio accesible','Un equipo para convertir tareas grandes en pasos claros.','Proyecto ficticio: prototipo de agenda con pausas opcionales y seguimiento sencillo.','Los estudiantes necesitan organizar tareas sin dispersar herramientas.','Diseñar y probar una agenda de pasos pequeños.','Desarrollo de Software',ARRAY['React','TypeScript'],ARRAY[seed,'python','design','mathematics'],'recruiting','public','online',5,'{"communication":"Mensajes claros y reuniones acordadas","schedule":"Dos reuniones semanales"}'),
  (pg_temp.presentation_id('project:python'),diego,'[DEMO 17] Datos para estudiar mejor','Python y visualización con información ficticia.','Buscamos un equipo para analizar un conjunto de datos sintéticos y explicar sus resultados.','Entender hábitos de estudio con ejemplos ficticios.','Crear un informe sencillo sin datos personales.','Análisis de Datos',ARRAY['Python'],ARRAY[seed,'python','data-science'],'open','public','online',5,'{}'),
  (pg_temp.presentation_id('project:draft'),camila,'[DEMO 17] Mi idea de proyecto','Borrador privado de Camila.','Una idea todavía no publicada.','Definir el problema.','Preparar una propuesta.','Desarrollo de Software',ARRAY['Python'],ARRAY[seed],'draft','private','online',4,'{}') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.project_positions(id,project_id,title,description,skills_required,slots,status) VALUES
  (vacancy,project,'[DEMO 17] Desarrollo frontend','Crear una pantalla sencilla y accesible.',ARRAY['React'],2,'open'),
  (pg_temp.presentation_id('position:research'),project,'[DEMO 17] Investigación y pruebas','Revisar el prototipo con ejemplos ficticios.',ARRAY['Diseño'],2,'open'),
  (pg_temp.presentation_id('position:python'),pg_temp.presentation_id('project:python'),'[DEMO 17] Análisis con Python','Preparar un gráfico y explicar qué muestra.',ARRAY['Python'],2,'open') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.project_members(project_id,profile_id,position_id,member_role,role_name)
  VALUES(project,camila,pg_temp.presentation_id('position:research'),'member','Pruebas de usabilidad') ON CONFLICT(project_id,profile_id) DO NOTHING;
 INSERT INTO public.project_applications(id,project_id,position_id,applicant_id,message,relevant_skills,accepted_agreements,accepted_agreements_at)
  VALUES(pg_temp.presentation_id('application:diego'),project,vacancy,diego,'[DEMO 17] Quiero apoyar la pantalla de agenda con instrucciones breves.',ARRAY['React','TypeScript'],true,now()) ON CONFLICT DO NOTHING;
 INSERT INTO public.project_deliverables(id,project_id,title,description,assignee_id,due_date,status,created_by)
  VALUES(pg_temp.presentation_id('deliverable:wireframe'),project,'[DEMO 17] Prototipo de agenda','Revisar una pantalla y anotar tres mejoras.',camila,base+interval '1 day','in_progress',valentina) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.community_incidents(id,reporter_id,respondent_id,target_kind,target_id,category,description)
  VALUES(pg_temp.presentation_id('incident:pending'),camila,diego,'session',pg_temp.presentation_id('session:upcoming'),'agreement','[DEMO 17] Caso ficticio: necesitamos aclarar los acuerdos de horario. Se deja pendiente de un revisor autorizado; no representa una denuncia real.') ON CONFLICT(id) DO NOTHING;
 PERFORM public.enqueue_user_notice(camila,seed||':welcome','[DEMO 17] Tu recorrido está preparado','Tienes una ruta de Cálculo, una próxima tutoría y un proyecto en el que participas.','/dashboard');
 PERFORM public.enqueue_user_notice(diego,seed||':welcome','[DEMO 17] Revisa tus solicitudes','Hay una solicitud pendiente y una sesión que puedes confirmar con Camila.','/my-tutoring?tab=requests');
END $$;
