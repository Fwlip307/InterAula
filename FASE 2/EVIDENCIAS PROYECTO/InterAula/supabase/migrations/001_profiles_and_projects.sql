-- ==============================================================================
-- InterAula: Sprint 1 - Migración de Base de Datos (Revisada y Segura)
-- Módulo de Perfiles Híbridos y Arquitectura Base para Hub de Proyectos
-- ==============================================================================

-- 1. TABLA: profiles (1:1 con auth.users, cuenta híbrida sin roles restrictivos)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  institution text,
  career text,
  bio text,
  location text,
  profile_completed boolean DEFAULT false NOT NULL,
  available_for_tutoring boolean DEFAULT true NOT NULL,
  available_for_projects boolean DEFAULT true NOT NULL,
  project_bio text,
  portfolio_url text,
  github_url text,
  linkedin_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tutoring ON public.profiles(available_for_tutoring) WHERE available_for_tutoring = true;
CREATE INDEX IF NOT EXISTS idx_profiles_projects ON public.profiles(available_for_projects) WHERE available_for_projects = true;

-- 2. TABLA: subjects (Catálogo de materias académicas)
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_subjects_name_length CHECK (length(trim(name)) >= 2)
);

-- 3. TABLA: profile_offered_subjects (Materias que el usuario enseña / ofrece)
CREATE TABLE IF NOT EXISTS public.profile_offered_subjects (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('basic', 'intermediate', 'advanced')),
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_offered_subjects_subject ON public.profile_offered_subjects(subject_id);

-- 4. TABLA: profile_needed_subjects (Materias en las que el usuario necesita ayuda)
CREATE TABLE IF NOT EXISTS public.profile_needed_subjects (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  current_level text CHECK (current_level IN ('basic', 'intermediate', 'advanced')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_needed_subjects_subject ON public.profile_needed_subjects(subject_id);

-- 5. TABLAS: skills y profile_skills (Habilidades para proyectos colaborativos)
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_skills_name_length CHECK (length(trim(name)) >= 2)
);

CREATE TABLE IF NOT EXISTS public.profile_skills (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('basic', 'intermediate', 'advanced')),
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_skills_skill ON public.profile_skills(skill_id);

-- 6. TABLAS: project_interests y profile_project_interests (Áreas de interés)
CREATE TABLE IF NOT EXISTS public.project_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_interests_name_length CHECK (length(trim(name)) >= 2)
);

CREATE TABLE IF NOT EXISTS public.profile_project_interests (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES public.project_interests(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, interest_id)
);

-- ==============================================================================
-- 7. TABLAS BASE DEL HUB DE PROYECTOS
-- ==============================================================================

-- 7.1 projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  short_description text,
  description text,
  category text,
  status text NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'in_progress', 'completed', 'cancelled')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  max_members integer DEFAULT 5 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_projects_max_members CHECK (max_members > 0),
  CONSTRAINT check_projects_title_length CHECK (length(trim(title)) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON public.projects(visibility);

-- 7.2 project_positions (Vacantes por proyecto)
CREATE TABLE IF NOT EXISTS public.project_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  level_required text CHECK (level_required IN ('basic', 'intermediate', 'advanced')),
  slots integer DEFAULT 1 NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT check_project_positions_slots CHECK (slots > 0),
  CONSTRAINT check_project_positions_title_length CHECK (length(trim(title)) >= 2),
  CONSTRAINT uq_project_positions_id_project UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_positions_project ON public.project_positions(project_id);

-- 7.3 project_members (Miembros del proyecto)
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.project_positions(id) ON DELETE SET NULL,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_profile ON public.project_members(profile_id);

-- 7.4 project_applications (Postulaciones a vacantes de proyectos)
CREATE TABLE IF NOT EXISTS public.project_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_id uuid NOT NULL,
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- Integridad compuesta: position_id debe ser forzosamente de project_id
  CONSTRAINT fk_project_applications_position_project
    FOREIGN KEY (position_id, project_id)
    REFERENCES public.project_positions(id, project_id)
    ON DELETE CASCADE
);

