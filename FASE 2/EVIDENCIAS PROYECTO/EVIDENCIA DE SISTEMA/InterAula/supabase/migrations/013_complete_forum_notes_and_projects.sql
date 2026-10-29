-- ==============================================================================
-- InterAula: Migración 013 (100% Idempotente y Autónoma)
-- Evolución Completa: Foro Académico (votos únicos, tipos, edición, solución),
-- Biblioteca y Editor de Apuntes (academic_notes, versiones, archivos, visibilidad)
-- y Hub de Proyectos Académicos (roles/vacantes, acuerdos económicos, postulaciones, equipo).
-- ==============================================================================

-- ==============================================================================
-- 1. EVOLUCIÓN DEL FORO ACADÉMICO
-- ==============================================================================

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
  post_type text NOT NULL DEFAULT 'pregunta',
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  accepted_reply_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'pregunta',
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_reply_id uuid;

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  votes_count integer NOT NULL DEFAULT 0,
  is_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.forum_replies
  ADD COLUMN IF NOT EXISTS is_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS public.forum_post_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_forum_post_vote UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON public.forum_posts(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON public.forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON public.forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON public.forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author ON public.forum_replies(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_votes_post ON public.forum_post_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_votes_user ON public.forum_post_votes(user_id);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_post_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_posts_select" ON public.forum_posts;
CREATE POLICY "forum_posts_select"
  ON public.forum_posts FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "forum_posts_insert" ON public.forum_posts;
CREATE POLICY "forum_posts_insert"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_posts_update" ON public.forum_posts;
CREATE POLICY "forum_posts_update"
  ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_posts_delete" ON public.forum_posts;
CREATE POLICY "forum_posts_delete"
  ON public.forum_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_replies_select" ON public.forum_replies;
CREATE POLICY "forum_replies_select"
  ON public.forum_replies FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "forum_replies_insert" ON public.forum_replies;
CREATE POLICY "forum_replies_insert"
  ON public.forum_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Permitir al autor de la respuesta editarla o al autor de la pregunta marcarla como solución aceptada
DROP POLICY IF EXISTS "forum_replies_update" ON public.forum_replies;
CREATE POLICY "forum_replies_update"
  ON public.forum_replies FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.forum_posts fp
      WHERE fp.id = forum_replies.post_id AND fp.author_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.forum_posts fp
      WHERE fp.id = forum_replies.post_id AND fp.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forum_replies_delete" ON public.forum_replies;
CREATE POLICY "forum_replies_delete"
  ON public.forum_replies FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "forum_post_votes_select" ON public.forum_post_votes;
CREATE POLICY "forum_post_votes_select"
  ON public.forum_post_votes FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "forum_post_votes_insert" ON public.forum_post_votes;
CREATE POLICY "forum_post_votes_insert"
  ON public.forum_post_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_post_votes_delete" ON public.forum_post_votes;
CREATE POLICY "forum_post_votes_delete"
  ON public.forum_post_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 2. BIBLIOTECA Y EDITOR INTEGRADO DE APUNTES ACADÉMICOS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.academic_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name text DEFAULT 'General',
  career text DEFAULT 'Ingeniería y Tecnología',
  category text NOT NULL DEFAULT 'Apunte',
  folder text DEFAULT 'General',
  title text NOT NULL,
  summary text DEFAULT '',
  content_html text DEFAULT '',
  content_markdown text DEFAULT '',
  content_json jsonb DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'editor', -- 'editor' | 'upload'
  file_url text,
  file_name text,
  file_mime text,
  file_size integer DEFAULT 0,
  file_extension text,
  tags text[] DEFAULT '{}'::text[],
  visibility text NOT NULL DEFAULT 'public', -- 'private' | 'shared' | 'public'
  is_draft boolean NOT NULL DEFAULT false,
  downloads_count integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_academic_note_title CHECK (length(trim(title)) >= 2),
  CONSTRAINT check_academic_note_visibility CHECK (visibility IN ('private', 'shared', 'public'))
);

CREATE INDEX IF NOT EXISTS idx_academic_notes_author ON public.academic_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_academic_notes_subject ON public.academic_notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_academic_notes_visibility ON public.academic_notes(visibility, is_draft);
CREATE INDEX IF NOT EXISTS idx_academic_notes_updated ON public.academic_notes(updated_at DESC);

ALTER TABLE public.academic_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academic_notes_select" ON public.academic_notes;
CREATE POLICY "academic_notes_select"
  ON public.academic_notes FOR SELECT
  TO authenticated, anon
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR (
      is_draft = false
      AND (
        visibility = 'public'
        OR (visibility = 'shared' AND auth.uid() IS NOT NULL)
      )
    )
  );

DROP POLICY IF EXISTS "academic_notes_insert" ON public.academic_notes;
CREATE POLICY "academic_notes_insert"
  ON public.academic_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "academic_notes_update" ON public.academic_notes;
CREATE POLICY "academic_notes_update"
  ON public.academic_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "academic_notes_delete" ON public.academic_notes;
CREATE POLICY "academic_notes_delete"
  ON public.academic_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Bucket de almacenamiento para archivos de apuntes subidos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('academic-notes', 'academic-notes', true, 15728640)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "academic_notes_storage_select" ON storage.objects;
CREATE POLICY "academic_notes_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'academic-notes');

