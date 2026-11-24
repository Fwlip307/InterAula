-- ==============================================================================
-- InterAula: Migración 031
-- 1. Corrección transaccional de grant_tutor_assessment ante solicitudes previas
--    pendientes para la misma materia (evita violación 23505 sin afectar otras).
-- 2. Mensajería directa persistente entre usuarios con RLS estricto y Realtime.
-- Compatible con migraciones 001 a 030. No destructiva.
-- ==============================================================================
BEGIN;

-- 1. ACTUALIZACIÓN SEGURA DE grant_tutor_assessment
CREATE OR REPLACE FUNCTION public.grant_tutor_assessment(p_attempt_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.tutor_assessment_attempts%ROWTYPE;
  v_request public.tutor_verification_requests%ROWTYPE;
  v_verified boolean;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación reservada al servidor' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_attempt
  FROM public.tutor_assessment_attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluación no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_attempt.state = 'granted' THEN
    SELECT * INTO v_request
    FROM public.tutor_verification_requests
    WHERE assessment_attempt_id = p_attempt_id;

    IF NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM public.profile_offered_subjects
      WHERE profile_id = p_user_id AND subject_id = v_attempt.subject_id AND is_verified
    ) THEN
      RAISE EXCEPTION 'La acreditación fue revocada o requiere revisión' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF v_attempt.state <> 'passed'
       OR v_attempt.score < 70
       OR jsonb_array_length(v_attempt.answers) <> jsonb_array_length(v_attempt.questions)
       OR v_attempt.expires_at <= now() THEN
      RAISE EXCEPTION 'La evaluación no está aprobada o expiró' USING ERRCODE = '23514';
    END IF;

    PERFORM 1
    FROM public.profile_offered_subjects
    WHERE profile_id = p_user_id AND subject_id = v_attempt.subject_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La asignatura ya no está ofrecida' USING ERRCODE = '23514';
    END IF;

    -- Si existía una solicitud previa sin resolver para esta misma materia, sustituirla atómicamente.
    DELETE FROM public.tutor_verification_requests
    WHERE tutor_id = p_user_id
      AND subject_id = v_attempt.subject_id
      AND status IN ('pending', 'practical_evaluation', 'under_review');

    UPDATE public.tutor_assessment_attempts
    SET state = 'granted', granted_at = now(), updated_at = now()
    WHERE id = p_attempt_id;

    INSERT INTO public.tutor_verification_requests (
      tutor_id, subject_id, status, verification_source,
      assessment_attempt_id, reviewed_at, reviewer_feedback, calculated_level
    )
    VALUES (
      p_user_id, v_attempt.subject_id, 'approved', 'assessment',
      p_attempt_id, now(),
      'Evaluación básica corregida por el servidor: ' || v_attempt.score || '%.', 'basic'
    )
    RETURNING * INTO v_request;

    SELECT is_verified INTO v_verified
    FROM public.profile_offered_subjects
    WHERE profile_id = p_user_id AND subject_id = v_attempt.subject_id;

    IF NOT coalesce(v_verified, false) OR v_request.status <> 'approved' THEN
      RAISE EXCEPTION 'No se pudo confirmar la acreditación' USING ERRCODE = '23514';
    END IF;

    UPDATE public.profiles SET available_for_tutoring = true WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'subject_id', v_attempt.subject_id,
    'level', 'basic',
    'score', v_attempt.score,
    'request', to_jsonb(v_request)
  );
END $$;

REVOKE ALL ON FUNCTION public.grant_tutor_assessment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tutor_assessment(uuid, uuid) TO service_role;

-- 2. MENSAJERÍA DIRECTA PERSISTENTE ENTRE PARTICIPANTES
CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_key text NOT NULL UNIQUE,
  context_type text NOT NULL DEFAULT 'general' CHECK (context_type IN ('general', 'tutoring', 'project')),
  context_id uuid,
  context_label text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_last_message
  ON public.direct_conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.direct_conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_participants_user
  ON public.direct_conversation_participants(user_id, conversation_id);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
  ON public.direct_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_unread
  ON public.direct_messages(conversation_id, sender_id)
  WHERE read_at IS NULL;

-- Trigger para actualizar metadatos de la conversación al recibir un mensaje
CREATE OR REPLACE FUNCTION public.sync_direct_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.direct_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = left(trim(NEW.body), 160),
    updated_at = now()
  WHERE id = NEW.conversation_id;

  UPDATE public.direct_conversation_participants
  SET last_read_at = NEW.created_at
  WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_direct_conversation_last_message ON public.direct_messages;
CREATE TRIGGER trg_sync_direct_conversation_last_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_direct_conversation_last_message();

-- Función auxiliar para evitar recursión en RLS
CREATE OR REPLACE FUNCTION public.is_direct_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.direct_conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_direct_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_direct_conversation_participant(uuid) TO authenticated;

-- Políticas RLS estrictas
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "direct_conversations_select_participants" ON public.direct_conversations;
CREATE POLICY "direct_conversations_select_participants"
  ON public.direct_conversations FOR SELECT
  TO authenticated
  USING (public.is_direct_conversation_participant(id));

DROP POLICY IF EXISTS "direct_conversations_insert_authenticated" ON public.direct_conversations;
CREATE POLICY "direct_conversations_insert_authenticated"
  ON public.direct_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "direct_participants_select_own_conversations" ON public.direct_conversation_participants;
CREATE POLICY "direct_participants_select_own_conversations"
  ON public.direct_conversation_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_direct_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "direct_participants_insert_authenticated" ON public.direct_conversation_participants;
CREATE POLICY "direct_participants_insert_authenticated"
  ON public.direct_conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "direct_participants_update_self" ON public.direct_conversation_participants;
CREATE POLICY "direct_participants_update_self"
  ON public.direct_conversation_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "direct_messages_select_participants" ON public.direct_messages;
CREATE POLICY "direct_messages_select_participants"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (public.is_direct_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "direct_messages_insert_participant_sender" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_participant_sender"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_direct_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "direct_messages_update_mark_read" ON public.direct_messages;
CREATE POLICY "direct_messages_update_mark_read"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (public.is_direct_conversation_participant(conversation_id) AND sender_id <> auth.uid())
  WITH CHECK (public.is_direct_conversation_participant(conversation_id) AND sender_id <> auth.uid());

-- Habilitar Realtime para entrega en vivo de mensajes directos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
