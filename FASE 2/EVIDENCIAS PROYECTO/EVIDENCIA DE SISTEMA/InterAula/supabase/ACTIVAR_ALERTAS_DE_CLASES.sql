-- Generado por scripts/build-class-alerts-activation.mjs.
-- Ejecutar completo en el proyecto Supabase de InterAula. No envía correos ni concede roles.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.user_notifications') IS NULL OR to_regprocedure('public.enqueue_user_notice(uuid,text,text,text,text)') IS NULL THEN
  RAISE EXCEPTION 'Primero activa ACTIVAR_INCIDENCIAS_Y_AVISOS.sql';
 END IF;
END $$;
-- Class alerts and a private transactional email queue. Never sends mail from SQL.
CREATE TABLE IF NOT EXISTS public.email_notification_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid NOT NULL UNIQUE REFERENCES public.user_notifications(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,resource_kind text NOT NULL CHECK(resource_kind IN('session','workshop')),
 resource_id uuid NOT NULL,event_name text NOT NULL,scheduled_snapshot timestamptz,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','processing','accepted','skipped','failed')),
 attempts integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),first_attempt_at timestamptz,lease_id uuid,lease_until timestamptz,
 destination_email text,payload jsonb,provider_id text,last_error_code text,finished_at timestamptz
);
ALTER TABLE public.email_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_notification_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_notification_outbox TO service_role;
CREATE INDEX IF NOT EXISTS email_queue_due ON public.email_notification_outbox(next_attempt_at) WHERE state IN('pending','processing');

CREATE OR REPLACE FUNCTION public.class_email_allowed(p_user uuid,p_reminder boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user
  AND coalesce(p.accessibility_preferences->>'emailTutoring','true')='true'
  AND (NOT p_reminder OR coalesce(p.accessibility_preferences->>'emailClassReminders','true')='true'))
$$;
REVOKE ALL ON FUNCTION public.class_email_allowed(uuid,boolean) FROM PUBLIC,anon,authenticated;

