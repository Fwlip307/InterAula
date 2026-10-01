-- ==============================================================================
-- InterAula: Sprint 3 - Migración 005
-- Almacenamiento Privado de Documentos y Extracción Estructurada de Certificados
-- Compatible con 001, 002, 003 y 004
-- ==============================================================================

-- 1. BUCKET PRIVADO DE STORAGE: verification-documents
-- Crea el bucket privado en Supabase Storage si no existe previamente
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,
  10485760, -- Límite de 10 MB por archivo
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Habilitar RLS en storage.objects si no estuviera habilitado
-- (Por defecto en Supabase está habilitado)
-- Políticas de seguridad para storage.objects en verification-documents:

DROP POLICY IF EXISTS "verification_documents_upload_own" ON storage.objects;
CREATE POLICY "verification_documents_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "verification_documents_select_own_or_validator" ON storage.objects;
CREATE POLICY "verification_documents_select_own_or_validator"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_academic_validator(auth.uid())
    )
  );

DROP POLICY IF EXISTS "verification_documents_delete_own" ON storage.objects;
CREATE POLICY "verification_documents_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. EXTENSIÓN DE TABLA: tutor_verification_requests
-- Incorpora metadatos del archivo y resultado de extracción estructurada
ALTER TABLE public.tutor_verification_requests
  ADD COLUMN IF NOT EXISTS document_path text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_filename text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_size_bytes bigint DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_uploaded_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_extraction_status text NOT NULL DEFAULT 'not_uploaded'
    CHECK (document_extraction_status IN (
      'not_uploaded',
      'uploaded',
      'processing',
      'completed',
      'warnings',
      'manual_review_required'
    )),
  ADD COLUMN IF NOT EXISTS document_extracted_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS matched_subject_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS matched_grade numeric(3,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS matched_status text DEFAULT NULL
    CHECK (matched_status IS NULL OR matched_status IN (
      'found',
      'not_found',
      'grade_below_min',
      'manual_review_required'
    )),
  ADD COLUMN IF NOT EXISTS calculated_level text DEFAULT NULL
    CHECK (calculated_level IS NULL OR calculated_level IN ('basic', 'intermediate', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_verification_requests_doc_status
  ON public.tutor_verification_requests(document_extraction_status);

