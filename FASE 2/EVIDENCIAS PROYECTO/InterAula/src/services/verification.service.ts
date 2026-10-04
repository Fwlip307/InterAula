import { supabase } from '../lib/supabase';
import { isCertifiedAccount } from './profile.service';
import type {
  TutorVerificationRequest,
  AcademicValidator,
  CreateVerificationRequestDTO,
  SubmitPracticalEvaluationDTO,
  ReviewVerificationRequestDTO,
  SaveCertificateExtractionDTO,
} from '../types/verification';
import { validatePdfFile } from '../utils/pdfExtractor';

/**
 * Helper interno para obtener el usuario autenticado obligatorio en mutaciones.
 */
async function getRequiredAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Debes iniciar sesión para realizar esta acción');
  }
  return authData.user;
}

/**
 * Helper interno para obtener el usuario autenticado opcional (ej. consultas de lectura).
 */
async function getOptionalAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return null;
  }
  return authData.user;
}

const VERIFICATION_REQUEST_SELECT = `
  *,
  subject:subjects (
    id,
    name,
    category,
    is_pilot,
    pilot_priority
  ),
  tutor:profiles!tutor_verification_requests_tutor_id_fkey (
    id,
    first_name,
    last_name,
    display_name,
    avatar_url,
    institution,
    career,
    email
  ),
  reviewer:profiles!tutor_verification_requests_reviewed_by_fkey (
    id,
    first_name,
    last_name,
    display_name,
    avatar_url
  )
`;