-- Prevenir postulaciones duplicadas en estado 'pending' a una misma vacante
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_app 
  ON public.project_applications(position_id, applicant_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_project_applications_applicant ON public.project_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_project_applications_project ON public.project_applications(project_id);

-- ==============================================================================
-- 8. FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER)
-- ==============================================================================

-- 8.1 Función segura para verificar si un usuario puede ver un proyecto (público, owner o miembro)
-- Al ser SECURITY DEFINER evita recursión infinita en las políticas RLS.
-- Utiliza auth.uid() internamente para evitar que el frontend pase UUIDs arbitrarios.
DROP FUNCTION IF EXISTS public.can_view_project(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id 
      AND (
        p.visibility = 'public' 
        OR p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm 
          WHERE pm.project_id = p.id AND pm.profile_id = auth.uid()
        )
      )
  );
$$;

-- Seguridad: revocar ejecución a PUBLIC y conceder solo a authenticated y service_role
REVOKE EXECUTE ON FUNCTION public.can_view_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO service_role;

-- Función genérica para mantener updated_at actualizado
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers de updated_at
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_project_applications_updated_at ON public.project_applications;
CREATE TRIGGER set_project_applications_updated_at
  BEFORE UPDATE ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 9. TRIGGERS DE NEGOCIO Y CONTROL DE INTEGRIDAD
-- ==============================================================================

-- 9.1 Control de member_role y validación de vacante en project_members
CREATE OR REPLACE FUNCTION public.check_project_member_role_and_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.projects WHERE id = NEW.project_id;

  IF NEW.member_role = 'owner' AND NEW.profile_id <> v_owner_id THEN
    RAISE EXCEPTION 'Solo el propietario original indicado en projects.owner_id puede tener el rol de owner.';
  END IF;

  IF NEW.member_role <> 'owner' AND NEW.profile_id = v_owner_id THEN
    RAISE EXCEPTION 'El propietario del proyecto debe mantener el rol de owner.';
  END IF;

  -- Validar que position_id pertenezca al mismo project_id si está asignada
  IF NEW.position_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_positions
      WHERE id = NEW.position_id AND project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'La vacante asignada (%) no pertenece al proyecto (%).', NEW.position_id, NEW.project_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_project_member_role ON public.project_members;
DROP TRIGGER IF EXISTS trg_check_project_member_role_and_position ON public.project_members;
CREATE TRIGGER trg_check_project_member_role_and_position
  BEFORE INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.check_project_member_role_and_position();

-- 9.2 Protección de la membresía del owner ante eliminaciones
-- El owner nunca puede ser eliminado de project_members excepto cuando se borra el proyecto completo
CREATE OR REPLACE FUNCTION public.handle_project_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.deleting_project_id', OLD.id::text, true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_before_delete ON public.projects;
CREATE TRIGGER trg_project_before_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_before_delete();

CREATE OR REPLACE FUNCTION public.check_project_member_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el integrante a eliminar es el owner
  IF OLD.member_role = 'owner' THEN
    -- Solo se permite si se está eliminando el proyecto completo en cascada
    IF current_setting('app.deleting_project_id', true) IS DISTINCT FROM OLD.project_id::text THEN
      RAISE EXCEPTION 'No está permitido eliminar la membresía del propietario del proyecto mientras el proyecto siga existiendo.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_project_member_delete ON public.project_members;
CREATE TRIGGER trg_check_project_member_delete
  BEFORE DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.check_project_member_delete();

-- 9.3 Validación estricta al crear postulaciones
CREATE OR REPLACE FUNCTION public.validate_new_project_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_status text;
  v_project_visibility text;
  v_project_owner uuid;
  v_position_status text;
  v_position_slots integer;
  v_current_pos_members integer;
