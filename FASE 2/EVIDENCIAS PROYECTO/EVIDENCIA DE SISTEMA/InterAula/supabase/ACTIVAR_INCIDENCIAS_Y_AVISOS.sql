-- Ejecutar completo. No asigna revisores ni borra registros.
BEGIN;
-- Private incident workflow and transactional in-app notices. No reviewer is appointed here.
CREATE TABLE IF NOT EXISTS public.community_reviewers(
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.community_incidents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES public.profiles(id),respondent_id uuid NOT NULL REFERENCES public.profiles(id),
 target_kind text NOT NULL CHECK(target_kind IN('session','profile','note','post','project','workshop')),target_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN('no_show','agreement','harassment','fraud','content','other')),
 description text NOT NULL CHECK(length(description) BETWEEN 20 AND 4000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','under_review','awaiting_reply','resolved','closed','appealed')),
 shared_summary text,assigned_reviewer uuid REFERENCES public.profiles(id),resolved_by uuid REFERENCES public.profiles(id),
 resolution text,appeal_used boolean NOT NULL DEFAULT false,appealed_by uuid REFERENCES public.profiles(id),
 revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS incident_one_active_report ON public.community_incidents(reporter_id,target_kind,target_id)
 WHERE status IN('open','under_review','awaiting_reply','appealed');
CREATE INDEX IF NOT EXISTS incident_respondent ON public.community_incidents(respondent_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.community_incident_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),incident_id uuid NOT NULL REFERENCES public.community_incidents(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),kind text NOT NULL,body text NOT NULL CHECK(length(body)<=4000),
 audience text NOT NULL CHECK(audience IN('team','parties')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incident_events_case ON public.community_incident_events(incident_id,created_at);
CREATE TABLE IF NOT EXISTS public.user_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 event_key text NOT NULL,title text NOT NULL,body text NOT NULL,href text NOT NULL CHECK(href LIKE '/%' AND href NOT LIKE '//%'),
 created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,UNIQUE(recipient_id,event_key)
);
CREATE INDEX IF NOT EXISTS notifications_recipient ON public.user_notifications(recipient_id,created_at DESC);
ALTER TABLE public.community_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_reviewers,public.community_incidents,public.community_incident_events,public.user_notifications FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.community_reviewers,public.community_incidents,public.community_incident_events,public.user_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.can_review_incidents() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.community_reviewers WHERE profile_id=auth.uid() AND active)
$$;
REVOKE ALL ON FUNCTION public.can_review_incidents() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_review_incidents() TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_user_notice(p_user uuid,p_key text,p_title text,p_body text,p_href text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 INSERT INTO public.user_notifications(recipient_id,event_key,title,body,href) VALUES(p_user,p_key,p_title,p_body,p_href)
 ON CONFLICT(recipient_id,event_key) DO NOTHING
$$;
REVOKE ALL ON FUNCTION public.enqueue_user_notice(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_incident(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.community_incidents%ROWTYPE; actor uuid:=auth.uid(); reviewer boolean; events jsonb;
BEGIN
 SELECT * INTO c FROM public.community_incidents WHERE id=p_id;
 reviewer:=public.can_review_incidents() AND actor NOT IN(c.reporter_id,c.respondent_id);
 IF NOT FOUND OR actor IS NULL OR (actor NOT IN(c.reporter_id,c.respondent_id) AND NOT reviewer) THEN
  RAISE EXCEPTION 'Incidencia no disponible' USING ERRCODE='42501';
 END IF;
 IF actor=c.respondent_id AND c.shared_summary IS NULL AND c.resolution IS NULL THEN
  RAISE EXCEPTION 'La incidencia aún no tiene un resumen revisado' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'body',e.body,'createdAt',e.created_at,
  'actor',CASE WHEN e.actor_id=actor THEN 'Tú' WHEN e.actor_id=c.reporter_id THEN 'Quien reporta' WHEN e.actor_id=c.respondent_id THEN 'Persona involucrada' ELSE 'Equipo de revisión' END) ORDER BY e.created_at,e.id),'[]')
 INTO events FROM public.community_incident_events e WHERE e.incident_id=c.id AND (reviewer OR e.actor_id=actor OR e.audience='parties');
 RETURN jsonb_build_object('id',c.id,'targetKind',c.target_kind,'targetId',c.target_id,'category',c.category,'status',c.status,
  'description',CASE WHEN actor=c.reporter_id OR reviewer THEN c.description ELSE NULL END,
  'sharedSummary',c.shared_summary,'resolution',c.resolution,'revision',c.revision,'createdAt',c.created_at,'updatedAt',c.updated_at,
  'role',CASE WHEN actor=c.reporter_id THEN 'reporter' WHEN actor=c.respondent_id THEN 'respondent' ELSE 'reviewer' END,
  'assignedToMe',c.assigned_reviewer=actor,'assigned',c.assigned_reviewer IS NOT NULL,
  'canClaim',reviewer AND c.assigned_reviewer IS NULL AND c.status IN('open','appealed') AND (NOT c.appeal_used OR c.resolved_by IS DISTINCT FROM actor),
  'canAppeal',actor IN(c.reporter_id,c.respondent_id) AND c.status IN('resolved','closed') AND NOT c.appeal_used,
  'appealUsed',c.appeal_used,'events',events);
