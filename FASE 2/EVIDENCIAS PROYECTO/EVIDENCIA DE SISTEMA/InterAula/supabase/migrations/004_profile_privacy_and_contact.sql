-- ==============================================================================
-- InterAula: Sprint 3 - Migración 004
-- Privacidad de Contacto y Vista de Perfiles Públicos
-- Compatible con 001_profiles_and_projects.sql, 002 y 003
-- ==============================================================================

-- 1. CAMPOS DE CONTACTO Y PRIVACIDAD EN PROFILES
-- Permite que los estudiantes configuren un teléfono de contacto opcional y
-- controlen explícitamente si su correo o teléfono son visibles públicamente.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false;

-- 2. VISTA SEGURA: public.public_profiles
-- Garantiza privacidad a nivel de base de datos: si show_email o show_phone son false,
-- PostgreSQL retorna NULL a terceros sin filtrar los datos a la capa cliente.
-- El propio usuario siempre puede ver sus propios datos cuando auth.uid() coincide.
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
  p.project_bio,
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

-- Otorgar permisos de lectura sobre la vista a usuarios autenticados y anónimos
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
