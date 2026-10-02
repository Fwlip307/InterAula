-- ==============================================================================
-- InterAula: Sprint 3 - Migración 008
-- Talleres y Clases Grupales en Vivo (Ayudantías Proactivas y Aulas Virtuales)
-- Compatible con 001 a 007
-- ==============================================================================

-- 1. TABLA: tutoring_workshops (Clases y Talleres Grupales organizados por tutores)
CREATE TABLE IF NOT EXISTS public.tutoring_workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 240),
  max_students integer NOT NULL DEFAULT 20 CHECK (max_students BETWEEN 2 AND 100),
  room_id text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workshops_tutor ON public.tutoring_workshops(tutor_id);
CREATE INDEX IF NOT EXISTS idx_workshops_subject ON public.tutoring_workshops(subject_id);
CREATE INDEX IF NOT EXISTS idx_workshops_scheduled_at ON public.tutoring_workshops(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_workshops_status ON public.tutoring_workshops(status);

-- 2. TABLA: workshop_enrollments (Inscripción de estudiantes a talleres)
CREATE TABLE IF NOT EXISTS public.workshop_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.tutoring_workshops(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  attended boolean NOT NULL DEFAULT false,
  attended_at timestamptz DEFAULT NULL,
  CONSTRAINT unique_workshop_student UNIQUE (workshop_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_workshop ON public.workshop_enrollments(workshop_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.workshop_enrollments(student_id);

-- 3. TRIGGER: Generación automática de identificador de sala virtual para el taller
CREATE OR REPLACE FUNCTION public.generate_workshop_room_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.room_id IS NULL OR trim(NEW.room_id) = '' THEN
    NEW.room_id := 'ia-taller-' || substr(replace(NEW.id::text, '-', ''), 1, 12);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_workshop_room_id ON public.tutoring_workshops;
CREATE TRIGGER trg_generate_workshop_room_id
  BEFORE INSERT ON public.tutoring_workshops
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_workshop_room_id();

-- 4. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tutoring_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_enrollments ENABLE ROW LEVEL SECURITY;

-- 4.1. RLS: tutoring_workshops
DROP POLICY IF EXISTS "Workshops are viewable by authenticated users" ON public.tutoring_workshops;
CREATE POLICY "Workshops are viewable by authenticated users"
  ON public.tutoring_workshops FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Tutors can create workshops" ON public.tutoring_workshops;
CREATE POLICY "Tutors can create workshops"
  ON public.tutoring_workshops FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = tutor_id);

DROP POLICY IF EXISTS "Tutors can update their own workshops" ON public.tutoring_workshops;
CREATE POLICY "Tutors can update their own workshops"
  ON public.tutoring_workshops FOR UPDATE
  TO authenticated
  USING (auth.uid() = tutor_id)
  WITH CHECK (auth.uid() = tutor_id);

DROP POLICY IF EXISTS "Tutors can delete their own scheduled workshops" ON public.tutoring_workshops;
CREATE POLICY "Tutors can delete their own scheduled workshops"
  ON public.tutoring_workshops FOR DELETE
  TO authenticated
  USING (auth.uid() = tutor_id AND status = 'scheduled');

-- 4.2. RLS: workshop_enrollments
DROP POLICY IF EXISTS "Enrollments viewable by workshop participants" ON public.workshop_enrollments;
CREATE POLICY "Enrollments viewable by workshop participants"
  ON public.workshop_enrollments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Students can enroll themselves" ON public.workshop_enrollments;
CREATE POLICY "Students can enroll themselves"
  ON public.workshop_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can unenroll themselves" ON public.workshop_enrollments;
CREATE POLICY "Students can unenroll themselves"
  ON public.workshop_enrollments FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Tutors and students can update attendance" ON public.workshop_enrollments;
CREATE POLICY "Tutors and students can update attendance"
  ON public.workshop_enrollments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id 
    OR EXISTS (
      SELECT 1 FROM public.tutoring_workshops w 
      WHERE w.id = workshop_id AND w.tutor_id = auth.uid()
    )
  );