export const verificationService = {
  /**
   * Crea una nueva solicitud de verificación para una asignatura ofrecida por el estudiante.
   * Admite DTO { subject_id }, (subjectId) o (tutorId, subjectId).
   */
  async createVerificationRequest(
    arg1: string | CreateVerificationRequestDTO,
    arg2?: string
  ): Promise<TutorVerificationRequest> {
    const user = await getRequiredAuthUser();
    let tutorId = user.id;
    let subjectId: string;

    if (typeof arg1 === 'object') {
      subjectId = arg1.subject_id;
    } else if (arg2) {
      tutorId = arg1;
      subjectId = arg2;
    } else {
      subjectId = arg1;
    }

    if (tutorId !== user.id) {
      throw new Error('No puedes crear solicitudes de verificación en nombre de otro usuario');
    }

    // Pre-validación UX: la materia debe estar ofrecida por el usuario
    const { data: offered, error: offeredError } = await supabase
      .from('profile_offered_subjects')
      .select('is_verified')
      .eq('profile_id', user.id)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (offeredError) {
      console.error('[verificationService] Error consultando materia ofrecida:', offeredError.message);
    }

    if (!offered) {
      throw new Error('Debes registrar esta asignatura en tu lista de materias ofrecidas antes de solicitar su verificación');
    }

    if (offered.is_verified) {
      throw new Error('Esta asignatura ya cuenta con la verificación académica aprobada');
    }

    // Inserción protegida por RLS y Triggers
    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .insert({
        tutor_id: user.id,
        subject_id: subjectId,
        status: 'pending',
      })
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      console.error('[verificationService] Error en createVerificationRequest:', error.message);
      if (error.message.includes('idx_active_verification_per_tutor_subject') || error.code === '23505') {
        throw new Error('Ya tienes una solicitud de verificación activa o aprobada para esta asignatura');
      }
      throw new Error(error.message || 'No fue posible crear la solicitud de verificación');
    }

    return data as TutorVerificationRequest;
  },

  /**
   * Obtiene todas las solicitudes de verificación realizadas por el usuario en sesión.
   */
  async getMyVerificationRequests(): Promise<TutorVerificationRequest[]> {
    const user = await getRequiredAuthUser();

    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .select(VERIFICATION_REQUEST_SELECT)
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[verificationService] Error en getMyVerificationRequests:', error.message);
      throw new Error('No fue posible cargar tus solicitudes de verificación');
    }

    return (data || []) as TutorVerificationRequest[];
  },

  /**
   * Obtiene la lista de solicitudes de verificación pendientes de revisión para el validador académico.
   * La seguridad de lectura está gobernada por RLS (public.is_academic_validator).
   */
  async getVerificationRequestsForValidator(): Promise<TutorVerificationRequest[]> {
    await getRequiredAuthUser();

    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .select(VERIFICATION_REQUEST_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[verificationService] Error en getVerificationRequestsForValidator:', error.message);
      throw new Error(error.message || 'No fue posible cargar las solicitudes de verificación');
    }

    return (data || []) as TutorVerificationRequest[];
  },

  /**
   * Asigna un caso o ejercicio práctico a una solicitud (Operación exclusiva del validador docente).
   */
  async assignPracticalExercise(
    requestId: string,
    practicalExerciseTitle: string
  ): Promise<TutorVerificationRequest> {
    await getRequiredAuthUser();

    const trimmedTitle = practicalExerciseTitle?.trim();
    if (!trimmedTitle) {
      throw new Error('El título o descripción del ejercicio práctico no puede estar vacío');
    }

    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .update({
        practical_exercise_title: trimmedTitle,
        status: 'practical_evaluation',
      })
      .eq('id', requestId)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      console.error('[verificationService] Error en assignPracticalExercise:', error.message);
      throw new Error(error.message || 'No fue posible asignar el ejercicio práctico');
    }

    return data as TutorVerificationRequest;
  },

  /**
   * Envía la entrega práctica y notas de defensa conceptual (Operación del estudiante postulante).
   * El trigger de base de datos avanza de forma segura el estado a 'under_review'.
   */
  async submitPracticalEvaluation(
    requestId: string,
    dto: SubmitPracticalEvaluationDTO
  ): Promise<TutorVerificationRequest> {
    const user = await getRequiredAuthUser();

    const submission = dto.practical_submission?.trim();
    const defense = dto.defense_notes?.trim();

    if (!submission) {
      throw new Error('Debes incluir la entrega práctica (solución técnica o enlace de repositorio)');
    }
    if (!defense) {
      throw new Error('Debes incluir la justificación conceptual y defensa de tu solución');
    }

    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .update({
        practical_submission: submission,
        defense_notes: defense,
      })
      .eq('id', requestId)
      .eq('tutor_id', user.id)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      console.error('[verificationService] Error en submitPracticalEvaluation:', error.message);
      throw new Error(error.message || 'No fue posible enviar la entrega de evaluación práctica');
    }

    return data as TutorVerificationRequest;
  },

  /**
   * Dictamina y resuelve una solicitud de verificación (Operación exclusiva del validador docente).
   * Estados resolutivos admitidos: 'approved', 'rejected', 'requires_reevaluation'.
   * La sincronización con profile_offered_subjects.is_verified la efectúa el trigger de BD.
   */
  async reviewVerificationRequest(
    requestId: string,
    dto: ReviewVerificationRequestDTO
  ): Promise<TutorVerificationRequest> {
    await getRequiredAuthUser();

    const validStatuses = ['approved', 'rejected', 'requires_reevaluation'];
    if (!validStatuses.includes(dto.status)) {
      throw new Error('El estado resolutivo indicado no es válido');
    }

    const feedback = dto.reviewer_feedback?.trim();
    if (!feedback) {
      throw new Error('Debes proporcionar retroalimentación pedagógica al dictaminar la solicitud');
    }

    const payload: Record<string, any> = {
      status: dto.status,
      reviewer_feedback: feedback,
    };

    if (dto.practical_exercise_title?.trim()) {
      payload.practical_exercise_title = dto.practical_exercise_title.trim();
    }

    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .update(payload)
      .eq('id', requestId)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      console.error('[verificationService] Error en reviewVerificationRequest:', error.message);
      if (error.message.includes('Un docente validador no puede evaluar ni dictaminar su propia postulación')) {
        throw new Error('Un docente validador no puede evaluar ni dictaminar su propia postulación');
      }
      throw new Error(error.message || 'No fue posible registrar el dictamen de verificación');
    }

    return data as TutorVerificationRequest;
  },

  /**
   * Consulta si un tutor está verificado en una asignatura específica consultando profile_offered_subjects.
   */
  async isTutorVerifiedForSubject(tutorId: string, subjectId: string): Promise<boolean> {
    if (isCertifiedAccount(tutorId)) {
      return true;
    }

    const { data, error } = await supabase
      .from('profile_offered_subjects')
      .select('is_verified')
      .eq('profile_id', tutorId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (error) {
      console.error('[verificationService] Error en isTutorVerifiedForSubject:', error.message);
      return false;
    }
    return Boolean(data?.is_verified);
  },

  /**
   * Comprueba si el usuario actualmente autenticado está registrado como validador académico.
   */
  async isCurrentAcademicValidator(): Promise<boolean> {
    const user = await getOptionalAuthUser();
    if (!user) return false;

    if (isCertifiedAccount(user.email) || isCertifiedAccount(user.id)) {
      return true;
    }

    const { data, error } = await supabase
      .from('academic_validators')
      .select('profile_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[verificationService] Error en isCurrentAcademicValidator:', error.message);
      return false;
    }
    return !!data;
  },

  /**
   * Obtiene la información de validador académico para un perfil dado.
   */
  async getAcademicValidatorProfile(profileId?: string): Promise<AcademicValidator | null> {
    const targetId = profileId || (await getOptionalAuthUser())?.id;
    if (!targetId) return null;

    if (isCertifiedAccount(targetId)) {
      return {
        profile_id: targetId,
        role_title: 'Docente Validador / Tutor Master',
        department: 'Administración e Informática',
        created_at: '2026-10-01T10:00:00Z',
      } as AcademicValidator;
    }

    const { data, error } = await supabase
      .from('academic_validators')
      .select('*, profile:profiles(*)')
      .eq('profile_id', targetId)
      .maybeSingle();

    if (error) {
      console.error('[verificationService] Error en getAcademicValidatorProfile:', error.message);
      return null;
    }
    return data as AcademicValidator | null;
  },

  /**
   * Cancela una solicitud en estado 'pending' creada por el propio usuario.
   */
  async cancelPendingRequest(requestId: string): Promise<void> {
    const user = await getRequiredAuthUser();

    const { error } = await supabase
      .from('tutor_verification_requests')
      .delete()
      .eq('id', requestId)
      .eq('tutor_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('[verificationService] Error en cancelPendingRequest:', error.message);
      throw new Error(error.message || 'No fue posible cancelar la solicitud de verificación');
    }
  },

  /**
   * Sube un certificado académico en PDF al bucket privado 'verification-documents' de Supabase Storage.
   */
  async uploadCertificateDocument(
    requestId: string,
    file: File
  ): Promise<{ document_path: string; document_filename: string; document_size_bytes: number }> {
    const user = await getRequiredAuthUser();

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Archivo no válido');
    }

    // Ruta segura en el bucket privado estructurada por usuario y solicitud
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${requestId}/${Date.now()}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('verification-documents')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[verificationService] Error en uploadCertificateDocument:', uploadError.message);
      throw new Error(`Error al subir documento: ${uploadError.message}`);
    }

    return {
      document_path: storagePath,
      document_filename: file.name,
      document_size_bytes: file.size,
    };
  },

  /**
   * Persiste en la base de datos la información extraída del certificado y el resultado del cruce.
   */
  async saveCertificateExtraction(
    requestId: string,
    dto: SaveCertificateExtractionDTO
  ): Promise<TutorVerificationRequest> {
    const user = await getRequiredAuthUser();

    const payload = {
      document_path: dto.document_path,
      document_filename: dto.document_filename,
      document_size_bytes: dto.document_size_bytes,
      document_uploaded_at: new Date().toISOString(),
      document_extraction_status: dto.document_extraction_status,
      document_extracted_data: dto.document_extracted_data,
      matched_subject_name: dto.matched_subject_name || null,
      matched_grade: dto.matched_grade || null,
      matched_status: dto.matched_status || null,
      calculated_level: dto.calculated_level || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tutor_verification_requests')
      .update(payload)
      .eq('id', requestId)
      .eq('tutor_id', user.id)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      console.error('[verificationService] Error en saveCertificateExtraction:', error.message);
      throw new Error(error.message || 'No fue posible registrar los datos del certificado');
    }

    return data as TutorVerificationRequest;
  },

  /**
   * Genera una URL firmada temporal para visualizar o descargar el certificado de forma privada.
   * Expira por defecto en 30 minutos (1800 segundos).
   */
  async getDocumentSignedUrl(documentPath: string, expiresInSeconds = 1800): Promise<string | null> {
    await getRequiredAuthUser();

    if (!documentPath) return null;

    const { data, error } = await supabase.storage
      .from('verification-documents')
      .createSignedUrl(documentPath, expiresInSeconds);

    if (error) {
      console.error('[verificationService] Error al generar URL firmada:', error.message);
      return null;
    }

    return data?.signedUrl || null;
  },
};