-- Only explicit class events enter this channel. Incident reports and private replies never do.
CREATE OR REPLACE FUNCTION public.queue_class_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event text:=split_part(NEW.event_key,':',1); kind text; resource uuid; scheduled timestamptz; expiry timestamptz;
BEGIN
 IF event NOT IN('session-request','session-receipt','session-accepted','session-tutor-accepted','session-status','session-started','session-review','session-completed','session-confirm','session-class-reminder24','session-class-reminder1',
  'workshop-created','workshop-enrolled','workshop-enrollment','workshop-left','workshop-member-left','workshop-unavailable','workshop-started','workshop-completed','workshop-rescheduled','workshop-class-reminder24','workshop-class-reminder1') THEN RETURN NEW; END IF;
 IF NOT public.class_email_allowed(NEW.recipient_id,event LIKE '%reminder%') THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.recipient_id AND email IS NOT NULL AND email_confirmed_at IS NOT NULL) THEN RETURN NEW; END IF;
 kind:=CASE WHEN event LIKE 'session-%' THEN 'session' ELSE 'workshop' END;
 resource:=split_part(NEW.event_key,':',2)::uuid;
 IF kind='session' THEN SELECT scheduled_at INTO scheduled FROM public.tutoring_sessions WHERE id=resource;
 ELSE SELECT scheduled_at INTO scheduled FROM public.tutoring_workshops WHERE id=resource; END IF;
 expiry:=CASE WHEN event LIKE '%reminder%' OR event IN('session-request','session-receipt','session-accepted','session-tutor-accepted','workshop-created','workshop-enrolled','workshop-enrollment','workshop-rescheduled') THEN scheduled ELSE now()+interval '1 day' END;
 IF expiry IS NULL OR expiry<=now() THEN RETURN NEW; END IF;
 INSERT INTO public.email_notification_outbox(notification_id,recipient_id,resource_kind,resource_id,event_name,scheduled_snapshot,expires_at)
  VALUES(NEW.id,NEW.recipient_id,kind,resource,event,scheduled,expiry) ON CONFLICT(notification_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS queue_class_email ON public.user_notifications;
CREATE TRIGGER queue_class_email AFTER INSERT ON public.user_notifications FOR EACH ROW EXECUTE FUNCTION public.queue_class_email();

CREATE OR REPLACE FUNCTION public.additional_session_alerts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE recipient uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM public.enqueue_user_notice(NEW.student_id,'session-receipt:'||NEW.id,'Solicitud de tutoría enviada','Tu solicitud está pendiente de la respuesta del tutor.','/tutoring?tab=my_classes');
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='accepted' THEN PERFORM public.enqueue_user_notice(NEW.tutor_id,'session-tutor-accepted:'||NEW.id,'Tutoría confirmada','Consulta los acuerdos y el horario de la sesión.','/my-tutoring');
  ELSIF NEW.status IN('cancelled','rejected') THEN
   FOREACH recipient IN ARRAY ARRAY[NEW.student_id,NEW.tutor_id] LOOP
    PERFORM public.enqueue_user_notice(recipient,'session-status:'||NEW.id||':'||NEW.status,'Cambio en una tutoría','Consulta el estado de la solicitud o sesión en tu agenda.','/my-tutoring');
   END LOOP;
  ELSIF NEW.status='in_progress' THEN
   FOREACH recipient IN ARRAY ARRAY[NEW.student_id,NEW.tutor_id] LOOP
    PERFORM public.enqueue_user_notice(recipient,'session-started:'||NEW.id,'La tutoría está en curso','Ya puedes abrir tu sesión desde la agenda.','/tutoring?tab=my_classes');
   END LOOP;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS additional_session_alerts ON public.tutoring_sessions;
CREATE TRIGGER additional_session_alerts AFTER INSERT OR UPDATE ON public.tutoring_sessions FOR EACH ROW EXECUTE FUNCTION public.additional_session_alerts();

CREATE OR REPLACE FUNCTION public.workshop_class_alerts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event text; title text; recipient uuid; version text;
BEGIN
 version:=extract(epoch FROM NEW.scheduled_at)::text;
 IF TG_OP='INSERT' THEN
  PERFORM public.enqueue_user_notice(NEW.tutor_id,'workshop-created:'||NEW.id,'Tu taller quedó programado','Puedes revisar la fecha y preparar tu clase.','/my-tutoring');RETURN NEW;
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  event:=CASE NEW.status WHEN 'cancelled' THEN 'workshop-unavailable' WHEN 'in_progress' THEN 'workshop-started' WHEN 'completed' THEN 'workshop-completed' ELSE NULL END;
  title:=CASE NEW.status WHEN 'cancelled' THEN 'Cambio en un taller' WHEN 'in_progress' THEN 'Tu taller ya comenzó' WHEN 'completed' THEN 'El taller finalizó' ELSE NULL END;
 ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at AND NEW.status='scheduled' THEN event:='workshop-rescheduled';title:='Cambió el horario de tu taller';
 END IF;
 IF event IS NOT NULL THEN
  FOR recipient IN SELECT NEW.tutor_id UNION SELECT student_id FROM public.workshop_enrollments WHERE workshop_id=NEW.id LOOP
   PERFORM public.enqueue_user_notice(recipient,event||':'||NEW.id||CASE WHEN event='workshop-rescheduled' THEN ':'||version ELSE '' END,title,'Consulta el estado y horario actual en tu agenda.','/tutoring?tab=my_classes');
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS workshop_class_alerts ON public.tutoring_workshops;
CREATE TRIGGER workshop_class_alerts AFTER INSERT OR UPDATE ON public.tutoring_workshops FOR EACH ROW EXECUTE FUNCTION public.workshop_class_alerts();

CREATE OR REPLACE FUNCTION public.enrollment_class_alerts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item public.workshop_enrollments%ROWTYPE; teacher uuid;
BEGIN
 item:=CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 SELECT tutor_id INTO teacher FROM public.tutoring_workshops WHERE id=item.workshop_id;
 IF teacher IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=item.student_id) THEN
  PERFORM public.enqueue_user_notice(item.student_id,CASE WHEN TG_OP='DELETE' THEN 'workshop-left' ELSE 'workshop-enrolled' END||':'||item.workshop_id||':'||item.id,
   CASE WHEN TG_OP='DELETE' THEN 'Inscripción al taller cancelada' ELSE 'Tu cupo en el taller está reservado' END,'Consulta tu agenda y los talleres disponibles.','/tutoring?tab=my_classes');
 END IF;
 IF teacher IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=teacher) THEN
  PERFORM public.enqueue_user_notice(teacher,CASE WHEN TG_OP='DELETE' THEN 'workshop-member-left' ELSE 'workshop-enrollment' END||':'||item.workshop_id||':'||item.id,
   CASE WHEN TG_OP='DELETE' THEN 'Se liberó un cupo de tu taller' ELSE 'Nueva inscripción a tu taller' END,'Puedes revisar los participantes en la gestión de tu taller.','/my-tutoring');
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS enrollment_class_alerts ON public.workshop_enrollments;
CREATE TRIGGER enrollment_class_alerts AFTER INSERT OR DELETE ON public.workshop_enrollments FOR EACH ROW EXECUTE FUNCTION public.enrollment_class_alerts();