BEGIN
  -- Verificar existencia, estado y visibilidad del proyecto
  SELECT status, visibility, owner_id 
  INTO v_project_status, v_project_visibility, v_project_owner
  FROM public.projects
  WHERE id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proyecto especificado no existe.';
  END IF;

  -- Requisito 6: Prohibir postulación a proyectos privados
  IF v_project_visibility <> 'public' THEN
    RAISE EXCEPTION 'No está permitido postular a proyectos privados.';
  END IF;

  IF v_project_status <> 'recruiting' THEN
    RAISE EXCEPTION 'No se puede postular a un proyecto que no esté en estado recruiting (actual: %).', v_project_status;
  END IF;

  IF v_project_owner = NEW.applicant_id THEN
    RAISE EXCEPTION 'El propietario del proyecto no puede postular a sus propias vacantes.';
  END IF;

  -- Verificar estado de la vacante y pertenencia al proyecto
  SELECT status, slots INTO v_position_status, v_position_slots
  FROM public.project_positions
  WHERE id = NEW.position_id AND project_id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La vacante seleccionada no pertenece al proyecto indicado.';
  END IF;

  IF v_position_status <> 'open' THEN
    RAISE EXCEPTION 'La vacante no se encuentra abierta para postulaciones.';
  END IF;

  -- Verificar cupos de la vacante
  SELECT count(*) INTO v_current_pos_members
  FROM public.project_members
  WHERE project_id = NEW.project_id AND position_id = NEW.position_id;

  IF v_current_pos_members >= v_position_slots THEN
    RAISE EXCEPTION 'La vacante ya no cuenta con cupos disponibles.';
  END IF;

  -- Verificar que el postulante no sea ya miembro del proyecto
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = NEW.project_id AND profile_id = NEW.applicant_id
  ) THEN
    RAISE EXCEPTION 'Ya formas parte del equipo de este proyecto.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_new_project_application ON public.project_applications;
CREATE TRIGGER trg_validate_new_project_application
  BEFORE INSERT ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.validate_new_project_application();

-- 9.4 Control de actualización de postulaciones (inmutabilidad de mensaje y verificación de cupos)
CREATE OR REPLACE FUNCTION public.check_project_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_max_members integer;
  v_current_members integer;
  v_position_slots integer;
  v_position_status text;
  v_current_pos_members integer;
