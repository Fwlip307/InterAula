-- ==============================================================================
-- InterAula: Sprint 3 - Migración 003
-- Módulo de Tutores Verificados, Evaluación Práctica, Preferencias de Aprendizaje
-- y Preparación para el Piloto de Asignaturas (Duoc UC)
-- Compatible con 001_profiles_and_projects.sql y 002_tutoring_and_badges.sql
-- ==============================================================================

-- 1. ASIGNATURAS PILOTO CONFIGURABLES
-- Permite identificar las asignaturas del piloto de forma flexible sin hardcoding en el cliente.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pilot_priority integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subjects_is_pilot ON public.subjects(is_pilot);

-- 2. PREFERENCIAS DE APRENDIZAJE INCLUSIVAS
-- Preferencias estrictamente pedagógicas/metodológicas (ej: explicaciones paso a paso,
-- ejemplos prácticos, apoyo visual, ritmo estructurado). Cero información médica o clínica.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_preferences text[] DEFAULT '{}'::text[];

-- 3. ESTADO DE VERIFICACIÓN POR ASIGNATURA
-- La verificación académica está vinculada a una asignatura específica que el tutor ofrece,
-- preservando el principio de cuenta híbrida (un usuario puede ser tutor verificado en una materia,
-- tutor comunitario en otra y estudiante aprendiz en una tercera).
ALTER TABLE public.profile_offered_subjects
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_offered_subjects_verification 
  ON public.profile_offered_subjects(is_verified) 
  WHERE is_verified = true;

