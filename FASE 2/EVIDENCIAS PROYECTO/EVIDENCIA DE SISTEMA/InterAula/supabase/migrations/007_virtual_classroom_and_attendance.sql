-- ==============================================================================
-- InterAula: Sprint 3 - Migración 007
-- Aula Virtual Integrada con Videollamada (Jitsi/WebRTC) y Control de Asistencia Real
-- Compatible con 001 a 006
-- ==============================================================================

-- 1. EXTENSIÓN DE TABLA: tutoring_sessions
-- Soporte para sala virtual única, trazabilidad de conexión y auditoría de asistencia
ALTER TABLE public.tutoring_sessions
  ADD COLUMN IF NOT EXISTS room_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS student_joined_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tutor_joined_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS both_connected_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_verified boolean NOT NULL DEFAULT false;

-- Índice para búsquedas rápidas por ID de sala
CREATE INDEX IF NOT EXISTS idx_sessions_room_id 
  ON public.tutoring_sessions(room_id);

-- 2. GENERACIÓN AUTOMÁTICA DE IDENTIFICADOR DE SALA VIRTUAL
-- Asigna un identificador amigable y determinista a las sesiones online
CREATE OR REPLACE FUNCTION public.generate_tutoring_room_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.modality = 'online' AND (NEW.room_id IS NULL OR trim(NEW.room_id) = '') THEN
    NEW.room_id := 'ia-aula-' || substr(replace(NEW.id::text, '-', ''), 1, 12);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_tutoring_room_id ON public.tutoring_sessions;
CREATE TRIGGER trg_generate_tutoring_room_id
  BEFORE INSERT ON public.tutoring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tutoring_room_id();

-- Actualizar retroactivamente sesiones online existentes que no tengan room_id
-- Se deshabilita temporalmente el trigger de transición de estados para no bloquear sesiones ya canceladas/completadas
ALTER TABLE public.tutoring_sessions DISABLE TRIGGER trg_validate_tutoring_session;

UPDATE public.tutoring_sessions
SET room_id = 'ia-aula-' || substr(replace(id::text, '-', ''), 1, 12)
WHERE modality = 'online' AND (room_id IS NULL OR trim(room_id) = '');

ALTER TABLE public.tutoring_sessions ENABLE TRIGGER trg_validate_tutoring_session;

-- 3. FUNCIÓN RPC SEGURA: register_session_attendance
-- Permite auditar el ingreso en tiempo real de los participantes y certificar asistencia
CREATE OR REPLACE FUNCTION public.register_session_attendance(
  p_session_id uuid,
  p_action text, -- 'join', 'heartbeat', 'leave'
  p_duration_minutes integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_session record;
  v_is_student boolean;
  v_is_tutor boolean;
  v_now timestamptz := now();
  v_attendance_verified boolean;
  v_both_connected_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Obtener sesión
  SELECT * INTO v_session
  FROM public.tutoring_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada';
  END IF;

  v_is_student := (v_session.student_id = v_user_id);
  v_is_tutor := (v_session.tutor_id = v_user_id);

  IF NOT v_is_student AND NOT v_is_tutor THEN
    RAISE EXCEPTION 'No eres participante de esta sesión de tutoría';
  END IF;

  -- Preparar variables de actualización
  v_both_connected_at := v_session.both_connected_at;
  v_attendance_verified := v_session.attendance_verified;

  IF p_action = 'join' THEN
    IF v_is_student THEN
      v_session.student_joined_at := COALESCE(v_session.student_joined_at, v_now);
    ELSIF v_is_tutor THEN
      v_session.tutor_joined_at := COALESCE(v_session.tutor_joined_at, v_now);
    END IF;

    -- Si ambos ya han ingresado a la sala en algún momento
    IF v_session.student_joined_at IS NOT NULL AND v_session.tutor_joined_at IS NOT NULL THEN
      v_both_connected_at := COALESCE(v_session.both_connected_at, v_now);
      v_attendance_verified := true;
    END IF;

    UPDATE public.tutoring_sessions
    SET 
      student_joined_at = v_session.student_joined_at,
      tutor_joined_at = v_session.tutor_joined_at,
      both_connected_at = v_both_connected_at,
      attendance_verified = v_attendance_verified,
      updated_at = v_now
    WHERE id = p_session_id;

  ELSIF p_action = 'heartbeat' OR p_action = 'leave' THEN
    -- Actualizar minutos reales acumulados si corresponde
    IF p_duration_minutes > 0 THEN
      UPDATE public.tutoring_sessions
      SET 
        actual_duration_minutes = GREATEST(COALESCE(actual_duration_minutes, 0), p_duration_minutes),
        updated_at = v_now
      WHERE id = p_session_id;
    END IF;
  END IF;

  -- Retornar estado actualizado
  SELECT * INTO v_session
  FROM public.tutoring_sessions
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'room_id', v_session.room_id,
    'student_joined_at', v_session.student_joined_at,
    'tutor_joined_at', v_session.tutor_joined_at,
    'both_connected_at', v_session.both_connected_at,
    'actual_duration_minutes', v_session.actual_duration_minutes,
    'attendance_verified', v_session.attendance_verified
  );
END;
$$;
