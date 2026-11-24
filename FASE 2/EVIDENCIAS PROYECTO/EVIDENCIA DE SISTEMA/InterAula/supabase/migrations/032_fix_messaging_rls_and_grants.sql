-- ==============================================================================
-- InterAula: Migración 032
-- Corrección definitiva de permisos (GRANTs) y creación atómica con RLS para
-- mensajería directa (resuelve HTTP 403 / SQLSTATE 42501 al iniciar un chat).
-- Idempotente y no destructiva. Compatible con migración 031 ya aplicada.
-- ==============================================================================
BEGIN;

-- 1. Garantizar privilegios explícitos para roles authenticated y service_role
GRANT SELECT, INSERT, UPDATE ON TABLE public.direct_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.direct_conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.direct_messages TO authenticated;

GRANT ALL ON TABLE public.direct_conversations TO service_role;
GRANT ALL ON TABLE public.direct_conversation_participants TO service_role;
GRANT ALL ON TABLE public.direct_messages TO service_role;

REVOKE ALL ON FUNCTION public.is_direct_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_direct_conversation_participant(uuid) TO authenticated, service_role;

-- 2. RPC atómica para crear o abrir una conversación 1-a-1 sin romper la política SELECT
--    de RLS durante INSERT ... RETURNING y sin permitir que un usuario se agregue a chats ajenos.
CREATE OR REPLACE FUNCTION public.create_or_open_direct_conversation(
  p_recipient_id uuid,
  p_context_type text DEFAULT 'general',
  p_context_id uuid DEFAULT NULL,
  p_context_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_context text := coalesce(nullif(trim(p_context_type), ''), 'general');
  v_first text;
  v_second text;
  v_key text;
  v_conv_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '42501';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_uid THEN
    RAISE EXCEPTION 'Destinatario inválido' USING ERRCODE = '22023';
  END IF;

  IF v_context NOT IN ('general', 'tutoring', 'project') THEN
    RAISE EXCEPTION 'Contexto inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'Destinatario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_uid::text < p_recipient_id::text THEN
    v_first := v_uid::text;
    v_second := p_recipient_id::text;
  ELSE
    v_first := p_recipient_id::text;
    v_second := v_uid::text;
  END IF;

  v_key := CASE
    WHEN p_context_id IS NOT NULL THEN v_first || ':' || v_second || ':' || v_context || ':' || p_context_id::text
    ELSE v_first || ':' || v_second || ':' || v_context
  END;

  INSERT INTO public.direct_conversations (
    participant_key,
    context_type,
    context_id,
    context_label
  )
  VALUES (
    v_key,
    v_context,
    p_context_id,
    nullif(left(trim(coalesce(p_context_label, '')), 120), '')
  )
  ON CONFLICT (participant_key) DO UPDATE
    SET updated_at = now()
  RETURNING id INTO v_conv_id;

  INSERT INTO public.direct_conversation_participants (conversation_id, user_id)
  VALUES
    (v_conv_id, v_uid),
    (v_conv_id, p_recipient_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conv_id;
END $$;

REVOKE ALL ON FUNCTION public.create_or_open_direct_conversation(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_open_direct_conversation(uuid, text, uuid, text) TO authenticated, service_role;

-- 3. Endurecer inserciones directas: los chats nuevos se abren únicamente vía RPC o servicio autorizado
DROP POLICY IF EXISTS "direct_conversations_insert_authenticated" ON public.direct_conversations;
DROP POLICY IF EXISTS "direct_participants_insert_authenticated" ON public.direct_conversation_participants;

NOTIFY pgrst, 'reload schema';
COMMIT;