DROP POLICY IF EXISTS "academic_notes_storage_insert" ON storage.objects;
CREATE POLICY "academic_notes_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'academic-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "academic_notes_storage_update" ON storage.objects;
CREATE POLICY "academic_notes_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'academic-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'academic-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "academic_notes_storage_delete" ON storage.objects;
CREATE POLICY "academic_notes_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'academic-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==============================================================================
-- 3. HUB DE PROYECTOS ACADÉMICOS Y COLABORATIVOS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  short_description text,
  description text,
  problem_statement text,
  objectives text,
  category text DEFAULT 'Desarrollo de Software',
  career text DEFAULT 'Ingeniería en Informática',
  technologies text[] DEFAULT '{}'::text[],
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'open', -- 'draft' | 'open' | 'recruiting' | 'in_progress' | 'completed' | 'cancelled'
  visibility text NOT NULL DEFAULT 'public', -- 'public' | 'private'
  modality text NOT NULL DEFAULT 'online', -- 'online' | 'presencial' | 'hibrido'
  dedication_hours integer DEFAULT 6,
  max_members integer NOT NULL DEFAULT 4,
  requirements text,
  compensation_type text NOT NULL DEFAULT 'unpaid_academic', -- 'unpaid_academic' | 'paid' | 'milestone_based' | 'revenue_share' | 'negotiable'
  compensation_amount numeric,
  compensation_currency text DEFAULT 'CLP',
  compensation_periodicity text, -- 'unico' | 'mensual' | 'por_hito' | 'por_hora'
  compensation_notes text,
  agreements jsonb DEFAULT '{}'::jsonb,
  external_links jsonb DEFAULT '{}'::jsonb,
  milestones jsonb DEFAULT '[]'::jsonb,
  cover_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Garantizar que todas las columnas nuevas existan si la tabla projects ya había sido creada previamente
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS problem_statement text,
  ADD COLUMN IF NOT EXISTS objectives text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Desarrollo de Software',
  ADD COLUMN IF NOT EXISTS career text DEFAULT 'Ingeniería en Informática',
  ADD COLUMN IF NOT EXISTS technologies text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS dedication_hours integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS compensation_type text NOT NULL DEFAULT 'unpaid_academic',
  ADD COLUMN IF NOT EXISTS compensation_amount numeric,
  ADD COLUMN IF NOT EXISTS compensation_currency text DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS compensation_periodicity text,
  ADD COLUMN IF NOT EXISTS compensation_notes text,
  ADD COLUMN IF NOT EXISTS agreements jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS milestones jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text;

CREATE TABLE IF NOT EXISTS public.project_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  skill_id uuid,
  skills_required text[] DEFAULT '{}'::text[],
  mandatory_requirements text[] DEFAULT '{}'::text[],
  optional_requirements text[] DEFAULT '{}'::text[],
  level_required text DEFAULT 'intermediate',
  dedication_hours integer DEFAULT 6,
  slots integer NOT NULL DEFAULT 1,
  slots_filled integer NOT NULL DEFAULT 0,
  compensation_override text,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'paused' | 'filled' | 'closed'
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.project_positions
  ADD COLUMN IF NOT EXISTS skill_id uuid,
  ADD COLUMN IF NOT EXISTS skills_required text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS mandatory_requirements text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS optional_requirements text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS level_required text DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS dedication_hours integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS slots integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS slots_filled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compensation_override text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

CREATE TABLE IF NOT EXISTS public.project_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  relevant_skills text[] DEFAULT '{}'::text[],
  portfolio_url text,
  availability_notes text,
  accepted_agreements boolean NOT NULL DEFAULT false,
  accepted_agreements_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  reviewer_feedback text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_project_position_applicant UNIQUE (position_id, applicant_id)
);

ALTER TABLE public.project_applications
  ADD COLUMN IF NOT EXISTS relevant_skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS availability_notes text,
  ADD COLUMN IF NOT EXISTS accepted_agreements boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_agreements_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_feedback text;

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.project_positions(id) ON DELETE SET NULL,
  role_name text DEFAULT 'Miembro',
  member_role text NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  joined_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_project_member UNIQUE (project_id, profile_id)
);

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.project_positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_name text DEFAULT 'Miembro',
  ADD COLUMN IF NOT EXISTS member_role text NOT NULL DEFAULT 'member';

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status, visibility);
CREATE INDEX IF NOT EXISTS idx_project_positions_project ON public.project_positions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_applications_project ON public.project_applications(project_id);
CREATE INDEX IF NOT EXISTS idx_project_applications_applicant ON public.project_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Políticas para projects
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated, anon
  USING (
    (visibility = 'public' AND status <> 'draft')
    OR (auth.uid() IS NOT NULL AND auth.uid() = owner_id)
  );

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete"
  ON public.projects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Políticas para project_positions
DROP POLICY IF EXISTS "project_positions_select" ON public.project_positions;
CREATE POLICY "project_positions_select"
  ON public.project_positions FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "project_positions_manage" ON public.project_positions;
CREATE POLICY "project_positions_manage"
  ON public.project_positions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_positions.project_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_positions.project_id AND p.owner_id = auth.uid()
    )
  );

-- Políticas para project_applications
DROP POLICY IF EXISTS "project_applications_select" ON public.project_applications;
CREATE POLICY "project_applications_select"
  ON public.project_applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_applications_insert" ON public.project_applications;
CREATE POLICY "project_applications_insert"
  ON public.project_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id
    AND accepted_agreements = true
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_applications_update" ON public.project_applications;
CREATE POLICY "project_applications_update"
  ON public.project_applications FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id AND p.owner_id = auth.uid()
    )
  );

-- Políticas para project_members
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select"
  ON public.project_members FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "project_members_manage" ON public.project_members;
CREATE POLICY "project_members_manage"
  ON public.project_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
  );
