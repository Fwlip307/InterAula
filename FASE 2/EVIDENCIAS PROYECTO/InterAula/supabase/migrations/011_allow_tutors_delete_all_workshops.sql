-- ==============================================================================
-- InterAula: Migración 011
-- Permitir a los Tutores Eliminar sus Propias Clases y Talleres sin Restricción de Estado
-- Corrige el bloqueo en clases con status = 'completed' o 'in_progress'
-- ==============================================================================

-- 1. Eliminar política restrictiva anterior que solo permitía eliminar con status = 'scheduled'
DROP POLICY IF EXISTS "Tutors can delete their own scheduled workshops" ON public.tutoring_workshops;
DROP POLICY IF EXISTS "Tutors can delete their own workshops" ON public.tutoring_workshops;

-- 2. Crear nueva política permisiva para que el tutor pueda depurar cualquier clase de su autoría
CREATE POLICY "Tutors can delete their own workshops"
  ON public.tutoring_workshops FOR DELETE
  TO authenticated
  USING (auth.uid() = tutor_id);
