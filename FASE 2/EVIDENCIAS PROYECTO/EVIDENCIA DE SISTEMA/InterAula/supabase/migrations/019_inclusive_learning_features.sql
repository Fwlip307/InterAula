-- ==============================================================================
-- MIGRACIÓN 019: FUNCIONALIDADES DE APRENDIZAJE INCLUSIVO, TEA, TDAH, DISLEXIA Y ACOMPAÑAMIENTO
-- Idempotente, transaccional y con políticas RLS estrictas.
-- ==============================================================================
BEGIN;

-- 1. Bandeja de ideas y dudas rápidas ("Ideas y dudas para después")
CREATE TABLE IF NOT EXISTS public.quick_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context_type text NOT NULL DEFAULT 'learning_space'
    CHECK (context_type IN ('learning_space', 'tutoring', 'workshop', 'general')),
  context_id text,
  content text NOT NULL CHECK (length(trim(content)) >= 2 AND length(content) <= 1000),
  resolved boolean NOT NULL DEFAULT false,
  converted_task_id uuid REFERENCES public.study_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_ideas_user_id ON public.quick_ideas(user_id, created_at DESC);

ALTER TABLE public.quick_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quick_ideas_owner_all ON public.quick_ideas;
CREATE POLICY quick_ideas_owner_all
  ON public.quick_ideas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Guion anticipado, previsualización de sesiones y material anticipado en tutorías y talleres
ALTER TABLE public.tutoring_sessions
  ADD COLUMN IF NOT EXISTS agenda_preview jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS camera_policy text NOT NULL DEFAULT 'optional'
    CHECK (camera_policy IN ('optional', 'recommended', 'required')),
  ADD COLUMN IF NOT EXISTS participation_mode text NOT NULL DEFAULT 'chat_or_voice'
    CHECK (participation_mode IN ('chat_only', 'chat_or_voice', 'voice_preferred')),
  ADD COLUMN IF NOT EXISTS participation_rules text NOT NULL DEFAULT 'Puedes participar por chat escrito o voz según tu comodidad. Las pausas están permitidas en cualquier momento.',
  ADD COLUMN IF NOT EXISTS anticipated_materials jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.tutoring_workshops
  ADD COLUMN IF NOT EXISTS agenda_preview jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS camera_policy text NOT NULL DEFAULT 'optional'
    CHECK (camera_policy IN ('optional', 'recommended', 'required')),
  ADD COLUMN IF NOT EXISTS participation_mode text NOT NULL DEFAULT 'chat_or_voice'
    CHECK (participation_mode IN ('chat_only', 'chat_or_voice', 'voice_preferred')),
  ADD COLUMN IF NOT EXISTS participation_rules text NOT NULL DEFAULT 'Puedes participar por chat escrito o voz según tu comodidad. No es obligatorio encender la cámara.',
  ADD COLUMN IF NOT EXISTS anticipated_materials jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Semáforo de comunicación en Aula Virtual (privado a la sala de la sesión/taller)
CREATE TABLE IF NOT EXISTS public.virtual_classroom_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal text NOT NULL CHECK (signal IN ('green', 'yellow', 'blue', 'red')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_classroom_user_signal UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_signals_room ON public.virtual_classroom_signals(room_id, updated_at DESC);

ALTER TABLE public.virtual_classroom_signals ENABLE ROW LEVEL SECURITY;

-- Función de pertenencia a sala virtual (sesión 1:1 o taller)
CREATE OR REPLACE FUNCTION public.can_access_classroom_room(p_room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tutoring_sessions ts
    WHERE (ts.id::text = p_room_id OR ('session-' || ts.id::text) = p_room_id)
      AND (ts.student_id = auth.uid() OR ts.tutor_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.tutoring_workshops tw
    WHERE tw.room_id = p_room_id
      AND (
        tw.tutor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workshop_enrollments we
          WHERE we.workshop_id = tw.id AND we.student_id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_classroom_room(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_classroom_room(text) TO authenticated, service_role;

DROP POLICY IF EXISTS classroom_signals_select ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_select
  ON public.virtual_classroom_signals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.can_access_classroom_room(room_id));

DROP POLICY IF EXISTS classroom_signals_insert ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_insert
  ON public.virtual_classroom_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_access_classroom_room(room_id));

DROP POLICY IF EXISTS classroom_signals_update ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_update
  ON public.virtual_classroom_signals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.can_access_classroom_room(room_id))
  WITH CHECK (auth.uid() = user_id AND public.can_access_classroom_room(room_id));

DROP POLICY IF EXISTS classroom_signals_delete ON public.virtual_classroom_signals;
CREATE POLICY classroom_signals_delete
  ON public.virtual_classroom_signals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Acreditación verificable de tutores con formación en acompañamiento inclusivo
CREATE TABLE IF NOT EXISTS public.inclusive_tutor_accreditations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  training_name text NOT NULL CHECK (length(trim(training_name)) >= 3 AND length(training_name) <= 200),
  evidence_notes text NOT NULL DEFAULT '',
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inclusive_accreditations_status ON public.inclusive_tutor_accreditations(status);

ALTER TABLE public.inclusive_tutor_accreditations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inclusive_accreditations_select ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_select
  ON public.inclusive_tutor_accreditations
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'
    OR tutor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.academic_validators av WHERE av.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS inclusive_accreditations_insert ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_insert
  ON public.inclusive_tutor_accreditations
  FOR INSERT
  TO authenticated
  WITH CHECK (tutor_id = auth.uid() AND status = 'pending' AND verified_by IS NULL);

DROP POLICY IF EXISTS inclusive_accreditations_validator_update ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_validator_update
  ON public.inclusive_tutor_accreditations
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academic_validators av WHERE av.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.academic_validators av WHERE av.profile_id = auth.uid()));

-- 5. Micro-entregables y roles claros en ProjectsHub
CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) >= 2 AND length(title) <= 200),
  description text NOT NULL DEFAULT '',
  expected_format text NOT NULL DEFAULT 'Documento o avance escrito',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed')),
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_deliverables_project_id ON public.project_deliverables(project_id, created_at ASC);

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_deliverables_select ON public.project_deliverables;
CREATE POLICY project_deliverables_select
  ON public.project_deliverables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deliverables.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS project_deliverables_write ON public.project_deliverables;
CREATE POLICY project_deliverables_write
  ON public.project_deliverables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deliverables.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deliverables.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
          )
        )
    )
  );

COMMIT;