-- Invoked by the backend every minute, and for the current user when the inbox is opened.
CREATE OR REPLACE FUNCTION public.generate_class_reminders(p_actor uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record; created integer:=0;
BEGIN
 UPDATE public.email_notification_outbox SET state='skipped',last_error_code='EVENT_EXPIRED',finished_at=now(),lease_id=NULL,lease_until=NULL
  WHERE state IN('pending','processing') AND expires_at<=now() AND (lease_until IS NULL OR lease_until<=now());
 FOR item IN
  WITH classes AS (
   SELECT 'session' AS kind,s.id,s.scheduled_at,participants.recipient FROM public.tutoring_sessions s CROSS JOIN LATERAL(VALUES(s.student_id),(s.tutor_id)) participants(recipient)
    WHERE s.status='accepted' AND s.scheduled_at>now() AND s.scheduled_at<=now()+interval '24 hours'
   UNION
   SELECT 'workshop',w.id,w.scheduled_at,participants.recipient FROM public.tutoring_workshops w CROSS JOIN LATERAL(SELECT w.tutor_id AS recipient UNION SELECT e.student_id FROM public.workshop_enrollments e WHERE e.workshop_id=w.id) participants
    WHERE w.status='scheduled' AND w.scheduled_at>now() AND w.scheduled_at<=now()+interval '24 hours'
  ), events AS (
   SELECT *,kind||'-class-reminder'||CASE WHEN scheduled_at<=now()+interval '1 hour' THEN '1' ELSE '24' END||':'||id||':'||extract(epoch FROM scheduled_at) AS key FROM classes
  ) SELECT * FROM events e WHERE (p_actor IS NULL OR recipient=p_actor)
    AND NOT EXISTS(SELECT 1 FROM public.user_notifications n WHERE n.recipient_id=e.recipient AND n.event_key=e.key)
    ORDER BY scheduled_at,id LIMIT 500
 LOOP
  PERFORM public.enqueue_user_notice(item.recipient,item.key,
   CASE WHEN item.kind='session' THEN CASE WHEN item.scheduled_at<=now()+interval '1 hour' THEN 'Tu tutoría comienza en menos de una hora' ELSE 'Tutoría en las próximas 24 horas' END
   ELSE CASE WHEN item.scheduled_at<=now()+interval '1 hour' THEN 'Tu taller comienza en menos de una hora' ELSE 'Taller en las próximas 24 horas' END END,
   'Consulta el horario y prepara lo necesario para tu clase.','/tutoring?tab=my_classes');created:=created+1;
 END LOOP;
 RETURN created;
END $$;
REVOKE ALL ON FUNCTION public.generate_class_reminders(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_class_reminders(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_inbox(p_include_items boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); items jsonb:='[]'; total integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Inicia sesión' USING ERRCODE='42501'; END IF;
 IF p_include_items THEN
  PERFORM public.generate_class_reminders(actor);
  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC,n.id),'[]') INTO items FROM
   (SELECT id,title,body,href,created_at,read_at FROM public.user_notifications WHERE recipient_id=actor ORDER BY created_at DESC,id LIMIT 100) n;
 END IF;
 SELECT count(*)::int INTO total FROM public.user_notifications WHERE recipient_id=actor AND read_at IS NULL;
 RETURN jsonb_build_object('items',items,'unreadCount',total,'canReview',public.can_review_incidents(),'limit',100);
END $$;

CREATE OR REPLACE FUNCTION public.email_job_is_current(p_job public.email_notification_outbox) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE status text; scheduled timestamptz;
BEGIN
 IF p_job.expires_at<=now() OR NOT public.class_email_allowed(p_job.recipient_id,p_job.event_name LIKE '%reminder%') THEN RETURN false; END IF;
 IF p_job.resource_kind='session' THEN SELECT s.status,s.scheduled_at INTO status,scheduled FROM public.tutoring_sessions s WHERE s.id=p_job.resource_id;
 ELSE SELECT w.status,w.scheduled_at INTO status,scheduled FROM public.tutoring_workshops w WHERE w.id=p_job.resource_id; END IF;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_job.event_name LIKE '%reminder24' AND scheduled<=now()+interval '1 hour' THEN RETURN false; END IF;
 IF p_job.event_name LIKE '%reminder%' OR p_job.event_name IN('session-accepted','session-tutor-accepted','workshop-created','workshop-enrolled','workshop-enrollment','workshop-rescheduled') THEN
  IF scheduled IS DISTINCT FROM p_job.scheduled_snapshot OR scheduled<=now() OR status NOT IN('accepted','scheduled') THEN RETURN false; END IF;
 END IF;
 IF p_job.event_name IN('session-request','session-receipt') AND status<>'pending' THEN RETURN false; END IF;
 IF p_job.event_name IN('workshop-enrolled','workshop-enrollment') AND NOT EXISTS(SELECT 1 FROM public.workshop_enrollments e JOIN public.user_notifications n ON n.id=p_job.notification_id WHERE e.workshop_id=p_job.resource_id AND e.id::text=split_part(n.event_key,':',3)) THEN RETURN false; END IF;
 IF p_job.resource_kind='workshop' AND (p_job.event_name LIKE '%reminder%' OR p_job.event_name IN('workshop-rescheduled','workshop-started','workshop-completed'))
  AND NOT EXISTS(SELECT 1 FROM public.tutoring_workshops w WHERE w.id=p_job.resource_id AND (w.tutor_id=p_job.recipient_id OR EXISTS(SELECT 1 FROM public.workshop_enrollments e WHERE e.workshop_id=w.id AND e.student_id=p_job.recipient_id))) THEN RETURN false; END IF;
 IF p_job.event_name IN('session-started','workshop-started') AND status<>'in_progress' THEN RETURN false; END IF;
 IF p_job.event_name='session-confirm' AND status NOT IN('accepted','in_progress') THEN RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.email_job_is_current(public.email_notification_outbox) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_class_email() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job public.email_notification_outbox%ROWTYPE; address text; verified timestamptz; notice public.user_notifications%ROWTYPE;
BEGIN
 -- The retry window stays below Resend's 24-hour idempotency retention.
 UPDATE public.email_notification_outbox SET state='failed',last_error_code='RETRY_WINDOW_EXPIRED',finished_at=now()
  WHERE state IN('pending','processing') AND (lease_until IS NULL OR lease_until<=now()) AND (attempts>=5 OR first_attempt_at<now()-interval '20 hours');
 FOR job IN SELECT * FROM public.email_notification_outbox WHERE (state='pending' AND next_attempt_at<=now()) OR (state='processing' AND lease_until<=now()) ORDER BY next_attempt_at,id LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
  SELECT u.email,u.email_confirmed_at INTO address,verified FROM auth.users u WHERE u.id=job.recipient_id;
  IF NOT public.email_job_is_current(job) OR verified IS NULL OR address IS NULL OR (job.destination_email IS NOT NULL AND job.destination_email<>address) THEN
   UPDATE public.email_notification_outbox SET state='skipped',last_error_code='NO_LONGER_ELIGIBLE',finished_at=now() WHERE id=job.id;CONTINUE;
  END IF;
  SELECT * INTO notice FROM public.user_notifications WHERE id=job.notification_id;
  UPDATE public.email_notification_outbox SET state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',
   destination_email=coalesce(destination_email,address),payload=coalesce(payload,jsonb_build_object('title',notice.title,'body',notice.body,'href',notice.href,'scheduledAt',job.scheduled_snapshot,'kind',job.resource_kind)) WHERE id=job.id RETURNING * INTO job;
  RETURN jsonb_build_object('id',job.id,'lease',job.lease_id,'attempt',job.attempts,'to',job.destination_email,'payload',job.payload);
 END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_class_email() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.claim_class_email() TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_class_email(p_id uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job public.email_notification_outbox%ROWTYPE;
BEGIN
 SELECT * INTO job FROM public.email_notification_outbox WHERE id=p_id AND state='processing' AND lease_id=p_lease AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT public.email_job_is_current(job) OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=job.recipient_id AND email=job.destination_email AND email_confirmed_at IS NOT NULL) THEN
  UPDATE public.email_notification_outbox SET state='skipped',last_error_code='NO_LONGER_ELIGIBLE',finished_at=now(),lease_id=NULL,lease_until=NULL WHERE id=job.id;RETURN NULL;
 END IF;
 RETURN jsonb_build_object('id',job.id,'lease',job.lease_id,'attempt',job.attempts,'to',job.destination_email,'payload',job.payload);
END $$;
REVOKE ALL ON FUNCTION public.prepare_class_email(uuid,uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.prepare_class_email(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_class_email(p_id uuid,p_lease uuid,p_state text,p_provider_id text DEFAULT NULL,p_error_code text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_state IS NULL OR p_state NOT IN('accepted','pending','failed') THEN RAISE EXCEPTION 'Estado de entrega no válido'; END IF;
 UPDATE public.email_notification_outbox SET state=CASE WHEN p_state='pending' AND attempts>=5 THEN 'failed' ELSE p_state END,
  provider_id=left(p_provider_id,200),last_error_code=left(p_error_code,80),next_attempt_at=now()+make_interval(secs=>least(3600,60*(power(2,attempts)::int))),
  finished_at=CASE WHEN p_state<>'pending' OR attempts>=5 THEN now() ELSE NULL END,lease_id=NULL,lease_until=NULL
 WHERE id=p_id AND state='processing' AND lease_id=p_lease AND lease_until>now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.finish_class_email(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_class_email(uuid,uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';

COMMIT;
SELECT 'Alertas de clases y correo preparadas' AS estado,
 to_regclass('public.email_notification_outbox') IS NOT NULL AS cola_activada,
 to_regprocedure('public.generate_class_reminders(uuid)') IS NOT NULL AS recordatorios_activados;
