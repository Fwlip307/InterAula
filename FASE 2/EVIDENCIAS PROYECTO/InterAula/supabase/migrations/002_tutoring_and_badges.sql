-- ==============================================================================
-- InterAula: Sprint 2 - Migración 002
-- Módulo de Tutorías Universitarias, Evaluaciones e Insignias Académicas
-- Compatible con 001_profiles_and_projects.sql y la Arquitectura de Cuenta Híbrida
-- ==============================================================================

-- 1. TABLA: tutoring_sessions (Ciclo de vida de solicitudes y sesiones de tutoría)
CREATE TABLE IF NOT EXISTS public.tutoring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 300),
  modality text NOT NULL DEFAULT 'online' CHECK (modality IN ('online', 'in_person')),
  location_or_link text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  cancellation_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_different_participants CHECK (student_id <> tutor_id)
);

-- Índices de consulta frecuente y desempeño
CREATE INDEX IF NOT EXISTS idx_sessions_student ON public.tutoring_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tutor ON public.tutoring_sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON public.tutoring_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.tutoring_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON public.tutoring_sessions(scheduled_at);

-- 2. TABLA: tutoring_reviews (Evaluaciones multicriterio de 1 a 10 entre pares)
CREATE TABLE IF NOT EXISTS public.tutoring_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.tutoring_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  communication_score integer NOT NULL CHECK (communication_score BETWEEN 1 AND 10),
  knowledge_score integer NOT NULL CHECK (knowledge_score BETWEEN 1 AND 10),
  punctuality_score integer NOT NULL CHECK (punctuality_score BETWEEN 1 AND 10),
  overall_score numeric(4,2) GENERATED ALWAYS AS (
    ROUND((communication_score + knowledge_score + punctuality_score)::numeric / 3.0, 2)
  ) STORED,
  comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_review_participants CHECK (student_id <> tutor_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_tutor ON public.tutoring_reviews(tutor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_session ON public.tutoring_reviews(session_id);

-- 3. TABLAS: badges y user_badges (Sistema de prestigio e insignias automáticas)
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon_name text NOT NULL DEFAULT 'AwardIcon',
  category text NOT NULL DEFAULT 'tutoring' CHECK (category IN ('tutoring', 'academic', 'projects')),
  required_count integer NOT NULL DEFAULT 1 CHECK (required_count >= 1),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_user_badge UNIQUE (profile_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_profile ON public.user_badges(profile_id);

-- 4. VISTA AGREGADA SEGURA: tutor_statistics_view
-- Resuelve la multiplicación cartesiana calculando métricas de sesiones y reviews por separado
CREATE OR REPLACE VIEW public.tutor_statistics_view 
WITH (security_invoker = on) AS
WITH session_counts AS (
  SELECT 
    tutor_id,
    COUNT(*) AS total_completed_tutorings
  FROM public.tutoring_sessions
  WHERE status = 'completed'
  GROUP BY tutor_id
),
review_stats AS (
  SELECT 
    tutor_id,
    COUNT(*) AS total_reviews_received,
    ROUND(AVG(communication_score)::numeric, 2) AS avg_communication,
    ROUND(AVG(knowledge_score)::numeric, 2) AS avg_knowledge,
    ROUND(AVG(punctuality_score)::numeric, 2) AS avg_punctuality,
    ROUND(AVG(overall_score)::numeric, 2) AS overall_rating
  FROM public.tutoring_reviews
  GROUP BY tutor_id
)
SELECT 
  p.id AS profile_id,
  COALESCE(sc.total_completed_tutorings, 0) AS total_completed_tutorings,
  COALESCE(rs.total_reviews_received, 0) AS total_reviews_received,
  COALESCE(rs.avg_communication, 0.00) AS avg_communication,
  COALESCE(rs.avg_knowledge, 0.00) AS avg_knowledge,
  COALESCE(rs.avg_punctuality, 0.00) AS avg_punctuality,
  COALESCE(rs.overall_rating, 0.00) AS overall_rating
FROM public.profiles p
LEFT JOIN session_counts sc ON sc.tutor_id = p.id
LEFT JOIN review_stats rs ON rs.tutor_id = p.id;

-- 5. TRIGGER DE SEGURIDAD Y REGLAS DE NEGOCIO: tutoring_sessions
-- Valida inserciones y transiciones de estado a nivel de motor PostgreSQL
CREATE OR REPLACE FUNCTION public.validate_tutoring_session_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tutor_available boolean;
  v_offers_subject boolean;
  v_current_user uuid;
BEGIN
  v_current_user := auth.uid();

  -- =========================================================================
  -- Validaciones de INSERCIÓN (Creación de Solicitud)
  -- =========================================================================
  IF TG_OP = 'INSERT' THEN
    -- 1. El estudiante debe ser el usuario autenticado
    IF v_current_user IS NOT NULL AND NEW.student_id <> v_current_user THEN
      RAISE EXCEPTION 'No puedes solicitar una tutoría en nombre de otro estudiante';
    END IF;

    -- 2. Estado inicial obligatorio: pending
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'Una nueva sesión debe crearse obligatoriamente en estado pending';
    END IF;

    -- 3. La fecha de la sesión debe ser futura
    IF NEW.scheduled_at <= (now() - interval '2 minutes') THEN
      RAISE EXCEPTION 'La fecha y hora de la tutoría debe ser futura';
    END IF;

    -- 4. Verificar que el tutor exista y tenga disponible la opción de tutorías
    SELECT available_for_tutoring INTO v_tutor_available
    FROM public.profiles
    WHERE id = NEW.tutor_id;

    IF v_tutor_available IS NOT TRUE THEN
      RAISE EXCEPTION 'El tutor seleccionado no está disponible para ofrecer tutorías actualmente';
    END IF;

    -- 5. Verificar que el tutor ofrezca efectivamente la materia solicitada
    SELECT EXISTS (
      SELECT 1 FROM public.profile_offered_subjects
      WHERE profile_id = NEW.tutor_id AND subject_id = NEW.subject_id
    ) INTO v_offers_subject;

    IF NOT v_offers_subject THEN
      RAISE EXCEPTION 'El tutor seleccionado no tiene registrada la materia solicitada en sus materias ofrecidas';
    END IF;

    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- =========================================================================
  -- Validaciones de ACTUALIZACIÓN (Transiciones de Estado e Inmutabilidad)
  -- =========================================================================
  IF TG_OP = 'UPDATE' THEN
    -- 1. Inmutabilidad de los participantes y la asignatura
    IF NEW.student_id <> OLD.student_id THEN
      RAISE EXCEPTION 'No se permite modificar el estudiante de una sesión existente';
    END IF;
    IF NEW.tutor_id <> OLD.tutor_id THEN
      RAISE EXCEPTION 'No se permite modificar el tutor de una sesión existente';
    END IF;
    IF NEW.subject_id <> OLD.subject_id THEN
      RAISE EXCEPTION 'No se permite modificar la materia de una sesión existente';
    END IF;

    -- 2. Inmutabilidad de estados terminales
    IF OLD.status IN ('completed', 'rejected', 'cancelled') THEN
      RAISE EXCEPTION 'Una sesión en estado terminal (%) no puede ser modificada', OLD.status;
    END IF;

    -- 3. Reglas de transición según estado anterior
    IF OLD.status = 'pending' THEN
      IF NEW.status = 'accepted' THEN
        -- Solo el tutor puede aceptar
        IF v_current_user IS NOT NULL AND v_current_user <> OLD.tutor_id THEN
          RAISE EXCEPTION 'Solo el tutor asignado puede aceptar la solicitud de tutoría';
        END IF;
      ELSIF NEW.status = 'rejected' THEN
        -- Solo el tutor puede rechazar
        IF v_current_user IS NOT NULL AND v_current_user <> OLD.tutor_id THEN
          RAISE EXCEPTION 'Solo el tutor asignado puede rechazar la solicitud de tutoría';
        END IF;
      ELSIF NEW.status = 'cancelled' THEN
        -- El estudiante puede cancelar su solicitud pendiente
        IF v_current_user IS NOT NULL AND v_current_user <> OLD.student_id THEN
          RAISE EXCEPTION 'Solo el estudiante solicitante puede cancelar una solicitud pendiente';
        END IF;
      ELSIF NEW.status = 'completed' THEN
        RAISE EXCEPTION 'Una sesión pendiente no puede pasar directamente a completada sin ser aceptada primero';
      END IF;

    ELSIF OLD.status = 'accepted' THEN
      IF NEW.status = 'completed' THEN
        -- Para el MVP: El estudiante confirma la realización de la sesión
        IF v_current_user IS NOT NULL AND v_current_user <> OLD.student_id THEN
          RAISE EXCEPTION 'Para el MVP, solo el estudiante puede confirmar que la sesión fue completada';
        END IF;

        -- La confirmación solo es válida después de la hora programada
        IF now() < OLD.scheduled_at THEN
          RAISE EXCEPTION 'No se puede marcar la sesión como completada antes de su fecha y hora programada';
        END IF;
      ELSIF NEW.status = 'cancelled' THEN
        -- Cualquiera de los dos puede cancelar antes del encuentro
        IF v_current_user IS NOT NULL AND v_current_user NOT IN (OLD.student_id, OLD.tutor_id) THEN
          RAISE EXCEPTION 'Solo los participantes de la sesión pueden cancelarla';
        END IF;
      ELSIF NEW.status = 'rejected' THEN
        RAISE EXCEPTION 'Una sesión ya aceptada no puede ser rechazada; debe ser cancelada';
      END IF;
    END IF;

    -- Actualizar timestamp
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tutoring_session ON public.tutoring_sessions;
CREATE TRIGGER trg_validate_tutoring_session
  BEFORE INSERT OR UPDATE ON public.tutoring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tutoring_session_transition();

-- 6. TRIGGER DE SEGURIDAD: tutoring_reviews
-- Valida que la sesión esté completada, que los participantes coincidan y previene ediciones
CREATE OR REPLACE FUNCTION public.validate_tutoring_review_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_student uuid;
  v_session_tutor uuid;
  v_session_status text;
  v_current_user uuid;
BEGIN
  v_current_user := auth.uid();

  -- Obtener datos de la sesión correspondiente
  SELECT student_id, tutor_id, status 
  INTO v_session_student, v_session_tutor, v_session_status
  FROM public.tutoring_sessions
  WHERE id = NEW.session_id;

  IF v_session_student IS NULL THEN
    RAISE EXCEPTION 'La sesión de tutoría referenciada no existe';
  END IF;

  IF v_session_status <> 'completed' THEN
    RAISE EXCEPTION 'Solo se pueden evaluar sesiones de tutoría que hayan sido completadas';
  END IF;

  -- Validar coincidencia estricta de participantes
  IF NEW.student_id <> v_session_student OR NEW.tutor_id <> v_session_tutor THEN
    RAISE EXCEPTION 'Los participantes de la evaluación deben coincidir exactamente con los participantes de la sesión';
  END IF;

  -- Solo el estudiante de la sesión puede emitir la evaluación
  IF v_current_user IS NOT NULL AND NEW.student_id <> v_current_user THEN
    RAISE EXCEPTION 'Solo el estudiante que participó en la sesión puede enviar la evaluación';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tutoring_review ON public.tutoring_reviews;
CREATE TRIGGER trg_validate_tutoring_review
  BEFORE INSERT ON public.tutoring_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tutoring_review_submission();

-- 7. TRIGGER AUTOMÁTICO DE INSIGNIAS: Otorgamiento seguro post-completitud
CREATE OR REPLACE FUNCTION public.handle_award_tutoring_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_completed_count integer;
  v_badge_id uuid;
BEGIN
  -- Evaluar solo cuando la sesión transiciona efectivamente a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    
    -- Conteo exacto y seguro de sesiones completadas por este tutor
    SELECT COUNT(*) INTO v_completed_count
    FROM public.tutoring_sessions
    WHERE tutor_id = NEW.tutor_id AND status = 'completed';

    -- Hito 1: Primera tutoría completada
    IF v_completed_count >= 1 THEN
      SELECT id INTO v_badge_id FROM public.badges WHERE code = 'tutoring_1';
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (profile_id, badge_id)
        VALUES (NEW.tutor_id, v_badge_id)
        ON CONFLICT (profile_id, badge_id) DO NOTHING;
      END IF;
    END IF;

    -- Hito 2: 10 tutorías completadas
    IF v_completed_count >= 10 THEN
      SELECT id INTO v_badge_id FROM public.badges WHERE code = 'tutoring_10';
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (profile_id, badge_id)
        VALUES (NEW.tutor_id, v_badge_id)
        ON CONFLICT (profile_id, badge_id) DO NOTHING;
      END IF;
    END IF;

    -- Hito 3: 25 tutorías completadas
    IF v_completed_count >= 25 THEN
      SELECT id INTO v_badge_id FROM public.badges WHERE code = 'tutoring_25';
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (profile_id, badge_id)
        VALUES (NEW.tutor_id, v_badge_id)
        ON CONFLICT (profile_id, badge_id) DO NOTHING;
      END IF;
    END IF;

    -- Hito 4: 50 tutorías completadas
    IF v_completed_count >= 50 THEN
      SELECT id INTO v_badge_id FROM public.badges WHERE code = 'tutoring_50';
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (profile_id, badge_id)
        VALUES (NEW.tutor_id, v_badge_id)
        ON CONFLICT (profile_id, badge_id) DO NOTHING;
      END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_tutoring_badges ON public.tutoring_sessions;
CREATE TRIGGER trg_award_tutoring_badges
  AFTER UPDATE OF status ON public.tutoring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_award_tutoring_badges();

-- 8. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tutoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutoring_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- 8.1. RLS: tutoring_sessions
DROP POLICY IF EXISTS "Participants can view their sessions" ON public.tutoring_sessions;
CREATE POLICY "Participants can view their sessions"
  ON public.tutoring_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = tutor_id);

DROP POLICY IF EXISTS "Students can request sessions" ON public.tutoring_sessions;
CREATE POLICY "Students can request sessions"
  ON public.tutoring_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id AND student_id <> tutor_id);

DROP POLICY IF EXISTS "Participants can update their sessions" ON public.tutoring_sessions;
CREATE POLICY "Participants can update their sessions"
  ON public.tutoring_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = tutor_id)
  WITH CHECK (auth.uid() = student_id OR auth.uid() = tutor_id);

