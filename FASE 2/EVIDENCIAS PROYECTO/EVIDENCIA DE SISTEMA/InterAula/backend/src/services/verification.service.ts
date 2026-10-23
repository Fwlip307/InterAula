import { getAuthenticatedSupabase, getAdminSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';
import { BUSINESS_RULES } from '../constants/businessRules.js';

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

    return data;
  },

  /**
   * Conceder acreditación tras aprobación de Bot con umbral de seguridad estricto (>= 70%)
   */
  async botGrant(user: AuthenticatedUser, token: string, body: {
    subject_id: string;
    subject_name?: string;
    score: number;
    level: 'basic' | 'intermediate' | 'advanced';
    correct_answers?: number;
    total_questions?: number;
    notes?: string;
  }) {
    const minScore = BUSINESS_RULES.VERIFICATION.MIN_BOT_ACCREDITATION_SCORE;
    if (body.score < minScore) {
      throw new Error(`Puntaje insuficiente (${body.score}%). Se requiere un mínimo de ${minScore}% para acreditarse.`);
    }

    const client = getAuthenticatedSupabase(token);
    const admin = getAdminSupabase();

    // 0. Validar que la asignatura exista en el catálogo oficial
    const { data: subject, error: subErr } = await client
      .from('subjects')
      .select('id, name')
      .eq('id', body.subject_id)
      .maybeSingle();

    if (subErr || !subject) {
      throw new Error('La asignatura especificada no existe en el catálogo.');
    }

    // 1. Asegurar o actualizar materia ofrecida como verificada
    const { data: existingOffered } = await client
      .from('profile_offered_subjects')
      .select('*')
      .eq('profile_id', user.id)
      .eq('subject_id', body.subject_id)
      .maybeSingle();

    if (existingOffered) {
      await admin
        .from('profile_offered_subjects')
        .update({
          is_verified: true,
          level: body.level,
          description: body.notes || `Acreditado con ${body.score}% en Evaluación Técnica`,
        })
        .eq('profile_id', user.id)
        .eq('subject_id', body.subject_id);
    } else {
      await admin
        .from('profile_offered_subjects')
        .insert({
          profile_id: user.id,
          subject_id: body.subject_id,
          level: body.level,
          description: body.notes || `Acreditado con ${body.score}% en Evaluación Técnica`,
          is_verified: true,
        });
    }

    // 2. Registrar solicitud resuelta
    const { data: requestRecord, error: _reqErr } = await admin
      .from('tutor_verification_requests')
      .insert({
        tutor_id: user.id,
        subject_id: body.subject_id,
        status: 'approved',
        practical_exercise_title: 'Evaluación Técnica de Contenidos InterAula Bot',
        defense_notes: `Aprobado con nota equivalente ${(body.score / 10).toFixed(1)} (${body.score}%)`,
        reviewer_feedback: `Acreditación automatizada por Bot Evaluador. Calificación: ${body.score}%. Nivel otorgado: ${body.level}.`,
        reviewed_at: new Date().toISOString(),
        document_filename: 'evaluacion_tecnica_bot.json',
        document_extraction_status: 'completed',
        matched_grade: Number((body.score / 10).toFixed(1)),
        calculated_level: body.level,
      })
      .select(VERIFICATION_REQUEST_SELECT)
      .maybeSingle();

    return {
      success: true,
      message: 'Acreditación concedida exitosamente',
      score: body.score,
      level: body.level,
      request: requestRecord,
    };
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

    return data || [];
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
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al consultar solicitudes para validador: ${error.message}`);
    }

    return data || [];
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

    return data;
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

    return data;
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
    const admin = getAdminSupabase();

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

    // Si fue aprobada, actualizar la materia ofrecida
    if (dto.status === 'approved') {
      await admin
        .from('profile_offered_subjects')
        .update({ is_verified: true })
        .eq('profile_id', req.tutor_id)
        .eq('subject_id', req.subject_id);
    }

    return data;
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

    return data;
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