-- 4. AUTORIZACIÓN DE VALIDADORES ACADÉMICOS
-- Tabla simple y segura para registrar a los docentes o responsables académicos autorizados.
-- Evita roles globales complejos y mantiene intacto el modelo híbrido del usuario.
CREATE TABLE IF NOT EXISTS public.academic_validators (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_title text NOT NULL DEFAULT 'Docente Validador',
  department text DEFAULT 'Ingeniería en Informática',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.academic_validators ENABLE ROW LEVEL SECURITY;

-- Lectura de validadores para usuarios autenticados
DROP POLICY IF EXISTS "academic_validators_select" ON public.academic_validators;
CREATE POLICY "academic_validators_select"
  ON public.academic_validators FOR SELECT
  TO authenticated
  USING (true);

-- Modificación restringida: Solo administradores o mantenimiento por base de datos
DROP POLICY IF EXISTS "academic_validators_modify_restricted" ON public.academic_validators;
CREATE POLICY "academic_validators_modify_restricted"
  ON public.academic_validators FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Función auxiliar para verificar si un usuario es validador académico.
-- Definida con SECURITY DEFINER y search_path seguro para evitar escalamiento de privilegios y recursión.
CREATE OR REPLACE FUNCTION public.is_academic_validator(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE 
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.academic_validators WHERE profile_id = p_user_id
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_academic_validator(uuid) TO authenticated;

-- 5. PROTECCIÓN DE MODIFICACIÓN EN profile_offered_subjects
-- Garantiza que un usuario normal no pueda auto-aprobarse ni manipular is_verified / verified_at.
-- La verificación SOLO puede producirse si existe una resolución formal de un validador académico.
CREATE OR REPLACE FUNCTION public.protect_profile_offered_subjects_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_user uuid;
BEGIN
  v_current_user := auth.uid();

  -- En inserciones nuevas, el estado de verificación siempre inicia en false
  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
    NEW.verified_at := NULL;
    RETURN NEW;
  END IF;

  -- En actualizaciones, si el estado de verificación o fecha cambian
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_verified <> OLD.is_verified OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      -- Regla 1: El propietario del perfil NUNCA puede modificar directamente is_verified ni verified_at
      IF v_current_user IS NOT NULL AND v_current_user = NEW.profile_id THEN
        NEW.is_verified := OLD.is_verified;
        NEW.verified_at := OLD.verified_at;

      -- Regla 2: Para establecer is_verified = true, DEBE existir una solicitud formal aprobada por un validador distinto
      ELSIF NEW.is_verified = true THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.tutor_verification_requests
          WHERE tutor_id = NEW.profile_id 
            AND subject_id = NEW.subject_id 
            AND status = 'approved'
            AND reviewed_by IS NOT NULL
            AND reviewed_by <> NEW.profile_id
            AND public.is_academic_validator(reviewed_by)
        ) THEN
          -- Si no existe dictamen formal aprobatorio, revertir
          NEW.is_verified := OLD.is_verified;
          NEW.verified_at := OLD.verified_at;
        END IF;

      -- Regla 3: Si se revoca la verificación, limpiar verified_at
      ELSIF NEW.is_verified = false THEN
        NEW.verified_at := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_offered_subjects_verification ON public.profile_offered_subjects;
CREATE TRIGGER trg_protect_profile_offered_subjects_verification
  BEFORE INSERT OR UPDATE ON public.profile_offered_subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_offered_subjects_verification();

-- 6. TABLA: tutor_verification_requests (Trazabilidad y proceso de validación práctica)
CREATE TABLE IF NOT EXISTS public.tutor_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN (
      'pending',               -- Solicitud inicial creada por el estudiante
      'practical_evaluation',  -- Ejercicio práctico asignado o en desarrollo
      'under_review',          -- Solución y defensa entregadas, esperando revisión docente
      'approved',              -- Aprobado por el docente (otorga tutor verificado)
      'rejected',              -- Rechazado con observaciones
      'requires_reevaluation'  -- Requiere nueva evaluación práctica o ajustes
    )),
  practical_exercise_title text,  -- Enunciado o caso práctico asignado por el docente
  practical_submission text,      -- Solución técnica, código o enlace de repositorio entregado
  defense_notes text,             -- Justificación conceptual / defensa razonada de la solución
  reviewer_feedback text,        -- Retroalimentación pedagógica y comentarios del docente validador
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_verification_requests_tutor ON public.tutor_verification_requests(tutor_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_subject ON public.tutor_verification_requests(subject_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.tutor_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_reviewed_by ON public.tutor_verification_requests(reviewed_by);

-- Control estricto de solicitudes activas mediante ÍNDICE ÚNICO PARCIAL:
-- 1. Permite únicamente UNA solicitud activa ('pending', 'practical_evaluation', 'under_review') por (tutor_id, subject_id).
-- 2. Impide postular a verificación si el tutor ya está 'approved' en esa asignatura.
-- 3. Permite mantener el historial íntegro de solicitudes resueltas como 'rejected' o 'requires_reevaluation',
--    habilitando futuras postulaciones cuando el estudiante esté preparado.
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_verification_per_tutor_subject 
  ON public.tutor_verification_requests (tutor_id, subject_id) 
  WHERE status IN ('pending', 'practical_evaluation', 'under_review', 'approved');

-- 7. TRIGGER DE SEGURIDAD Y TRANSICIÓN DE ESTADOS: tutor_verification_requests
CREATE OR REPLACE FUNCTION public.process_tutor_verification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_user uuid;
  v_is_validator boolean;
  v_offers_subject boolean;
BEGIN
  v_current_user := auth.uid();
  v_is_validator := public.is_academic_validator(v_current_user);

  -- =========================================================================
  -- Validaciones de INSERCIÓN (Estudiante crea solicitud)
  -- =========================================================================
  IF TG_OP = 'INSERT' THEN
    -- 1. El postulante debe ser el usuario autenticado
    IF v_current_user IS NOT NULL AND NEW.tutor_id <> v_current_user THEN
      RAISE EXCEPTION 'No puedes postular a verificación en nombre de otro estudiante';
    END IF;

    -- 2. El estudiante debe ofrecer actualmente la asignatura en su perfil
    SELECT EXISTS (
      SELECT 1 FROM public.profile_offered_subjects
      WHERE profile_id = NEW.tutor_id AND subject_id = NEW.subject_id
    ) INTO v_offers_subject;

    IF NOT v_offers_subject THEN
      RAISE EXCEPTION 'Solo puedes solicitar verificación en asignaturas que tengas registradas como ofrecidas en tu perfil';
    END IF;

    -- 3. Estado inicial forzado a pending y campos reservados neutralizados
    NEW.status := 'pending';
    NEW.practical_exercise_title := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.reviewer_feedback := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- =========================================================================
  -- Validaciones de ACTUALIZACIÓN (Ciclo de Vida y Dictamen Docente)
  -- =========================================================================
  IF TG_OP = 'UPDATE' THEN
    -- Inmutabilidad de claves de postulación
    IF NEW.tutor_id <> OLD.tutor_id OR NEW.subject_id <> OLD.subject_id THEN
      RAISE EXCEPTION 'No está permitido modificar el tutor o la asignatura de una solicitud existente';
    END IF;

    -- Inmutabilidad de fecha de creación
    NEW.created_at := OLD.created_at;

    -- CASO A: El usuario autenticado es el postulante (tutor_id)
    -- Aplica incluso si el usuario es docente validador en otras materias: frente a su propia postulación actúa solo como postulante.
    IF v_current_user IS NOT NULL AND v_current_user = OLD.tutor_id THEN
      -- Una solicitud resuelta ('approved' o 'rejected') no puede ser modificada por el estudiante
      IF OLD.status IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'No se pueden modificar solicitudes de verificación que ya han sido resueltas';
      END IF;

      -- Un estudiante NO puede emitir dictámenes, auto-aprobarse ni auto-evaluarse
      IF NEW.status IN ('approved', 'rejected', 'requires_reevaluation') THEN
        RAISE EXCEPTION 'No puedes evaluar ni dictaminar tu propia solicitud de verificación';
      END IF;

      -- El estudiante no puede alterar los campos reservados al docente validador
      NEW.practical_exercise_title := OLD.practical_exercise_title;
      NEW.reviewed_by := OLD.reviewed_by;
      NEW.reviewed_at := OLD.reviewed_at;
      NEW.reviewer_feedback := OLD.reviewer_feedback;

      -- Transición permitida: Si entrega solución práctica y notas, pasa automáticamente a 'under_review'
      IF OLD.status IN ('pending', 'practical_evaluation') AND NEW.practical_submission IS NOT NULL AND trim(NEW.practical_submission) <> '' THEN
        NEW.status := 'under_review';
      ELSE
        NEW.status := OLD.status;
      END IF;

    -- CASO B: Un validador académico distinto está revisando o resolviendo la solicitud
    ELSIF v_is_validator THEN
      -- REGLA CRÍTICA: Un docente validador jamás puede evaluar ni dictaminar su propia postulación
      IF v_current_user = OLD.tutor_id THEN
        RAISE EXCEPTION 'Un docente validador no puede evaluar ni dictaminar su propia postulación';
      END IF;

      -- Preservar la entrega y defensa del estudiante para evitar sobrescrituras accidentales
      IF NEW.practical_submission IS NULL AND OLD.practical_submission IS NOT NULL THEN
        NEW.practical_submission := OLD.practical_submission;
      END IF;
      IF NEW.defense_notes IS NULL AND OLD.defense_notes IS NOT NULL THEN
        NEW.defense_notes := OLD.defense_notes;
      END IF;

      -- Si el validador emite dictamen resolutivo (approved, rejected, requires_reevaluation)
      IF NEW.status IN ('approved', 'rejected', 'requires_reevaluation') THEN
        IF NEW.reviewer_feedback IS NULL OR trim(NEW.reviewer_feedback) = '' THEN
          RAISE EXCEPTION 'El docente validador debe incluir retroalimentación pedagógica (reviewer_feedback) al emitir un dictamen';
        END IF;

        NEW.reviewed_by := v_current_user;
        NEW.reviewed_at := now();

        -- Sincronizar estado en profile_offered_subjects
        IF NEW.status = 'approved' THEN
          UPDATE public.profile_offered_subjects
          SET is_verified = true, verified_at = now()
          WHERE profile_id = NEW.tutor_id AND subject_id = NEW.subject_id;
        ELSIF NEW.status IN ('rejected', 'requires_reevaluation') AND OLD.status = 'approved' THEN
          UPDATE public.profile_offered_subjects
          SET is_verified = false, verified_at = NULL
          WHERE profile_id = NEW.tutor_id AND subject_id = NEW.subject_id;
        END IF;

      -- Si el validador asigna el ejercicio práctico ('practical_evaluation')
      ELSIF NEW.status = 'practical_evaluation' THEN
        NEW.reviewed_by := v_current_user;
      END IF;

    -- CASO C: Usuario no autorizado
    ELSE
      RAISE EXCEPTION 'No tienes autorización para modificar esta solicitud de verificación';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- =========================================================================
  -- Validaciones de ELIMINACIÓN (Protección de Trazabilidad e Historial)
  -- =========================================================================
  IF TG_OP = 'DELETE' THEN
    -- Solo el estudiante puede retirar su solicitud y únicamente mientras siga en estado pending
    IF v_current_user IS NOT NULL AND (v_current_user <> OLD.tutor_id OR OLD.status <> 'pending') THEN
      RAISE EXCEPTION 'Solo puedes cancelar tu propia solicitud mientras se encuentre en estado pendiente';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_tutor_verification_request ON public.tutor_verification_requests;
CREATE TRIGGER trg_process_tutor_verification_request
  BEFORE INSERT OR UPDATE OR DELETE ON public.tutor_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.process_tutor_verification_request();

-- 8. POLÍTICAS DE SEGURIDAD (RLS) para tutor_verification_requests
ALTER TABLE public.tutor_verification_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: El estudiante solicitante ve sus solicitudes; los validadores ven todas las solicitudes
DROP POLICY IF EXISTS "verification_requests_select" ON public.tutor_verification_requests;
CREATE POLICY "verification_requests_select"
  ON public.tutor_verification_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = tutor_id OR public.is_academic_validator(auth.uid())
  );

-- INSERT: Solo el estudiante puede postular su propia solicitud
DROP POLICY IF EXISTS "verification_requests_insert_own" ON public.tutor_verification_requests;
CREATE POLICY "verification_requests_insert_own"
  ON public.tutor_verification_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = tutor_id
  );

-- UPDATE: Defensa en profundidad
-- El estudiante solo puede actualizar sus solicitudes activas.
-- El validador puede actualizar y calificar solicitudes ajenas.
DROP POLICY IF EXISTS "verification_requests_update" ON public.tutor_verification_requests;
CREATE POLICY "verification_requests_update"
  ON public.tutor_verification_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = tutor_id AND status IN ('pending', 'practical_evaluation', 'under_review'))
    OR (public.is_academic_validator(auth.uid()) AND auth.uid() <> tutor_id)
  )
  WITH CHECK (
    (auth.uid() = tutor_id AND status IN ('pending', 'practical_evaluation', 'under_review'))
    OR (public.is_academic_validator(auth.uid()) AND auth.uid() <> tutor_id)
  );

-- DELETE: El estudiante solo puede retirar/cancelar su solicitud si sigue en estado pending.
-- Las solicitudes en evaluación, bajo revisión o resueltas son inmutables para eliminación.
DROP POLICY IF EXISTS "verification_requests_delete_pending" ON public.tutor_verification_requests;
CREATE POLICY "verification_requests_delete_pending"
  ON public.tutor_verification_requests FOR DELETE
  TO authenticated
  USING (
    auth.uid() = tutor_id AND status = 'pending'
  );