END $$;
REVOKE ALL ON FUNCTION public.get_incident(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_incident(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_incidents(p_queue text DEFAULT 'mine') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); items jsonb;
BEGIN
 IF actor IS NULL OR p_queue NOT IN('mine','review') OR (p_queue='review' AND NOT public.can_review_incidents()) THEN
  RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'targetKind',c.target_kind,'category',c.category,'status',c.status,'updatedAt',c.updated_at,
  'role',CASE WHEN actor=c.reporter_id THEN 'reporter' WHEN actor=c.respondent_id THEN 'respondent' ELSE 'reviewer' END) ORDER BY c.updated_at DESC,c.id),'[]') INTO items
 FROM (SELECT * FROM public.community_incidents WHERE (p_queue='mine' AND (actor=reporter_id OR (actor=respondent_id AND (shared_summary IS NOT NULL OR resolution IS NOT NULL))))
  OR (p_queue='review' AND actor NOT IN(reporter_id,respondent_id)) ORDER BY updated_at DESC,id LIMIT 100) c;
 RETURN jsonb_build_object('items',items,'canReview',public.can_review_incidents(),'limit',100);
END $$;
REVOKE ALL ON FUNCTION public.list_incidents(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_incidents(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_incident(p_kind text,p_target uuid,p_category text,p_description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); target_owner uuid; case_id uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Inicia sesión' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN('session','profile','note','post','project','workshop') OR p_category NOT IN('no_show','agreement','harassment','fraud','content','other')
  OR length(trim(coalesce(p_description,''))) NOT BETWEEN 20 AND 4000 THEN RAISE EXCEPTION 'Revisa el reporte' USING ERRCODE='23514'; END IF;
 -- Explicit visibility checks inside SECURITY DEFINER; no private resource is opened to reviewers.
 CASE p_kind
 WHEN 'session' THEN SELECT CASE WHEN tutor_id=actor THEN student_id ELSE tutor_id END INTO target_owner FROM public.tutoring_sessions WHERE id=p_target AND actor IN(student_id,tutor_id);
 WHEN 'profile' THEN SELECT id INTO target_owner FROM public.public_profiles WHERE id=p_target;
 WHEN 'note' THEN SELECT author_id INTO target_owner FROM public.academic_notes WHERE id=p_target AND NOT is_draft AND visibility IN('public','shared');
 WHEN 'post' THEN SELECT author_id INTO target_owner FROM public.forum_posts WHERE id=p_target;
 WHEN 'project' THEN SELECT owner_id INTO target_owner FROM public.projects WHERE id=p_target AND visibility='public';
 WHEN 'workshop' THEN SELECT tutor_id INTO target_owner FROM public.tutoring_workshops WHERE id=p_target;
 END CASE;
 IF target_owner IS NULL OR target_owner=actor THEN RAISE EXCEPTION 'No puedes reportar este recurso' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,27));
 SELECT id INTO case_id FROM public.community_incidents WHERE reporter_id=actor AND target_kind=p_kind AND target_id=p_target AND status IN('open','under_review','awaiting_reply','appealed');
 IF case_id IS NOT NULL THEN RETURN public.get_incident(case_id); END IF;
 IF (SELECT count(*) FROM public.community_incidents WHERE reporter_id=actor AND created_at>now()-interval '1 day')>=10 THEN
  RAISE EXCEPTION 'Alcanzaste el límite diario de reportes' USING ERRCODE='23514'; END IF;
 INSERT INTO public.community_incidents(reporter_id,respondent_id,target_kind,target_id,category,description)
  VALUES(actor,target_owner,p_kind,p_target,p_category,trim(p_description)) RETURNING id INTO case_id;
 INSERT INTO public.community_incident_events(incident_id,actor_id,kind,body,audience) VALUES(case_id,actor,'created','Reporte recibido. Queda pendiente de un revisor autorizado.','team');
 PERFORM public.enqueue_user_notice(actor,'incident-created:'||case_id,'Reporte recibido','Puedes consultar su estado en Mis incidencias.','/support?case='||case_id);
 -- Notify only active, non-conflicted reviewers. No accusation is sent to the respondent before review.
 PERFORM public.enqueue_user_notice(profile_id,'incident-new:'||case_id,'Incidencia pendiente','Hay una incidencia disponible para revisión.','/support?case='||case_id)
  FROM public.community_reviewers WHERE active AND profile_id NOT IN(actor,target_owner);
 RETURN public.get_incident(case_id);
