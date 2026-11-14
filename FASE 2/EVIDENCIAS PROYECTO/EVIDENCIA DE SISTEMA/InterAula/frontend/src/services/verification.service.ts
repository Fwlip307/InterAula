import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type {
  TutorVerificationRequest,
  AcademicValidator,
  CreateVerificationRequestDTO,
  SubmitPracticalEvaluationDTO,
  ReviewVerificationRequestDTO,
  SaveCertificateExtractionDTO,
} from '../types/verification';
import type { InclusiveTutorAccreditation } from '../types/tutoring';
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

export interface AssessmentQuestion {
  id: string;
  type: 'choice' | 'redaction';
  prompt: string;
  options?: { id: string; text: string }[];
  codeSnippet?: string;
  placeholder?: string;
}
export interface ServerAssessment {
  id: string;
  subjectId: string;
  subjectName: string;
  level: 'basic';
  totalQuestions: number;
  expiresAt: string;
  question: AssessmentQuestion;
}
export interface ServerAssessmentAnswer {
  correct: boolean;
  feedback: string;
  score: number;
  answered: number;
  totalQuestions: number;
  finished: boolean;
  passed: boolean;
  nextQuestion: AssessmentQuestion | null;
}

export const verificationService = {
  /**
   * Crea una nueva solicitud de verificación para una asignatura ofrecida por el estudiante.
   * Admite DTO { subject_id }, (subjectId) o (tutorId, subjectId).
   */
  async createVerificationRequest(
    arg1: string | CreateVerificationRequestDTO,
    arg2?: string
  ): Promise<TutorVerificationRequest> {
    const subjectId = typeof arg1 === 'object' ? arg1.subject_id : (arg2 || arg1);

    try {
      const data = await apiClient.post<TutorVerificationRequest>(API_ENDPOINTS.VERIFICATION.REQUESTS, {
        subject_id: subjectId,
      });
      return data;
    } catch (apiErr: any) {
      console.error('[verificationService] Error en createVerificationRequest:', apiErr);
      throw new Error(apiErr?.message || 'No fue posible crear la solicitud de verificación');
    }
  },

  /**
   * Obtiene todas las solicitudes de verificación realizadas por el usuario en sesión a través del backend.
   */
  async getMyVerificationRequests(): Promise<TutorVerificationRequest[]> {
    return apiClient.get(API_ENDPOINTS.VERIFICATION.MY_REQUESTS);
  },

  /**
   * Obtiene la lista de solicitudes de verificación pendientes de revisión para el validador académico.
   */
  async getVerificationRequestsForValidator(): Promise<TutorVerificationRequest[]> {
    return apiClient.get(API_ENDPOINTS.VERIFICATION.FOR_VALIDATOR);
  },

  /**
   * Concede acreditación mediante evaluación del Bot en el backend propio (exige score >= 70%)
   */
  async startAssessment(subjectId: string): Promise<ServerAssessment> {
    return apiClient.post<ServerAssessment>(API_ENDPOINTS.VERIFICATION.ATTEMPTS, { subject_id: subjectId });
  },

  async answerAssessment(attemptId: string, questionId: string, answer: string): Promise<ServerAssessmentAnswer> {
    return apiClient.post<ServerAssessmentAnswer>(API_ENDPOINTS.VERIFICATION.ANSWERS(attemptId), { question_id: questionId, answer });
  },

  async botGrant(params: { attempt_id: string }): Promise<{ subject_id: string; level: 'basic'; score: number }> {
    return apiClient.post(API_ENDPOINTS.VERIFICATION.BOT_GRANT, params);
  },

  async requestTeacherEndorsement(params: { subject_id: string; professor_name: string; professor_email: string; message: string }) {
    return apiClient.post(API_ENDPOINTS.VERIFICATION.ENDORSEMENTS, params);
  },

  /**
   * Asigna un caso o ejercicio práctico a una solicitud (Operación exclusiva del validador docente).
   */
  async assignPracticalExercise(
    requestId: string,
    practicalExerciseTitle: string
  ): Promise<TutorVerificationRequest> {
    const trimmedTitle = practicalExerciseTitle?.trim();
    if (!trimmedTitle) {
      throw new Error('El título o descripción del ejercicio práctico no puede estar vacío');
    }

    try {
      const data = await apiClient.post<TutorVerificationRequest>(
        API_ENDPOINTS.VERIFICATION.PRACTICAL_EXERCISE(requestId),
        { practical_exercise_title: trimmedTitle }
      );
      return data;
    } catch (apiErr: any) {
      console.error('[verificationService] Error en assignPracticalExercise:', apiErr);
      throw new Error(apiErr?.message || 'No fue posible asignar el ejercicio práctico');
    }
  },

  /**
   * Envía la entrega práctica y notas de defensa conceptual (Operación del estudiante postulante).
   */
  async submitPracticalEvaluation(
    requestId: string,
    dto: SubmitPracticalEvaluationDTO
  ): Promise<TutorVerificationRequest> {
    const submission = dto.practical_submission?.trim();
    const defense = dto.defense_notes?.trim();

    if (!submission) {
      throw new Error('Debes incluir la entrega práctica (solución técnica o enlace de repositorio)');
    }
    if (!defense) {
      throw new Error('Debes incluir la justificación conceptual y defensa de tu solución');
    }

    try {
      const data = await apiClient.post<TutorVerificationRequest>(
        API_ENDPOINTS.VERIFICATION.PRACTICAL_SUBMIT(requestId),
        dto
      );
      return data;
    } catch (apiErr: any) {
      console.error('[verificationService] Error en submitPracticalEvaluation:', apiErr);
      throw new Error(apiErr?.message || 'No fue posible enviar la entrega de evaluación práctica');
    }
  },

  /**
   * Dictamina y resuelve una solicitud de verificación (Operación exclusiva del validador docente).
   */
  async reviewVerificationRequest(
    requestId: string,
    dto: ReviewVerificationRequestDTO
  ): Promise<TutorVerificationRequest> {
    const validStatuses = ['approved', 'rejected', 'requires_reevaluation'];
    if (!validStatuses.includes(dto.status)) {
      throw new Error('El estado resolutivo indicado no es válido');
    }

    const feedback = dto.reviewer_feedback?.trim();
    if (!feedback) {
      throw new Error('Debes proporcionar retroalimentación pedagógica al dictaminar la solicitud');
    }

    try {
      const data = await apiClient.post<TutorVerificationRequest>(
        API_ENDPOINTS.VERIFICATION.REVIEW(requestId),
        dto
      );
      return data;
    } catch (apiErr: any) {
      console.error('[verificationService] Error en reviewVerificationRequest:', apiErr);
      throw new Error(apiErr?.message || 'No fue posible registrar el dictamen de verificación');
    }
  },

  /**
   * Consulta si un tutor está verificado en una asignatura específica consultando profile_offered_subjects.
   */
  async isTutorVerifiedForSubject(tutorId: string, subjectId: string): Promise<boolean> {
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
   * Cancela una solicitud en estado 'pending' creada por el propio usuario a través del backend propio.
   */
  async cancelPendingRequest(requestId: string): Promise<void> {
    try {
      await apiClient.delete(API_ENDPOINTS.VERIFICATION.REQUEST_BY_ID(requestId));
    } catch (apiErr: any) {
      console.error('[verificationService] Error en cancelPendingRequest:', apiErr);
      throw new Error(apiErr?.message || 'No fue posible cancelar la solicitud de verificación');
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

    // Ruta segura en el bucket privado estructurada por usuario y solicitud (anti path-traversal)
    const sanitizedFileName = file.name.replace(/\.\./g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
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
   * Persiste en la base de datos la información extraída del certificado a través del backend propio.
   */
  async saveCertificateExtraction(
    requestId: string,
    dto: SaveCertificateExtractionDTO
  ): Promise<TutorVerificationRequest> {
    try {
      const data = await apiClient.post<TutorVerificationRequest>(
        API_ENDPOINTS.VERIFICATION.CERTIFICATE(requestId),
        dto
      );
      return data;
    } catch (apiErr: any) {
      console.error('[verificationService] Error en saveCertificateExtraction:', apiErr);
      throw new Error(apiErr?.message || 'No fue posible registrar los datos del certificado');
    }
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

  getMyInclusiveAccreditation(): Promise<InclusiveTutorAccreditation | null> {
    return apiClient.get(API_ENDPOINTS.VERIFICATION.INCLUSIVE_ME);
  },

  requestInclusiveAccreditation(params: { training_name: string; evidence_notes?: string }): Promise<InclusiveTutorAccreditation> {
    return apiClient.post(API_ENDPOINTS.VERIFICATION.INCLUSIVE_CREATE, params);
  },

  getInclusiveAccreditationsForValidator(): Promise<InclusiveTutorAccreditation[]> {
    return apiClient.get(API_ENDPOINTS.VERIFICATION.INCLUSIVE_VALIDATOR);
  },

  reviewInclusiveAccreditation(id: string, status: 'approved' | 'rejected' | 'revoked'): Promise<InclusiveTutorAccreditation> {
    return apiClient.patch(API_ENDPOINTS.VERIFICATION.INCLUSIVE_REVIEW(id), { status });
  },
};