BEGIN
  -- Inmutabilidad de campos sensibles (Requisito 4)
  IF NEW.applicant_id <> OLD.applicant_id THEN
    RAISE EXCEPTION 'No está permitido modificar el applicant_id de la postulación.';
  END IF;
  IF NEW.project_id <> OLD.project_id THEN
    RAISE EXCEPTION 'No está permitido modificar el project_id de la postulación.';
  END IF;
  IF NEW.position_id <> OLD.position_id THEN
    RAISE EXCEPTION 'No está permitido modificar el position_id de la postulación.';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'No está permitido modificar el mensaje de la postulación una vez enviada.';
  END IF;

  -- No permitir transiciones posteriores desde estados finales (Requisito 4)
  IF OLD.status IN ('accepted', 'rejected', 'withdrawn') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'La postulación ya se encuentra en estado final (%) y no puede ser modificada.', OLD.status;
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.projects WHERE id = OLD.project_id;

  -- Caso A: El postulante actualiza (solo pending -> withdrawn)
  IF auth.uid() = OLD.applicant_id THEN
    IF NEW.status NOT IN ('pending', 'withdrawn') THEN
      RAISE EXCEPTION 'El postulante solo tiene autorización para cambiar el estado a withdrawn.';
    END IF;

  -- Caso B: El dueño del proyecto actualiza (solo pending -> accepted o rejected)
  ELSIF auth.uid() = v_owner_id THEN
    IF NEW.status NOT IN ('pending', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'El propietario del proyecto solo puede cambiar el estado a accepted o rejected.';
    END IF;

    -- Lógica segura al aceptar postulación: verificación de cupos y límites (Requisito 5)
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      -- 1. Verificar max_members del proyecto
      SELECT max_members INTO v_max_members FROM public.projects WHERE id = OLD.project_id;
      SELECT count(*) INTO v_current_members FROM public.project_members WHERE project_id = OLD.project_id;

      IF v_current_members >= v_max_members THEN
        RAISE EXCEPTION 'No se puede aceptar la postulación: el proyecto ha alcanzado el límite máximo de miembros permitidos (%).', v_max_members;
      END IF;

      -- 2. Verificar slots de la vacante
      SELECT slots, status INTO v_position_slots, v_position_status
      FROM public.project_positions
      WHERE id = OLD.position_id;

      IF v_position_status <> 'open' THEN
        RAISE EXCEPTION 'No se puede aceptar la postulación: la vacante ya está cerrada.';
      END IF;

      SELECT count(*) INTO v_current_pos_members
      FROM public.project_members
      WHERE project_id = OLD.project_id AND position_id = OLD.position_id;

      IF v_current_pos_members >= v_position_slots THEN
        RAISE EXCEPTION 'No se puede aceptar la postulación: la vacante ya no cuenta con cupos disponibles (% de % ocupados).', v_current_pos_members, v_position_slots;
      END IF;

      -- 3. Incorporar al postulante en project_members
      INSERT INTO public.project_members (project_id, profile_id, position_id, member_role)
      VALUES (OLD.project_id, OLD.applicant_id, OLD.position_id, 'member')
      ON CONFLICT (project_id, profile_id) DO UPDATE SET
        position_id = EXCLUDED.position_id;

      -- 4. Si se ocupa el último cupo, cerrar la vacante automáticamente
      IF (v_current_pos_members + 1) >= v_position_slots THEN
        UPDATE public.project_positions
        SET status = 'closed'
        WHERE id = OLD.position_id;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'No tienes autorización para modificar esta postulación.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_project_application_update ON public.project_applications;
CREATE TRIGGER trg_check_project_application_update
  BEFORE UPDATE ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.check_project_application_update();

-- 9.4 Creación automática de perfil para registros futuros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_display_name text;
  v_avatar_url text;
  v_full_name text;
BEGIN
  v_full_name := coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  v_first_name := coalesce(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    split_part(v_full_name, ' ', 1),
    ''
  );

  v_last_name := coalesce(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    substring(v_full_name from position(' ' in v_full_name) + 1),
    ''
  );

  IF v_last_name = v_first_name THEN
    v_last_name := '';
  END IF;

  v_display_name := coalesce(
    nullif(trim(v_full_name), ''),
    nullif(trim(NEW.raw_user_meta_data->>'user_name'), ''),
    split_part(coalesce(NEW.email, ''), '@', 1),
    'Estudiante InterAula'
  );

  v_avatar_url := coalesce(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    avatar_url,
    profile_completed,
    available_for_tutoring,
    available_for_projects
  )
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    nullif(trim(v_first_name), ''),
    nullif(trim(v_last_name), ''),
    v_display_name,
    nullif(trim(v_avatar_url), ''),
    false,
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = coalesce(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'InterAula: Error en handle_new_user para usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9.5 Agregar automáticamente al creador de un proyecto como miembro 'owner'
CREATE OR REPLACE FUNCTION public.handle_new_project_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, profile_id, member_role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, profile_id) DO UPDATE SET
    member_role = 'owner';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created_add_owner ON public.projects;
CREATE TRIGGER on_project_created_add_owner
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project_owner_member();

-- ==============================================================================
-- 10. POLÍTICAS ROW LEVEL SECURITY (RLS) - 100% IDEMPOTENTES
-- ==============================================================================

-- 10.1 profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 10.2 subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects_select_authenticated" ON public.subjects;
CREATE POLICY "subjects_select_authenticated"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (true);

-- 10.3 profile_offered_subjects
ALTER TABLE public.profile_offered_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offered_subjects_select" ON public.profile_offered_subjects;
CREATE POLICY "offered_subjects_select"
  ON public.profile_offered_subjects FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "offered_subjects_insert_own" ON public.profile_offered_subjects;
CREATE POLICY "offered_subjects_insert_own"
  ON public.profile_offered_subjects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "offered_subjects_update_own" ON public.profile_offered_subjects;
CREATE POLICY "offered_subjects_update_own"
  ON public.profile_offered_subjects FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "offered_subjects_delete_own" ON public.profile_offered_subjects;
CREATE POLICY "offered_subjects_delete_own"
  ON public.profile_offered_subjects FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- 10.4 profile_needed_subjects
ALTER TABLE public.profile_needed_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "needed_subjects_select" ON public.profile_needed_subjects;
CREATE POLICY "needed_subjects_select"
  ON public.profile_needed_subjects FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "needed_subjects_insert_own" ON public.profile_needed_subjects;
CREATE POLICY "needed_subjects_insert_own"
  ON public.profile_needed_subjects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "needed_subjects_update_own" ON public.profile_needed_subjects;
CREATE POLICY "needed_subjects_update_own"
  ON public.profile_needed_subjects FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "needed_subjects_delete_own" ON public.profile_needed_subjects;
CREATE POLICY "needed_subjects_delete_own"
  ON public.profile_needed_subjects FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- 10.5 skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_select_authenticated" ON public.skills;
CREATE POLICY "skills_select_authenticated"
  ON public.skills FOR SELECT
  TO authenticated
  USING (true);

-- 10.6 profile_skills
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_skills_select" ON public.profile_skills;
CREATE POLICY "profile_skills_select"
  ON public.profile_skills FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profile_skills_insert_own" ON public.profile_skills;
CREATE POLICY "profile_skills_insert_own"
  ON public.profile_skills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_skills_update_own" ON public.profile_skills;
CREATE POLICY "profile_skills_update_own"
  ON public.profile_skills FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_skills_delete_own" ON public.profile_skills;
CREATE POLICY "profile_skills_delete_own"
  ON public.profile_skills FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- 10.7 project_interests
ALTER TABLE public.project_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interests_select_authenticated" ON public.project_interests;
CREATE POLICY "interests_select_authenticated"
  ON public.project_interests FOR SELECT
  TO authenticated
  USING (true);

-- 10.8 profile_project_interests
ALTER TABLE public.profile_project_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_interests_select" ON public.profile_project_interests;
CREATE POLICY "profile_interests_select"
  ON public.profile_project_interests FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profile_interests_insert_own" ON public.profile_project_interests;
CREATE POLICY "profile_interests_insert_own"
  ON public.profile_project_interests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_interests_delete_own" ON public.profile_project_interests;
CREATE POLICY "profile_interests_delete_own"
  ON public.profile_project_interests FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- 10.9 projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    visibility = 'public' 
    OR auth.uid() = owner_id 
    OR public.can_view_project(id)
  );

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 10.10 project_positions
ALTER TABLE public.project_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "positions_select" ON public.project_positions;
CREATE POLICY "positions_select"
  ON public.project_positions FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS "positions_insert_project_owner" ON public.project_positions;
