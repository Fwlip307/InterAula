BEGIN;
ALTER TABLE public.inclusive_tutor_accreditations
 ADD COLUMN IF NOT EXISTS issuer_name text,
 ADD COLUMN IF NOT EXISTS completed_on date,
 ADD COLUMN IF NOT EXISTS credential_code text,
 ADD COLUMN IF NOT EXISTS verification_url text,
 ADD COLUMN IF NOT EXISTS document_path text,
 ADD COLUMN IF NOT EXISTS document_filename text,
 ADD COLUMN IF NOT EXISTS document_size_bytes bigint,
 ADD COLUMN IF NOT EXISTS proof_version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS reviewer_notes text,
 ADD COLUMN IF NOT EXISTS verification_checks jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS review_history jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.inclusive_tutor_accreditations DROP CONSTRAINT IF EXISTS inclusive_tutor_accreditations_status_check;
ALTER TABLE public.inclusive_tutor_accreditations ADD CONSTRAINT inclusive_tutor_accreditations_status_check CHECK(status IN('pending','approved','rejected','revoked'));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('inclusive-evidence','inclusive-evidence',false,5242880,ARRAY['application/pdf'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['application/pdf'];

DROP POLICY IF EXISTS inclusive_evidence_insert ON storage.objects;
CREATE POLICY inclusive_evidence_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='inclusive-evidence' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS inclusive_evidence_read ON storage.objects;
CREATE POLICY inclusive_evidence_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='inclusive-evidence' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_academic_validator(auth.uid())));
DROP POLICY IF EXISTS inclusive_evidence_delete ON storage.objects;
CREATE POLICY inclusive_evidence_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='inclusive-evidence' AND (storage.foldername(name))[1]=auth.uid()::text
  AND NOT EXISTS(SELECT 1 FROM public.inclusive_tutor_accreditations a WHERE a.document_path=name
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.review_history) h WHERE h->>'document_path'=name)));

DROP POLICY IF EXISTS inclusive_accreditations_select ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_select ON public.inclusive_tutor_accreditations FOR SELECT TO authenticated
 USING(tutor_id=auth.uid() OR public.is_academic_validator(auth.uid()));
DROP POLICY IF EXISTS inclusive_accreditations_resubmit ON public.inclusive_tutor_accreditations;
CREATE POLICY inclusive_accreditations_resubmit ON public.inclusive_tutor_accreditations FOR UPDATE TO authenticated
 USING(tutor_id=auth.uid() AND (status<>'approved' OR proof_version<2))
 WITH CHECK(tutor_id=auth.uid() AND status='pending' AND verified_by IS NULL AND verified_at IS NULL);

CREATE OR REPLACE FUNCTION public.guard_inclusive_accreditation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); entry jsonb;
BEGIN
 IF auth.role()='service_role' THEN RETURN NEW; END IF;
 IF actor IS NULL THEN RAISE EXCEPTION 'Se requiere autenticacion' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.tutor_id<>OLD.tutor_id OR NEW.created_at<>OLD.created_at) THEN
  RAISE EXCEPTION 'No se puede cambiar el titular de la acreditacion' USING ERRCODE='42501';
 END IF;
 IF NEW.tutor_id=actor THEN
  IF NEW.status<>'pending' OR (TG_OP='UPDATE' AND OLD.status='approved' AND OLD.proof_version>=2) THEN
   RAISE EXCEPTION 'No puedes revisar tu propia acreditacion' USING ERRCODE='42501';
  END IF;
  IF NEW.proof_version<>2 OR length(trim(coalesce(NEW.issuer_name,'')))<3
    OR NEW.completed_on IS NULL OR NEW.completed_on>current_date
    OR length(trim(coalesce(NEW.credential_code,'')))<2
    OR coalesce(NEW.verification_url,'') !~ '^https://[^/[:space:]]+'
    OR length(trim(NEW.evidence_notes))<100
    OR coalesce(NEW.document_size_bytes,0) NOT BETWEEN 1 AND 5242880
    OR coalesce(NEW.document_path,'') NOT LIKE actor::text||'/%'
    OR coalesce(NEW.document_filename,'') !~* '\.pdf$'
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='inclusive-evidence' AND name=NEW.document_path) THEN
   RAISE EXCEPTION 'Falta certificado PDF, datos verificables del emisor o caso practico' USING ERRCODE='23514';
  END IF;
  NEW.verified_by:=NULL;NEW.verified_at:=NULL;NEW.reviewer_notes:=NULL;NEW.verification_checks:='{}';
  NEW.review_history:=CASE WHEN TG_OP='UPDATE' THEN OLD.review_history ELSE '[]'::jsonb END;
 ELSE
  IF TG_OP='INSERT' OR NOT public.is_academic_validator(actor) THEN
   RAISE EXCEPTION 'Se requiere otro validador autorizado' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','verified_by','verified_at','updated_at','reviewer_notes','verification_checks','review_history'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','verified_by','verified_at','updated_at','reviewer_notes','verification_checks','review_history']) THEN
   RAISE EXCEPTION 'El revisor no puede modificar la evidencia del solicitante' USING ERRCODE='42501';
  END IF;
  IF NEW.status NOT IN('approved','rejected','revoked') OR NEW.status=OLD.status
    OR (NEW.status='revoked' AND OLD.status<>'approved')
    OR (OLD.status='approved' AND NEW.status<>'revoked')
    OR length(trim(coalesce(NEW.reviewer_notes,'')))<30 THEN
   RAISE EXCEPTION 'La decision requiere un cambio valido y justificacion escrita' USING ERRCODE='23514';
  END IF;
  IF NEW.status='approved' AND (NEW.proof_version<>2 OR NOT(
    coalesce(NEW.verification_checks->>'identity_matches','false')='true'
    AND coalesce(NEW.verification_checks->>'issuer_verified','false')='true'
    AND coalesce(NEW.verification_checks->>'training_relevant','false')='true'
    AND coalesce(NEW.verification_checks->>'practical_passed','false')='true')) THEN
   RAISE EXCEPTION 'Debes verificar certificado, emisor, formacion y caso practico antes de aprobar' USING ERRCODE='23514';
  END IF;
  NEW.verified_by:=actor;NEW.verified_at:=now();
  entry:=jsonb_build_object('status',NEW.status,'reviewer_id',actor,'reviewed_at',now(),'notes',NEW.reviewer_notes,'checks',NEW.verification_checks,'document_path',NEW.document_path);
  NEW.review_history:=OLD.review_history||jsonb_build_array(entry);
 END IF;
 NEW.updated_at:=now();RETURN NEW;
END $$;

-- Only this minimal, verified badge is public. The certificate and case remain private.
CREATE OR REPLACE VIEW public.inclusive_tutor_public_credentials WITH(security_barrier=true) AS
 SELECT tutor_id,status,training_name,issuer_name,verified_at
 FROM public.inclusive_tutor_accreditations
 WHERE status='approved' AND proof_version>=2 AND verified_by IS NOT NULL AND verified_by<>tutor_id;
GRANT SELECT ON public.inclusive_tutor_public_credentials TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
