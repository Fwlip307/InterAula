-- ==============================================================================
-- InterAula: Sprint 3 - Migración 009
-- Depuración de Módulo de Proyectos, Limpieza de Vistas y Despoblación de Asignaturas
-- ==============================================================================

-- 1. ELIMINAR VISTA DEPENDIENTE (Permite liberar las columnas de profiles)
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- 2. ELIMINAR TABLAS DEL HUB DE PROYECTOS Y SUS RELACIONES
DROP TABLE IF EXISTS public.project_applications CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.project_positions CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- 3. ELIMINAR TABLAS AUXILIARES DE HABILIDADES E INTERESES DE PROYECTOS
DROP TABLE IF EXISTS public.profile_project_interests CASCADE;
DROP TABLE IF EXISTS public.project_interests CASCADE;
DROP TABLE IF EXISTS public.profile_skills CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;

-- 4. ELIMINAR COLUMNAS RESIDUALES DE PROYECTOS EN TABLA PROFILES
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS available_for_projects,
  DROP COLUMN IF EXISTS project_bio;

-- 5. RECREAR LA VISTA SEGURA public_profiles LIMPIA (Enfocada en Tutorías y Aprendizaje Adaptativo)
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
  p.learning_preferences,
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

-- 6. RESTAURAR PERMISOS DE LECTURA EN LA VISTA
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 7. DESPOBLAR ASIGNATURAS RESIDUALES (Idiomas, Formación General, Gestión y Negocios)
-- Desvincular de perfiles primero para evitar bloqueos por llave foránea:
DELETE FROM public.profile_offered_subjects
WHERE subject_id IN (
  SELECT id FROM public.subjects 
  WHERE category IN ('Idiomas', 'Formación General', 'Gestión y Negocios')
);

DELETE FROM public.profile_needed_subjects
WHERE subject_id IN (
  SELECT id FROM public.subjects 
  WHERE category IN ('Idiomas', 'Formación General', 'Gestión y Negocios')
);

DELETE FROM public.tutor_verification_requests
WHERE subject_id IN (
  SELECT id FROM public.subjects 
  WHERE category IN ('Idiomas', 'Formación General', 'Gestión y Negocios')
);

-- Despoblar de la tabla maestra subjects:
DELETE FROM public.subjects
WHERE category IN ('Idiomas', 'Formación General', 'Gestión y Negocios');
