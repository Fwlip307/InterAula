import { attachProfiles } from './remote/database.js';
import { assessmentService } from './assessment.service.js';
import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';

const VERIFICATION_REQUEST_SELECT = '*, subject:subjects(*)';
async function decorateVerification(value: any, token: string): Promise<any> {
  const rows = Array.isArray(value) ? value : [value];
  const tutors = await attachProfiles(rows, 'tutor_id', 'tutor', token);
  const joined = await attachProfiles(tutors, 'reviewed_by', 'reviewer', token);
  return Array.isArray(value) ? joined : joined[0];
}

export const verificationBackendService = {
  /**
   * Crear solicitud de acreditación
   */
  async createVerificationRequest(user: AuthenticatedUser, token: string, subjectId: string) {
    const client = getAuthenticatedSupabase(token);

    // 1. Validar que la asignatura esté ofrecida por el postulante
    const { data: offered, error: offeredError } = await client
      .from('profile_offered_subjects')
      .select('is_verified')
      .eq('profile_id', user.id)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (offeredError) {
      throw new Error(`Error al consultar materia ofrecida: ${offeredError.message}`);
    }

    if (!offered) {
      throw new Error('Debes registrar esta asignatura en tu lista de materias ofrecidas antes de solicitar su verificación');
    }

    if (offered.is_verified) {
      throw new Error('Esta asignatura ya cuenta con la verificación académica aprobada');
    }

    // 2. Insertar solicitud
    const { data, error } = await client
      .from('tutor_verification_requests')
      .insert({
        tutor_id: user.id,
        subject_id: subjectId,
        status: 'pending',
      })
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('idx_active_verification_per_tutor_subject')) {
        throw new Error('Ya tienes una solicitud de verificación activa o aprobada para esta asignatura');
      }
      throw new Error(error.message || 'No fue posible crear la solicitud de verificación');
    }

    return decorateVerification(data, token);
  },

  /**
   * Conceder acreditación tras aprobación de Bot con umbral de seguridad estricto (>= 70%)
   */
  async botGrant(user: AuthenticatedUser, _token: string, body: { attempt_id: string }) {
    return assessmentService.grant(user, body.attempt_id);
  },

  /**
   * Obtener solicitudes del usuario actual
   */
  async getMyVerificationRequests(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('tutor_verification_requests')
      .select(VERIFICATION_REQUEST_SELECT)
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al consultar solicitudes: ${error.message}`);
    }

    return decorateVerification(data || [], token);
  },

  /**
   * Obtener solicitudes pendientes para el panel de validador docente
   */
  async getVerificationRequestsForValidator(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);

    // Verificar si el usuario es validador
    const { data: isVal } = await client
      .from('academic_validators')
      .select('profile_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!isVal && user.role !== 'admin' && user.role !== 'teacher') {
      throw new Error('Acceso denegado: Se requiere rol de validador académico');
    }

    const { data, error } = await client
      .from('tutor_verification_requests')
      .select(VERIFICATION_REQUEST_SELECT)
      .or(`assigned_validator_id.is.null,assigned_validator_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al consultar solicitudes para validador: ${error.message}`);
    }

    return decorateVerification(data || [], token);
  },

  /**
   * Asignar ejercicio práctico (operación de validador)
   */
  async assignPracticalExercise(user: AuthenticatedUser, token: string, requestId: string, title: string) {
    const client = getAuthenticatedSupabase(token);

    // Verificación de rol docente validador
    if (user.role !== 'admin' && user.role !== 'teacher') {
      const { data: isVal } = await client
        .from('academic_validators')
        .select('profile_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!isVal) {
        throw new Error('Acceso denegado: Se requiere rol de docente validador académico.');
      }
    }

    const { data, error } = await client
      .from('tutor_verification_requests')
      .update({
        practical_exercise_title: title.trim(),
        status: 'practical_evaluation',
      })
      .eq('id', requestId)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message || 'No fue posible asignar el ejercicio práctico');
    }

    return decorateVerification(data, token);
  },

  /**
   * Enviar entrega práctica y notas de defensa (operación del tutor postulante)
   */
  async submitPracticalEvaluation(
    user: AuthenticatedUser,
    token: string,
    requestId: string,
    dto: { practical_submission: string; defense_notes: string }
  ) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('tutor_verification_requests')
      .update({
        practical_submission: dto.practical_submission.trim(),
        defense_notes: dto.defense_notes.trim(),
      })
      .eq('id', requestId)
      .eq('tutor_id', user.id)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message || 'No fue posible enviar la entrega de evaluación práctica');
    }

    return decorateVerification(data, token);
  },

  /**
   * Dictaminar y resolver solicitud de verificación (exclusivo de validador)
   */
  async reviewVerificationRequest(
    user: AuthenticatedUser,
    token: string,
    requestId: string,
    dto: { status: 'approved' | 'rejected' | 'requires_reevaluation'; reviewer_feedback: string; practical_exercise_title?: string }
  ) {
    const client = getAuthenticatedSupabase(token);

    // Obtener solicitud
    const { data: req, error: fetchErr } = await client
      .from('tutor_verification_requests')
      .select('tutor_id, subject_id')
      .eq('id', requestId)
      .single();

    if (fetchErr || !req) {
      throw new Error('Solicitud no encontrada');
    }

    // Verificación de rol docente validador
    if (user.role !== 'admin' && user.role !== 'teacher') {
      const { data: isVal } = await client
        .from('academic_validators')
        .select('profile_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!isVal) {
        throw new Error('Acceso denegado: Se requiere rol de docente validador académico para dictaminar solicitudes.');
      }
    }

    // Regla de integridad académica: un validador no puede evaluar su propia postulación
    if (req.tutor_id === user.id) {
      throw new Error('Un docente validador no puede evaluar ni dictaminar su propia postulación');
    }

    const payload: Record<string, any> = {
      status: dto.status,
      reviewer_feedback: dto.reviewer_feedback.trim(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (dto.practical_exercise_title) {
      payload.practical_exercise_title = dto.practical_exercise_title.trim();
    }

    const { data, error } = await client
      .from('tutor_verification_requests')
      .update(payload)
      .eq('id', requestId)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message || 'Error al dictaminar la solicitud');
    }

    return decorateVerification(data, token);
  },

  /**
   * Guardar datos de extracción del certificado
   */
  async saveCertificateExtraction(user: AuthenticatedUser, token: string, requestId: string, dto: any) {
    const client = getAuthenticatedSupabase(token);

    const payload = {
      document_path: dto.document_path,
      document_filename: dto.document_filename,
      document_size_bytes: dto.document_size_bytes,
      document_uploaded_at: new Date().toISOString(),
      document_extraction_status: dto.document_extraction_status || 'completed',
      document_extracted_data: dto.document_extracted_data || null,
      matched_subject_name: dto.matched_subject_name || null,
      matched_grade: dto.matched_grade || null,
      matched_status: dto.matched_status || null,
      calculated_level: dto.calculated_level || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('tutor_verification_requests')
      .update(payload)
      .eq('id', requestId)
      .eq('tutor_id', user.id)
      .select(VERIFICATION_REQUEST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message || 'No fue posible registrar los datos del certificado');
    }

    return decorateVerification(data, token);
  },

  /**
   * Cancelar solicitud de verificación pendiente
   */
  async cancelPendingRequest(user: AuthenticatedUser, token: string, requestId: string) {
    const client = getAuthenticatedSupabase(token);

    const { error } = await client
      .from('tutor_verification_requests')
      .delete()
      .eq('id', requestId)
      .eq('tutor_id', user.id)
      .eq('status', 'pending');

    if (error) {
      throw new Error(error.message || 'No fue posible cancelar la solicitud');
    }

    return { success: true, message: 'Solicitud cancelada' };
  },

  /**
   * Verificar si un perfil es validador académico
   */
  async isAcademicValidator(userId: string) {
    const { data } = await supabasePublic
      .from('academic_validators')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle();

    return Boolean(data);
  },
};
