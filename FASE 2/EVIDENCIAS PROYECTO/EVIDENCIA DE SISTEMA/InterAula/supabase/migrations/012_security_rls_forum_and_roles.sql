-- ==============================================================================
-- InterAula: Migración 012
-- Seguridad RLS, Integridad de Sesiones/Talleres, Verificación de Roles y Persistencia de Foro
-- ==============================================================================

-- 1. PRIVACIDAD DE PERFILES Y ACTUALIZACIÓN DE VISTA PÚBLICA
-- Modificar public.public_profiles para enmascarar estrictamente datos sensibles
-- (learning_preferences, teléfono y correo no público)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.display_name,
  p.avatar_url,
  p.institution,
  p.career,
  p.bio,
  p.location,
  p.profile_completed,
  p.available_for_tutoring,
  p.portfolio_url,
  p.github_url,
  p.linkedin_url,
  -- learning_preferences solo es visible para el propio usuario
  CASE 
    WHEN auth.uid() IS NOT NULL AND auth.uid() = p.id THEN p.learning_preferences
    ELSE '{}'::text[]
  END AS learning_preferences,
  -- email protegido por preferencia show_email o propiedad
  CASE 
    WHEN p.show_email = true OR (auth.uid() IS NOT NULL AND auth.uid() = p.id) THEN p.email 
    ELSE NULL 
  END AS email,
  -- phone protegido por preferencia show_phone o propiedad
  CASE 
    WHEN p.show_phone = true OR (auth.uid() IS NOT NULL AND auth.uid() = p.id) THEN p.phone 
    ELSE NULL 
  END AS phone,
  p.show_email,
  p.show_phone,
  p.created_at,
  p.updated_at
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 2. INTEGRIDAD DE SESIONES DE TUTORÍA
-- Disparador de seguridad para impedir que un estudiante marque falsamente
-- la sesión como completada o auto-certifique su propia asistencia
CREATE OR REPLACE FUNCTION public.enforce_tutoring_session_update_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el usuario que ejecuta la actualización es el estudiante y no el tutor:
  IF auth.uid() = OLD.student_id AND auth.uid() <> OLD.tutor_id THEN
    -- El estudiante no puede marcar la sesión como 'accepted', 'in_progress' ni 'completed'
    IF NEW.status IN ('completed', 'accepted', 'in_progress') AND OLD.status <> NEW.status THEN
      RAISE EXCEPTION 'Operación denegada: Solo el tutor asignado puede aceptar, iniciar o completar una tutoría.';
    END IF;

    -- El estudiante no puede auto-marcar attendance_verified
    IF NEW.attendance_verified = true AND OLD.attendance_verified = false THEN
      RAISE EXCEPTION 'Operación denegada: La asistencia solo puede certificarse mediante el sistema de aula o el tutor.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tutoring_session_update_security ON public.tutoring_sessions;
CREATE TRIGGER trg_enforce_tutoring_session_update_security
  BEFORE UPDATE ON public.tutoring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tutoring_session_update_security();

-- 3. INTEGRIDAD EN CREACIÓN DE TALLERES GRUPALES
-- Solo tutores con materias verificadas o validadores académicos pueden publicar talleres
DROP POLICY IF EXISTS "Tutors can create workshops" ON public.tutoring_workshops;
CREATE POLICY "Tutors can create workshops"
  ON public.tutoring_workshops FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = tutor_id
    AND (
      EXISTS (
        SELECT 1 FROM public.profile_offered_subjects pos 
        WHERE pos.profile_id = auth.uid() 
          AND pos.is_verified = true
      )
      OR EXISTS (
        SELECT 1 FROM public.academic_validators av 
        WHERE av.profile_id = auth.uid()
      )
    )
  );

-- 4. FUNCIONES HELPER RPC PARA VALIDACIÓN DE ROLES
-- Permiten consultar de forma rápida y segura si un usuario es tutor verificado o validador
CREATE OR REPLACE FUNCTION public.check_user_is_verified_tutor(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profile_offered_subjects
    WHERE profile_id = p_user_id AND is_verified = true
  ) OR EXISTS (
    SELECT 1 FROM public.academic_validators
    WHERE profile_id = p_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_is_verified_tutor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_is_verified_tutor(uuid) TO anon;

-- 5. PERSISTENCIA DEL FORO ACADÉMICO (TABLAS, ÍNDICES Y POLÍTICAS RLS)
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  tags text[] DEFAULT '{}'::text[],
  votes_count integer NOT NULL DEFAULT 0,
  replies_count integer NOT NULL DEFAULT 0,
  is_solved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_forum_post_title CHECK (length(trim(title)) >= 5),
  CONSTRAINT check_forum_post_desc CHECK (length(trim(description)) >= 10)
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON public.forum_posts(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON public.forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON public.forum_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  votes_count integer NOT NULL DEFAULT 0,
  is_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_forum_reply_content CHECK (length(trim(content)) >= 2)
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON public.forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author ON public.forum_replies(author_id);

-- 5.1 RLS FORO
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- Lectura pública para usuarios autenticados y visitantes
DROP POLICY IF EXISTS "forum_posts_select" ON public.forum_posts;
CREATE POLICY "forum_posts_select"
  ON public.forum_posts FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "forum_replies_select" ON public.forum_replies;
CREATE POLICY "forum_replies_select"
  ON public.forum_replies FOR SELECT
  TO authenticated, anon
  USING (true);

-- Creación por autor autenticado
DROP POLICY IF EXISTS "forum_posts_insert" ON public.forum_posts;
CREATE POLICY "forum_posts_insert"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_replies_insert" ON public.forum_replies;
CREATE POLICY "forum_replies_insert"
  ON public.forum_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Actualización por autor
DROP POLICY IF EXISTS "forum_posts_update" ON public.forum_posts;
CREATE POLICY "forum_posts_update"
  ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_replies_update" ON public.forum_replies;
CREATE POLICY "forum_replies_update"
  ON public.forum_replies FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Eliminación por autor
DROP POLICY IF EXISTS "forum_posts_delete" ON public.forum_posts;
CREATE POLICY "forum_posts_delete"
  ON public.forum_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_replies_delete" ON public.forum_replies;
CREATE POLICY "forum_replies_delete"
  ON public.forum_replies FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- 5.2 Disparador para mantener sincronizado replies_count en forum_posts
CREATE OR REPLACE FUNCTION public.handle_forum_reply_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts
    SET replies_count = replies_count + 1, updated_at = now()
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_posts
    SET replies_count = GREATEST(0, replies_count - 1), updated_at = now()
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_reply_counter ON public.forum_replies;
CREATE TRIGGER trg_forum_reply_counter
  AFTER INSERT OR DELETE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_forum_reply_counter();