-- 8.2. RLS: tutoring_reviews
DROP POLICY IF EXISTS "Reviews are viewable by authenticated users" ON public.tutoring_reviews;
CREATE POLICY "Reviews are viewable by authenticated users"
  ON public.tutoring_reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only student can submit review" ON public.tutoring_reviews;
CREATE POLICY "Only student can submit review"
  ON public.tutoring_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Las evaluaciones son estrictamente inmutables (no se permite UPDATE ni DELETE a usuarios)

-- 8.3. RLS: badges y user_badges
DROP POLICY IF EXISTS "Badges are viewable by authenticated users" ON public.badges;
CREATE POLICY "Badges are viewable by authenticated users"
  ON public.badges FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "User badges are viewable by authenticated users" ON public.user_badges;
CREATE POLICY "User badges are viewable by authenticated users"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (true);

-- user_badges no tiene políticas de INSERT/UPDATE para usuarios:
-- Solo el trigger SECURITY DEFINER (handle_award_tutoring_badges) puede insertar filas.

-- 9. PERMISOS EXPLÍCITOS
GRANT SELECT ON public.tutor_statistics_view TO authenticated;

-- 10. DATOS SEMILLA: Insignias Oficiales del Capstone (Hitos 1, 10, 25, 50)
INSERT INTO public.badges (code, name, description, icon_name, category, required_count)
VALUES
  ('tutoring_1', 'Primera Tutoría', 'Completó exitosamente su primera tutoría como facilitador académico.', 'SparklesIcon', 'tutoring', 1),
  ('tutoring_10', 'Tutor Comprometido', 'Alcanzó 10 sesiones de tutoría completadas con compañeros.', 'AwardIcon', 'tutoring', 10),
  ('tutoring_25', 'Tutor Consagrado', 'Alcanzó 25 sesiones de acompañamiento académico universitario.', 'StarIcon', 'tutoring', 25),
  ('tutoring_50', 'Mentor de Excelencia', 'Alcanzó 50 sesiones de tutoría, demostrando máxima vocación de servicio.', 'ShieldCheckIcon', 'tutoring', 50)
ON CONFLICT (code) DO NOTHING;
