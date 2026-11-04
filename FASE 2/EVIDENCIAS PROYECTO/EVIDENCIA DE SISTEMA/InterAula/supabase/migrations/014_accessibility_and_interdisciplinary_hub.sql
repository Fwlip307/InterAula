-- =============================================================================
-- MIGRACIÓN 014: ACCESIBILIDAD TRANSVERSAL, PRIVACIDAD DE PREFERENCIAS Y HUB DE PROYECTOS
-- =============================================================================
-- 1. Agrega preferencias de accesibilidad (Modo Calma, tamaño de fuente, contraste,
--    espaciado, cuestionarios sin tiempo) en public.profiles.
-- 2. Protege la privacidad de learning_preferences y accessibility_preferences en
--    la vista public.public_profiles (solo visibles para el propio titular).
-- 3. Agrega fecha estimada de inicio (start_date) en public.projects.
-- =============================================================================

-- 1. Asegurar columnas de accesibilidad, aprendizaje y proyectos en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available_for_projects boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS learning_preferences text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS accessibility_preferences jsonb DEFAULT '{
    "calmMode": false,
    "fontSize": "normal",
    "contrast": "standard",
    "reduceMotion": false,
    "spacing": "standard",
    "untimedQuizzes": true,
    "quietNotifications": false,
    "emailTutoring": true,
    "emailProjects": true
  }'::jsonb;

-- 2. Columna de fecha estimada de inicio en projects
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date date;
  END IF;
END $$;

-- 3. Recrear vista segura public_profiles ocultando preferencias privadas a terceros
DROP VIEW IF EXISTS public.public_profiles CASCADE;

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
  p.available_for_projects,
  p.portfolio_url,
  p.github_url,
  p.linkedin_url,
  CASE
    WHEN auth.uid() IS NOT NULL AND auth.uid() = p.id THEN p.learning_preferences
    ELSE '{}'::text[]
  END AS learning_preferences,
  CASE
    WHEN auth.uid() IS NOT NULL AND auth.uid() = p.id THEN p.accessibility_preferences
    ELSE NULL
  END AS accessibility_preferences,
  CASE
    WHEN p.show_email = true OR (auth.uid() IS NOT NULL AND auth.uid() = p.id) THEN p.email
    ELSE NULL
  END AS email,
  CASE
    WHEN p.show_phone = true OR (auth.uid() IS NOT NULL AND auth.uid() = p.id) THEN p.phone
    ELSE NULL
  END AS phone,
  p.show_email,
  p.show_phone,
  p.created_at,
  p.updated_at
FROM public.profiles p;

-- 4. Restaurar permisos de lectura en la vista
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