END $$;
REVOKE ALL ON FUNCTION public.create_incident(text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_incident(text,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.act_on_incident(p_id uuid,p_action text,p_message text,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.community_incidents%ROWTYPE; actor uuid:=auth.uid(); reviewer boolean; msg text:=trim(coalesce(p_message,'')); audience text:='team';
BEGIN
 SELECT * INTO c FROM public.community_incidents WHERE id=p_id FOR UPDATE;
 reviewer:=public.can_review_incidents() AND actor NOT IN(c.reporter_id,c.respondent_id);
 IF NOT FOUND OR actor IS NULL OR (actor NOT IN(c.reporter_id,c.respondent_id) AND NOT reviewer) THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF p_revision IS NULL OR c.revision<>p_revision THEN RAISE EXCEPTION 'La incidencia cambió. Recarga antes de actuar' USING ERRCODE='40001'; END IF;
 IF p_action IN('reply','note') AND (SELECT count(*) FROM public.community_incident_events WHERE incident_id=c.id AND actor_id=actor AND created_at>now()-interval '1 hour')>=20 THEN
  RAISE EXCEPTION 'Alcanzaste el límite de mensajes de esta hora' USING ERRCODE='23514'; END IF;
 IF actor=c.respondent_id AND c.shared_summary IS NULL AND c.resolution IS NULL THEN
  RAISE EXCEPTION 'Espera el resumen del equipo de revisión' USING ERRCODE='42501'; END IF;
 IF p_action='claim' THEN
  IF NOT reviewer OR c.assigned_reviewer IS NOT NULL OR c.status NOT IN('open','appealed') OR (c.appeal_used AND c.resolved_by=actor) THEN
   RAISE EXCEPTION 'No puedes asumir esta revisión' USING ERRCODE='42501'; END IF;
  c.assigned_reviewer:=actor;c.status:='under_review';msg:='Un revisor autorizado asumió la revisión.';audience:='parties';
 ELSIF p_action='reply' THEN
  IF actor NOT IN(c.reporter_id,c.respondent_id) OR c.status NOT IN('open','under_review','awaiting_reply','appealed') OR length(msg) NOT BETWEEN 10 AND 4000 THEN
   RAISE EXCEPTION 'No puedes enviar este mensaje' USING ERRCODE='23514'; END IF;
  IF c.status='awaiting_reply' THEN c.status:='under_review'; END IF;
 ELSIF p_action='note' THEN
  IF NOT reviewer OR c.assigned_reviewer IS DISTINCT FROM actor OR length(msg) NOT BETWEEN 10 AND 4000 THEN
   RAISE EXCEPTION 'Solo el revisor asignado puede registrar notas' USING ERRCODE='42501'; END IF;
 ELSIF p_action='appeal' THEN
  IF actor NOT IN(c.reporter_id,c.respondent_id) OR c.status NOT IN('resolved','closed') OR c.appeal_used OR length(msg) NOT BETWEEN 20 AND 4000 THEN
   RAISE EXCEPTION 'Esta resolución no admite otra apelación' USING ERRCODE='23514'; END IF;
  c.status:='appealed';c.appeal_used:=true;c.appealed_by:=actor;c.assigned_reviewer:=NULL;
 ELSIF p_action IN('request_reply','resolve','close') THEN
  IF NOT reviewer OR c.assigned_reviewer IS DISTINCT FROM actor OR c.status NOT IN('under_review','awaiting_reply')
   OR (c.appeal_used AND c.resolved_by=actor) OR length(msg) NOT BETWEEN 20 AND 4000 THEN RAISE EXCEPTION 'No puedes resolver esta incidencia' USING ERRCODE='42501'; END IF;
  audience:='parties';
  IF p_action='request_reply' THEN c.status:='awaiting_reply';c.shared_summary:=msg;
  ELSE c.status:=CASE WHEN p_action='resolve' THEN 'resolved' ELSE 'closed' END;c.resolution:=msg;c.resolved_by:=actor; END IF;
 ELSE RAISE EXCEPTION 'Acción no válida' USING ERRCODE='23514'; END IF;
 UPDATE public.community_incidents SET status=c.status,assigned_reviewer=c.assigned_reviewer,shared_summary=c.shared_summary,
  resolution=c.resolution,resolved_by=c.resolved_by,appeal_used=c.appeal_used,appealed_by=c.appealed_by,revision=revision+1,updated_at=clock_timestamp() WHERE id=c.id;
 INSERT INTO public.community_incident_events(incident_id,actor_id,kind,body,audience) VALUES(c.id,actor,p_action,msg,audience);
 IF audience='parties' THEN
  PERFORM public.enqueue_user_notice(c.reporter_id,'incident-update:'||c.id||':'||(c.revision+1),'Actualización de tu incidencia','Consulta el seguimiento privado.','/support?case='||c.id);
  IF c.shared_summary IS NOT NULL OR p_action IN('resolve','close') THEN
   PERFORM public.enqueue_user_notice(c.respondent_id,'incident-update:'||c.id||':'||(c.revision+1),'Actualización de una incidencia','Puedes consultar el resumen y responder en privado.','/support?case='||c.id);
  END IF;
 ELSE
  PERFORM public.enqueue_user_notice(profile_id,'incident-message:'||c.id||':'||(c.revision+1),'Incidencia con nuevos antecedentes','Consulta la revisión privada.','/support?case='||c.id)
   FROM public.community_reviewers WHERE active AND profile_id NOT IN(c.reporter_id,c.respondent_id) AND (NOT c.appeal_used OR profile_id IS DISTINCT FROM c.resolved_by);
 END IF;
 RETURN public.get_incident(c.id);
END $$;
REVOKE ALL ON FUNCTION public.act_on_incident(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.act_on_incident(uuid,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutoring_inbox_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM public.enqueue_user_notice(NEW.tutor_id,'session-request:'||NEW.id,'Nueva solicitud de tutoría','Revisa y responde la solicitud en Mis tutorías.','/my-tutoring?tab=requests');
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='accepted' THEN
   PERFORM public.enqueue_user_notice(NEW.student_id,'session-accepted:'||NEW.id,'Tutoría aceptada','Consulta fecha y modalidad en tu agenda.','/tutoring?tab=my_classes');
  ELSIF NEW.status IN('cancelled','rejected') THEN
   target:=CASE WHEN auth.uid()=NEW.student_id THEN NEW.tutor_id ELSE NEW.student_id END;
   PERFORM public.enqueue_user_notice(target,'session-status:'||NEW.id||':'||NEW.status,'Cambio en una tutoría','Consulta el estado y los acuerdos en Mis tutorías.','/my-tutoring');
  ELSIF NEW.status='completed' THEN
   PERFORM public.enqueue_user_notice(NEW.student_id,'session-review:'||NEW.id,'Tu valoración está pendiente','La sesión terminó. Puedes valorar tu experiencia.','/my-tutoring?tab=history');
   PERFORM public.enqueue_user_notice(NEW.tutor_id,'session-completed:'||NEW.id,'Sesión validada','Puedes consultar tu trayectoria y reputación.','/profile?tab=tutoring');
  END IF;
 ELSE
  IF NEW.tutor_completion_confirmed_at IS DISTINCT FROM OLD.tutor_completion_confirmed_at AND NEW.student_completion_confirmed_at IS NULL THEN target:=NEW.student_id;
  ELSIF NEW.student_completion_confirmed_at IS DISTINCT FROM OLD.student_completion_confirmed_at AND NEW.tutor_completion_confirmed_at IS NULL THEN target:=NEW.tutor_id; END IF;
  IF target IS NOT NULL THEN PERFORM public.enqueue_user_notice(target,'session-confirm:'||NEW.id,'Confirma si la tutoría se realizó','El otro participante registró su confirmación. Responde solo si participaste.','/my-tutoring'); END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tutoring_inbox_events ON public.tutoring_sessions;
CREATE TRIGGER tutoring_inbox_events AFTER INSERT OR UPDATE ON public.tutoring_sessions FOR EACH ROW EXECUTE FUNCTION public.tutoring_inbox_events();
CREATE OR REPLACE FUNCTION public.review_inbox_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.enqueue_user_notice(NEW.tutor_id,'review-received:'||NEW.id,'Recibiste una valoración','Puedes consultar el resumen de tu reputación y la sesión.','/profile?tab=tutoring');RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS review_inbox_event ON public.tutoring_reviews;
CREATE TRIGGER review_inbox_event AFTER INSERT ON public.tutoring_reviews FOR EACH ROW EXECUTE FUNCTION public.review_inbox_event();

CREATE OR REPLACE FUNCTION public.get_my_inbox(p_include_items boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); items jsonb:='[]'; total integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Inicia sesión' USING ERRCODE='42501'; END IF;
 IF p_include_items THEN
  PERFORM public.enqueue_user_notice(actor,'session-reminder:'||id,'Tutoría en las próximas 24 horas','Consulta el horario y prepara lo necesario.','/my-tutoring')
   FROM public.tutoring_sessions WHERE actor IN(student_id,tutor_id) AND status IN('accepted','in_progress') AND scheduled_at BETWEEN now() AND now()+interval '24 hours';
  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC,n.id),'[]') INTO items FROM
   (SELECT id,title,body,href,created_at,read_at FROM public.user_notifications WHERE recipient_id=actor ORDER BY created_at DESC,id LIMIT 100) n;
 END IF;
 SELECT count(*)::int INTO total FROM public.user_notifications WHERE recipient_id=actor AND read_at IS NULL;
 RETURN jsonb_build_object('items',items,'unreadCount',total,'canReview',public.can_review_incidents(),'limit',100);
END $$;
REVOKE ALL ON FUNCTION public.get_my_inbox(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_inbox(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.read_my_notice(p_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión' USING ERRCODE='42501'; END IF;
 UPDATE public.user_notifications SET read_at=coalesce(read_at,clock_timestamp()) WHERE recipient_id=auth.uid() AND (p_id IS NULL OR id=p_id) AND read_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.read_my_notice(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_my_notice(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
SELECT 'Incidencias y avisos activados' AS estado,
 to_regprocedure('public.create_incident(text,uuid,text,text)') IS NOT NULL AS incidencias_activadas,
 to_regprocedure('public.get_my_inbox(boolean)') IS NOT NULL AS avisos_activados;