CREATE POLICY "positions_insert_project_owner"
  ON public.project_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_positions.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "positions_update_project_owner" ON public.project_positions;
CREATE POLICY "positions_update_project_owner"
  ON public.project_positions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_positions.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "positions_delete_project_owner" ON public.project_positions;
CREATE POLICY "positions_delete_project_owner"
  ON public.project_positions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_positions.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- 10.11 project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select" ON public.project_members;
CREATE POLICY "members_select"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id));

-- Solo el propietario puede incorporar miembros directamente
-- (o el trigger seguro al aceptar una postulación)
-- Se elimina expresamente la posibilidad de auto-unirse
DROP POLICY IF EXISTS "members_insert_project_owner_or_self" ON public.project_members;
DROP POLICY IF EXISTS "members_insert_project_owner" ON public.project_members;
CREATE POLICY "members_insert_project_owner"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- Eliminación de miembros:
-- 1. El owner NUNCA puede ser eliminado mediante DELETE (ni por sí mismo ni por otros).
-- 2. El owner puede remover a integrantes regulares.
-- 3. Un integrante regular puede retirarse voluntariamente.
DROP POLICY IF EXISTS "members_delete_project_owner" ON public.project_members;
DROP POLICY IF EXISTS "members_delete" ON public.project_members;
CREATE POLICY "members_delete"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    member_role <> 'owner'
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
          AND p.owner_id = auth.uid()
      )
      OR auth.uid() = profile_id
    )
  );

-- 10.12 project_applications
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select" ON public.project_applications;
CREATE POLICY "applications_select"
  ON public.project_applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- Postulante solo puede insertar su propia postulación en estado 'pending'
