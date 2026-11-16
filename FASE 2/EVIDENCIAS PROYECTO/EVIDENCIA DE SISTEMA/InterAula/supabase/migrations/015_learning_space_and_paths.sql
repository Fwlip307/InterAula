-- ==============================================================================
-- MIGRACIÓN 015: MI ESPACIO DE APRENDIZAJE, RUTAS ADAPTATIVAS, TAREAS Y REFUERZO
-- Compatible e idempotente con el esquema existente de InterAula
-- ==============================================================================

-- 1. Asegurar columna de configuración estructurada del espacio de aprendizaje en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_space_config jsonb NOT NULL DEFAULT '{
    "onboardingCompleted": false,
    "shareWithTutors": false,
    "explanationStyle": ["step_by_step", "practical_examples"],
    "organizationStyle": ["short_tasks", "frequent_breaks"],
    "communicationStyle": ["message_first", "individual_tutoring"],
    "environmentStyle": ["calm_interface", "untimed_practice"],
    "defaultStudyIntervalMinutes": 20,
    "defaultBreakMinutes": 5,
    "subjectsToReinforce": [],
    "learningGoalSummary": ""
  }'::jsonb;

-- 2. Tabla de Rutas de Aprendizaje Personalizadas (learning_paths)
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id text,
  subject_name text NOT NULL,
  title text NOT NULL,
  goal text NOT NULL,
  pace text NOT NULL DEFAULT 'paso_a_paso' CHECK (pace IN ('paso_a_paso', 'constante', 'intensivo')),
  preferred_mode text NOT NULL DEFAULT 'sencilla' CHECK (preferred_mode IN ('sencilla', 'paso_a_paso', 'ejemplos', 'visual', 'profunda', 'comprobar')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON public.learning_paths(user_id);

-- 3. Tabla de Etapas de una Ruta de Aprendizaje (learning_path_stages)
CREATE TABLE IF NOT EXISTS public.learning_path_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content_topic text NOT NULL DEFAULT '',
  practice_prompt text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_path_stages_path_id ON public.learning_path_stages(path_id, order_index);

-- 4. Tabla de Tareas de Estudio y Subtareas con Intervalos Personalizables (study_tasks)
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_name text NOT NULL DEFAULT 'General',
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed')),
  study_interval_minutes integer NOT NULL DEFAULT 20 CHECK (study_interval_minutes >= 5 AND study_interval_minutes <= 180),
  break_minutes integer NOT NULL DEFAULT 5 CHECK (break_minutes >= 1 AND break_minutes <= 60),
  subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta'));

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_id ON public.study_tasks(user_id);

-- 5. Tabla de Evaluación de Conocimientos y Dominio por Tema (topic_assessments)
CREATE TABLE IF NOT EXISTS public.topic_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  topic_name text NOT NULL,
  mastery_level text NOT NULL DEFAULT 'pendiente' CHECK (mastery_level IN ('consolidado', 'en_desarrollo', 'necesita_practicar', 'pendiente')),
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  recurring_errors text[] NOT NULL DEFAULT '{}',
  last_practiced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_assessments_user_id ON public.topic_assessments(user_id);

-- 6. Seguridad de Nivel de Fila (RLS) — Acceso estricto al propietario (Privacidad Total)
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "learning_paths_owner_all" ON public.learning_paths;
CREATE POLICY "learning_paths_owner_all"
  ON public.learning_paths
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "learning_path_stages_owner_all" ON public.learning_path_stages;
CREATE POLICY "learning_path_stages_owner_all"
  ON public.learning_path_stages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.id = learning_path_stages.path_id
        AND lp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.id = learning_path_stages.path_id
        AND lp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "study_tasks_owner_all" ON public.study_tasks;
CREATE POLICY "study_tasks_owner_all"
  ON public.study_tasks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "topic_assessments_owner_all" ON public.topic_assessments;
CREATE POLICY "topic_assessments_owner_all"
  ON public.topic_assessments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

