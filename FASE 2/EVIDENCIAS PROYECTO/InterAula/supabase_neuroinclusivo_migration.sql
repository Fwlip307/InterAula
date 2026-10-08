-- ==============================================================================
-- INTERAULA - SPRINT: INCLUSIÓN NEURODIVERSA, DUA Y APRENDIZAJE ADAPTATIVO
-- ==============================================================================
-- Este script agrega soporte en Supabase para:
-- 1. Pautas de Confort en Sesiones de Tutoría (sin diagnósticos ni etiquetas clínicas).
-- 2. Preferencias de Aprendizaje Inclusivas y Modo Calma en Perfiles.
-- 3. Historial de Micro-Quizzes Adaptativos por Intereses y Pasiones.
-- ==============================================================================

-- 1. Actualizar tabla 'profiles' para almacenar preferencias DUA y modo calma
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'learning_preferences'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN learning_preferences TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'interest_themes'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN interest_themes TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'calm_mode_enabled'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN calm_mode_enabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Actualizar tabla 'tutoring_sessions' para almacenar pautas de confort
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tutoring_sessions' AND column_name = 'comfort_preferences'
  ) THEN
    ALTER TABLE public.tutoring_sessions ADD COLUMN comfort_preferences TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 3. Crear tabla para registro de Quizzes Adaptativos
CREATE TABLE IF NOT EXISTS public.learning_adaptive_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  interest_theme TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.learning_adaptive_quizzes ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'learning_adaptive_quizzes' AND policyname = 'Usuarios pueden ver sus propios quizzes'
  ) THEN
    CREATE POLICY "Usuarios pueden ver sus propios quizzes"
      ON public.learning_adaptive_quizzes
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'learning_adaptive_quizzes' AND policyname = 'Usuarios pueden registrar quizzes'
  ) THEN
    CREATE POLICY "Usuarios pueden registrar quizzes"
      ON public.learning_adaptive_quizzes
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.learning_adaptive_quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON public.learning_adaptive_quizzes(subject);

COMMENT ON TABLE public.learning_adaptive_quizzes IS 'Historial de micro-quizzes de andamiaje cognitivo adaptados a los intereses del estudiante.';