-- y exclusivamente en proyectos públicos y en estado 'recruiting' (Requisito 6)
DROP POLICY IF EXISTS "applications_insert_applicant" ON public.project_applications;
CREATE POLICY "applications_insert_applicant"
  ON public.project_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id 
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id
        AND p.visibility = 'public'
        AND p.status = 'recruiting'
    )
  );

-- El postulante puede cambiar a 'withdrawn' y el dueño a 'accepted' o 'rejected'
-- (Validado estrictamente por el trigger check_project_application_update)
DROP POLICY IF EXISTS "applications_update_applicant_or_owner" ON public.project_applications;
DROP POLICY IF EXISTS "applications_update" ON public.project_applications;
CREATE POLICY "applications_update"
  ON public.project_applications FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_applications.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- ==============================================================================
-- 11. BACKFILL: PERFILES PARA USUARIOS PREVIOS EN auth.users
-- ==============================================================================

INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  display_name,
  avatar_url,
  profile_completed,
  available_for_tutoring,
  available_for_projects
)
SELECT
  u.id,
  coalesce(u.email, ''),
  nullif(trim(coalesce(
    u.raw_user_meta_data->>'first_name',
    u.raw_user_meta_data->>'given_name',
    split_part(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ' ', 1)
  )), ''),
  nullif(trim(coalesce(
    u.raw_user_meta_data->>'last_name',
    u.raw_user_meta_data->>'family_name',
    case 
      when position(' ' in coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) > 0 
      then substring(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '') from position(' ' in coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) + 1)
      else ''
    end
  )), ''),
  coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ''),
    nullif(trim(u.raw_user_meta_data->>'user_name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Estudiante InterAula'
  ),
  nullif(trim(coalesce(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    ''
  )), ''),
  false,
  true,
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 12. DATOS INICIALES (SEED DATA) DE CATÁLOGOS
-- ==============================================================================

-- Materias Académicas
INSERT INTO public.subjects (name, category)
VALUES
  ('Programación', 'Tecnología e Informática'),
  ('Bases de Datos', 'Tecnología e Informática'),
  ('Desarrollo Web', 'Tecnología e Informática'),
  ('Matemáticas', 'Ciencias Básicas'),
  ('Cálculo', 'Ciencias Básicas'),
  ('Estadística', 'Ciencias Básicas'),
  ('Inglés', 'Idiomas'),
  ('Gestión de Proyectos', 'Gestión y Negocios'),
  ('Redes', 'Infraestructura y Redes'),
  ('Ciberseguridad', 'Seguridad de la Información'),
  ('Machine Learning', 'Inteligencia Artificial'),
  ('Física', 'Ciencias Básicas'),
  ('Álgebra Lineal', 'Ciencias Básicas'),
  ('Arquitectura de Software', 'Tecnología e Informática')
ON CONFLICT (name) DO NOTHING;

-- Habilidades de Proyectos
INSERT INTO public.skills (name, category)
VALUES
  ('Frontend', 'Desarrollo de Software'),
  ('Backend', 'Desarrollo de Software'),
  ('Base de Datos', 'Datos y Persistencia'),
  ('UX/UI', 'Diseño y Experiencia'),
  ('Machine Learning', 'Inteligencia Artificial'),
  ('Data Science', 'Ciencia de Datos'),
  ('Ciberseguridad', 'Seguridad'),
  ('Gestión de Proyectos', 'Gestión y Agile'),
  ('Redes', 'Infraestructura'),
  ('Desarrollo Mobile', 'Desarrollo de Software'),
  ('QA / Testing', 'Calidad de Software'),
  ('DevOps', 'Infraestructura y Cloud')
ON CONFLICT (name) DO NOTHING;

-- Intereses de Proyectos
INSERT INTO public.project_interests (name)
VALUES
  ('Inteligencia Artificial'),
  ('Aplicaciones Web'),
  ('Aplicaciones Móviles'),
  ('Educación'),
  ('Salud'),
  ('Videojuegos'),
  ('IoT'),
  ('Ciberseguridad'),
  ('Ciencia de Datos'),
  ('Emprendimiento'),
  ('Automatización')
ON CONFLICT (name) DO NOTHING;
