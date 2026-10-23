import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';

export const tutoringBackendService = {
  async getAvailableTutors(filters?: { subjectId?: string; search?: string; onlyVerified?: boolean }) {
    let query = supabasePublic
      .from('profiles')
      .select(`
        *,
        profile_offered_subjects (
          profile_id,
          subject_id,
          level,
          description,
          is_verified,
          verified_at,
          subject:subjects (
            id,
            name,
            category,
            is_pilot
          )
        )
      `)
      .eq('available_for_tutoring', true);

    const { data: profiles, error } = await query;
    if (error) {
      throw new Error(`Error consultando tutores disponibles: ${error.message}`);
    }

    if (!profiles) return [];

    let filtered = profiles.filter(
      (p) => p.profile_offered_subjects && p.profile_offered_subjects.length > 0
    );

    if (filters?.subjectId && filters.subjectId !== 'all') {
      filtered = filtered.filter((p) =>
        p.profile_offered_subjects.some(
          (pos: any) => pos.subject_id === filters.subjectId || pos.subject?.id === filters.subjectId
        )
      );
    }

    if (filters?.onlyVerified) {
      filtered = filtered.filter((p) =>
        p.profile_offered_subjects.some((pos: any) => pos.is_verified)
      );
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const nameMatch = `${p.first_name || ''} ${p.last_name || ''} ${p.display_name || ''}`
          .toLowerCase()
          .includes(q);
        const careerMatch = (p.career || '').toLowerCase().includes(q);
        const subMatch = p.profile_offered_subjects.some((pos: any) =>
          pos.subject?.name?.toLowerCase().includes(q)
        );
        return nameMatch || careerMatch || subMatch;
      });
    }

    return filtered;
  },

  async requestSession(
    user: AuthenticatedUser,
    token: string,
    data: {
      tutor_id: string;
      subject_id: string;
      scheduled_at: string;
      duration_minutes: number;
      modality: string;
      notes?: string;
    }
  ) {
    // Regla de negocio 1: El estudiante no puede solicitarse tutoría a sí mismo
    if (data.tutor_id === user.id) {
      throw new Error('No puedes agendar una tutoría contigo mismo.');
    }

    // Regla de negocio 2: La fecha programada debe ser futura
    const scheduledDate = new Date(data.scheduled_at);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now() - 5 * 60 * 1000) {
      throw new Error('La fecha y hora de la tutoría deben ser en el futuro.');
    }

    const client = getAuthenticatedSupabase(token);

    // Verificar disponibilidad del tutor
    const { data: tutorProfile, error: tutorError } = await client
      .from('profiles')
      .select('id, available_for_tutoring')
      .eq('id', data.tutor_id)
      .maybeSingle();

    if (tutorError || !tutorProfile) {
      throw new Error('El tutor seleccionado no existe o no está registrado.');
    }

    if (!tutorProfile.available_for_tutoring) {
      throw new Error('El tutor seleccionado no está disponible actualmente para recibir solicitudes.');
    }

    const payload = {
      student_id: user.id,
      tutor_id: data.tutor_id,
      subject_id: data.subject_id,
      scheduled_at: data.scheduled_at,
      duration_minutes: data.duration_minutes,
      modality: data.modality,
      notes: data.notes?.trim() || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: session, error: insertError } = await client
      .from('tutoring_sessions')
      .insert(payload)
      .select(`
        *,
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        student:profiles!tutoring_sessions_student_id_fkey(*),
        subject:subjects(*)
      `)
      .single();

    if (insertError) {
      throw new Error(`Error al solicitar tutoría: ${insertError.message}`);
    }

    return session;
  },

  async updateSessionStatus(
    user: AuthenticatedUser,
    token: string,
    sessionId: string,
    newStatus: 'accepted' | 'rejected' | 'completed' | 'cancelled',
    cancellationReason?: string
  ) {
    const client = getAuthenticatedSupabase(token);

    // Obtener la sesión existente para validar permisos y transición de estados
    const { data: session, error: fetchError } = await client
      .from('tutoring_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (fetchError || !session) {
      throw new Error('La sesión de tutoría no fue encontrada.');
    }

    const isTutor = session.tutor_id === user.id;
    const isStudent = session.student_id === user.id;

    if (!isTutor && !isStudent) {
      throw new Error('Acceso denegado: No perteneces a esta sesión de tutoría.');
    }

    // Regla de autorización estricta:
    // Solo el tutor puede aceptar, rechazar o marcar como completada la clase
    if ((newStatus === 'accepted' || newStatus === 'rejected' || newStatus === 'completed') && !isTutor) {
      throw new Error('Operación denegada: Solo el tutor asignado puede aceptar o completar la tutoría.');
    }

    // Si se cancela, cualquiera de las dos partes puede hacerlo si la sesión está pendiente o aceptada
    if (newStatus === 'cancelled') {
      if (session.status === 'completed') {
        throw new Error('No es posible cancelar una sesión que ya ha sido completada.');
      }
    }

    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (cancellationReason) {
      updatePayload.cancellation_reason = cancellationReason.trim();
    }

    const { data: updated, error: updateError } = await client
      .from('tutoring_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select(`
        *,
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        student:profiles!tutoring_sessions_student_id_fkey(*),
        subject:subjects(*)
      `)
      .single();

    if (updateError) {
      throw new Error(`Error al actualizar estado de la sesión: ${updateError.message}`);
    }

    return updated;
  },

  async submitReview(
    user: AuthenticatedUser,
    token: string,
    sessionId: string,
    reviewData: {
      rating: number;
      comment: string;
      punctuality_rating?: number;
      clarity_rating?: number;
      empathy_rating?: number;
    }
  ) {
    const client = getAuthenticatedSupabase(token);

    // Verificar que la sesión exista y pertenezca al estudiante
    const { data: session, error: sessionError } = await client
      .from('tutoring_sessions')
      .select('id, student_id, tutor_id, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      throw new Error('Sesión de tutoría no encontrada.');
    }

    if (session.student_id !== user.id) {
      throw new Error('Operación denegada: Solo el estudiante que recibió la tutoría puede calificarla.');
    }

    if (session.status !== 'completed') {
      throw new Error('Solo puedes calificar una tutoría cuando haya concluido exitosamente.');
    }

    const payload = {
      session_id: sessionId,
      student_id: user.id,
      tutor_id: session.tutor_id,
      rating: reviewData.rating,
      comment: reviewData.comment.trim(),
      punctuality_rating: reviewData.punctuality_rating || null,
      clarity_rating: reviewData.clarity_rating || null,
      empathy_rating: reviewData.empathy_rating || null,
      created_at: new Date().toISOString(),
    };

    const { data: review, error: insertError } = await client
      .from('tutoring_reviews')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error('Ya has emitido una evaluación para esta tutoría.');
      }
      throw new Error(`Error al registrar la evaluación: ${insertError.message}`);
    }

    return review;
  },

  async registerAttendance(
    user: AuthenticatedUser,
    token: string,
    data: { session_id: string; action: string; elapsed_minutes?: number }
  ) {
    const client = getAuthenticatedSupabase(token);

    const { data: session, error: fetchError } = await client
      .from('tutoring_sessions')
      .select('id, student_id, tutor_id, status')
      .eq('id', data.session_id)
      .maybeSingle();

    if (fetchError || !session) {
      throw new Error('Sesión no encontrada.');
    }

    const isTutor = session.tutor_id === user.id;
    const isStudent = session.student_id === user.id;

    if (!isTutor && !isStudent) {
      throw new Error('No perteneces a esta sesión de aula virtual.');
    }

    // Si el tutor cierra el aula con más de 15 minutos, certificar asistencia
    if (isTutor && data.action === 'leave' && (data.elapsed_minutes || 0) >= 15) {
      await client
        .from('tutoring_sessions')
        .update({
          attendance_verified: true,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.session_id);
    }

    return {
      recorded: true,
      session_id: data.session_id,
      user_id: user.id,
      role: isTutor ? 'tutor' : 'student',
      action: data.action,
    };
  },

  async getMySessions(user: AuthenticatedUser, token: string, role: 'student' | 'tutor') {
    const client = getAuthenticatedSupabase(token);
    const filterField = role === 'student' ? 'student_id' : 'tutor_id';

    const { data, error } = await client
      .from('tutoring_sessions')
      .select(`
        *,
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        student:profiles!tutoring_sessions_student_id_fkey(*),
        subject:subjects(*)
      `)
      .eq(filterField, user.id)
      .order('scheduled_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener sesiones: ${error.message}`);
    }

    return data || [];
  },
};
