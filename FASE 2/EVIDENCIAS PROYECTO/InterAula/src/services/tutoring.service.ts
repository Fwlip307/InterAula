import { supabase } from '../lib/supabase';
import type { Profile, OfferedSubject } from '../types/profile';
import type {
  TutoringSession,
  CreateTutoringSessionDTO,
  TutoringReview,
  CreateTutoringReviewDTO,
  TutorStatistics,
  UserBadge,
  SessionStatus,
  SessionAttendanceResult,
} from '../types/tutoring';
import { workshopService } from './workshop.service';

/**
 * Tutor disponible con materias ofrecidas, estadísticas e insignias.
 */
export interface AvailableTutor {
  profile: Profile;
  offeredSubjects: OfferedSubject[];
  statistics: TutorStatistics | null;
  badges: UserBadge[];
}

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

export const tutoringService = {
  /**
   * Obtiene la lista de tutores disponibles (available_for_tutoring = true)
   * que ofrezcan al menos una materia, con filtros opcionales de materia y búsqueda.
   */
  async getAvailableTutors(filters?: {
    subjectId?: string;
    search?: string;
    onlyVerified?: boolean;
  }): Promise<AvailableTutor[]> {
    try {
      // 1. Consultar perfiles que están activos para tutorías
      let query = supabase
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
              is_pilot,
              pilot_priority
            )
          )
        `)
        .eq('available_for_tutoring', true);

      const { data: profilesData } = await query;

      // 2. Filtrar solo los que tienen al menos una materia ofrecida válida
      let filtered = (profilesData || []).filter((p: any) => {
        const offered = (p.profile_offered_subjects || []) as OfferedSubject[];
        if (offered.length === 0) return false;

        // Si hay filtro por materia específica
        if (filters?.subjectId && filters.subjectId !== 'all') {
          const teachesSubject = offered.some((o) => o.subject_id === filters.subjectId);
          if (!teachesSubject) return false;
        }

        // Si hay filtro de tutores verificados
        if (filters?.onlyVerified) {
          const hasVerified = offered.some((o) =>
            o.is_verified === true && (!filters.subjectId || filters.subjectId === 'all' || o.subject_id === filters.subjectId)
          );
          if (!hasVerified) return false;
        }

        // Si hay filtro de texto por nombre o materia
        if (filters?.search && filters.search.trim() !== '') {
          const term = filters.search.toLowerCase().trim();
          const fullName = `${p.first_name || ''} ${p.last_name || ''} ${p.display_name || ''}`.toLowerCase();
          const matchesSubject = offered.some((o) =>
            o.subject?.name?.toLowerCase().includes(term) || o.subject?.category?.toLowerCase().includes(term)
          );
          if (!fullName.includes(term) && !matchesSubject) return false;
        }

        return true;
      });

      const profileIds = filtered.map((p: any) => p.id);
      const statsMap = new Map<string, TutorStatistics>();
      const badgesMap = new Map<string, UserBadge[]>();

      if (profileIds.length > 0) {
        // 3. Consultar estadísticas de los tutores desde la vista tutor_statistics_view
        const { data: statsData } = await supabase
          .from('tutor_statistics_view')
          .select('*')
          .in('profile_id', profileIds);

        if (statsData) {
          statsData.forEach((s: any) => statsMap.set(s.profile_id, s as TutorStatistics));
        }

        // 4. Consultar insignias obtenidas
        const { data: badgesData } = await supabase
          .from('user_badges')
          .select('*, badge:badges(*)')
          .in('profile_id', profileIds);

        if (badgesData) {
          badgesData.forEach((ub: any) => {
            const list = badgesMap.get(ub.profile_id) || [];
            list.push(ub as UserBadge);
            badgesMap.set(ub.profile_id, list);
          });
        }
      }

      // 5. Ensamblar estructura limpia
      const results: AvailableTutor[] = filtered.map((p: any) => ({
        profile: p as Profile,
        offeredSubjects: (p.profile_offered_subjects || []) as OfferedSubject[],
        statistics: statsMap.get(p.id) || null,
        badges: badgesMap.get(p.id) || [],
      }));

      return results;
    } catch (err: any) {
      console.error('[tutoringService] Error inesperado en getAvailableTutors:', err);
      return [];
    }
  },

  /**
   * Solicita una sesión de tutoría a un tutor disponible.
   * Maneja timezone UTC enviando fecha en ISO 8601.
   */
  async requestTutoring(dto: CreateTutoringSessionDTO): Promise<TutoringSession> {
    const user = await getRequiredAuthUser();

    // Validaciones preventivas de capa de negocio
    if (user.id === dto.tutor_id) {
      throw new Error('No puedes solicitar una tutoría a ti mismo');
    }

    const scheduledDate = new Date(dto.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('La fecha y hora indicada no es válida');
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw new Error('La fecha y hora de la tutoría debe ser futura');
    }

    // Inserción en la base de datos protegida por RLS y Triggers
    const { data, error } = await supabase
      .from('tutoring_sessions')
      .insert({
        student_id: user.id,
        tutor_id: dto.tutor_id,
        subject_id: dto.subject_id,
        scheduled_at: scheduledDate.toISOString(),
        duration_minutes: dto.duration_minutes || 60,
        modality: dto.modality,
        location_or_link: dto.location_or_link?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: 'pending',
      })
      .select(`
        *,
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        subject:subjects(*)
      `)
      .single();

    if (error) {
      console.error('[tutoringService] Error en requestTutoring:', error.message);
      throw new Error(error.message || 'No fue posible solicitar la tutoría');
    }

    return data as TutoringSession;
  },

  /**
   * Obtiene las sesiones donde el usuario es el estudiante solicitante.
   */
  async getMySessionsAsStudent(): Promise<TutoringSession[]> {
    const user = await getRequiredAuthUser();

    const { data, error } = await supabase
      .from('tutoring_sessions')
      .select(`
        *,
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        subject:subjects(*),
        review:tutoring_reviews(*)
      `)
      .eq('student_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.error('[tutoringService] Error en getMySessionsAsStudent:', error.message);
      throw new Error('No fue posible cargar tus tutorías como estudiante');
    }

    return (data || []).map((session: any) => ({
      ...session,
      review: Array.isArray(session.review) ? session.review[0] || null : session.review,
    })) as TutoringSession[];
  },

  /**
   * Obtiene las solicitudes de tutoría donde el usuario es el tutor asignado.
   */
  async getMySessionsAsTutor(): Promise<TutoringSession[]> {
    const user = await getRequiredAuthUser();

    const { data } = await supabase
      .from('tutoring_sessions')
      .select(`
        *,
        student:profiles!tutoring_sessions_student_id_fkey(*),
        subject:subjects(*),
        review:tutoring_reviews(*)
      `)
      .eq('tutor_id', user.id)
      .order('scheduled_at', { ascending: false });

    return (data || []).map((session: any) => ({
      ...session,
      review: Array.isArray(session.review) ? session.review[0] || null : session.review,
    })) as TutoringSession[];
  },

  /**
   * Actualiza el estado de una sesión (aceptar, rechazar, cancelar, completar).
   * La validación estricta de quién puede ejecutar qué transición la realiza PostgreSQL.
   */
  async updateSessionStatus(
    sessionId: string,
    newStatus: SessionStatus,
    cancellationReason?: string
  ): Promise<TutoringSession> {
    await getRequiredAuthUser();

    const updatePayload: Record<string, any> = {
      status: newStatus,
    };

    if (cancellationReason?.trim()) {
      updatePayload.cancellation_reason = cancellationReason.trim();
    }

    const { data, error } = await supabase
      .from('tutoring_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select(`
        *,
        student:profiles!tutoring_sessions_student_id_fkey(*),
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        subject:subjects(*),
        review:tutoring_reviews(*)
      `)
      .single();

    if (error) {
      console.error('[tutoringService] Error en updateSessionStatus:', error.message);
      throw new Error(error.message || 'No fue posible actualizar el estado de la tutoría');
    }

    return {
      ...data,
      review: Array.isArray(data.review) ? data.review[0] || null : data.review,
    } as TutoringSession;
  },

  /**
   * Envía una evaluación académica para una tutoría completada.
   * El promedio general es calculado y almacenado automáticamente por PostgreSQL.
   */
  async submitReview(dto: CreateTutoringReviewDTO): Promise<TutoringReview> {
    const user = await getRequiredAuthUser();

    // Validar rangos 1-10 en capa de negocio
    const comm = Math.round(Number(dto.communication_score));
    const know = Math.round(Number(dto.knowledge_score));
    const punc = Math.round(Number(dto.punctuality_score));

    if (comm < 1 || comm > 10 || know < 1 || know > 10 || punc < 1 || punc > 10) {
      throw new Error('Todas las calificaciones deben ser números enteros entre 1 y 10');
    }

    const { data, error } = await supabase
      .from('tutoring_reviews')
      .insert({
        session_id: dto.session_id,
        student_id: user.id,
        tutor_id: dto.tutor_id,
        communication_score: comm,
        knowledge_score: know,
        punctuality_score: punc,
        comment: dto.comment?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[tutoringService] Error en submitReview:', error.message);
      if (error.code === '23505') {
        throw new Error('Esta tutoría ya ha sido evaluada previamente');
      }
      throw new Error(error.message || 'No fue posible registrar la evaluación');
    }

    return data as TutoringReview;
  },

  /**
   * Obtiene las estadísticas agregadas reales de un tutor desde la vista SQL.
   */
  async getTutorStats(tutorId: string): Promise<TutorStatistics | null> {
    const { data, error } = await supabase
      .from('tutor_statistics_view')
      .select('*')
      .eq('profile_id', tutorId)
      .maybeSingle();

    if (error) {
      console.error('[tutoringService] Error en getTutorStats:', error.message);
      return null;
    }

    return data as TutorStatistics | null;
  },

  /**
   * Obtiene una sesión específica por su ID verificando permisos de participante.
   */
  async getSessionById(sessionId: string): Promise<TutoringSession> {
    const user = await getRequiredAuthUser();

    const { data, error } = await supabase
      .from('tutoring_sessions')
      .select(`
        *,
        student:profiles!tutoring_sessions_student_id_fkey(*),
        tutor:profiles!tutoring_sessions_tutor_id_fkey(*),
        subject:subjects(*),
        review:tutoring_reviews(*)
      `)
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      console.error('[tutoringService] Error en getSessionById:', error?.message);
      throw new Error('No fue posible cargar la sesión de tutoría');
    }

    if (data.student_id !== user.id && data.tutor_id !== user.id) {
      throw new Error('No tienes permisos para acceder a esta sesión');
    }

    return {
      ...data,
      review: Array.isArray(data.review) ? data.review[0] || null : data.review,
    } as TutoringSession;
  },

  /**
   * Registra y audita la asistencia y permanencia en el aula virtual.
   */
  async registerClassroomAttendance(
    sessionId: string,
    action: 'join' | 'heartbeat' | 'leave',
    durationMinutes: number = 0
  ): Promise<SessionAttendanceResult | null> {
    try {
      const { data, error } = await supabase.rpc('register_session_attendance', {
        p_session_id: sessionId,
        p_action: action,
        p_duration_minutes: durationMinutes,
      });

      if (error) {
        // Fallback resiliente si la función RPC aún no está creada en Supabase
        const now = new Date().toISOString();
        const user = await getRequiredAuthUser();
        const { data: session } = await supabase
          .from('tutoring_sessions')
          .select('id, student_id, tutor_id, room_id, student_joined_at, tutor_joined_at, both_connected_at, actual_duration_minutes, attendance_verified')
          .eq('id', sessionId)
          .single();

        if (session) {
          const isStudent = session.student_id === user.id;
          const isTutor = session.tutor_id === user.id;
          const payload: Record<string, any> = { updated_at: now };

          if (action === 'join') {
            if (isStudent && !session.student_joined_at) payload.student_joined_at = now;
            if (isTutor && !session.tutor_joined_at) payload.tutor_joined_at = now;
            if ((isStudent && session.tutor_joined_at) || (isTutor && session.student_joined_at)) {
              payload.both_connected_at = now;
              payload.attendance_verified = true;
            }
          } else if (durationMinutes > 0) {
            payload.actual_duration_minutes = Math.max(session.actual_duration_minutes || 0, durationMinutes);
          }

          const { data: updated } = await supabase
            .from('tutoring_sessions')
            .update(payload)
            .eq('id', sessionId)
            .select()
            .single();

          if (updated) {
            return {
              session_id: updated.id,
              room_id: updated.room_id || `ia-aula-${sessionId.replace(/-/g, '').slice(0, 10)}`,
              student_joined_at: updated.student_joined_at,
              tutor_joined_at: updated.tutor_joined_at,
              both_connected_at: updated.both_connected_at,
              actual_duration_minutes: updated.actual_duration_minutes || 0,
              attendance_verified: updated.attendance_verified || false,
            };
          }
        }
        return null;
      }

      return data as SessionAttendanceResult;
    } catch (err: any) {
      console.error('[tutoringService] Error en registerClassroomAttendance:', err);
      return null;
    }
  },

  /**
   * Obtiene las insignias académicas otorgadas a un perfil.
   */
  async getUserBadges(profileId: string): Promise<UserBadge[]> {
    const { data, error } = await supabase
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('profile_id', profileId)
      .order('awarded_at', { ascending: true });

    if (error) {
      console.error('[tutoringService] Error en getUserBadges:', error.message);
      return [];
    }

    return (data || []) as UserBadge[];
  },

  // Delegación a workshopService para modularidad y persistencia en Supabase
  createWorkshop: workshopService.createWorkshop.bind(workshopService),
  getUpcomingWorkshops: workshopService.getUpcomingWorkshops.bind(workshopService),
  getWorkshopById: workshopService.getWorkshopById.bind(workshopService),
  enrollInWorkshop: workshopService.enrollInWorkshop.bind(workshopService),
  unenrollFromWorkshop: workshopService.unenrollFromWorkshop.bind(workshopService),
  updateWorkshopStatus: workshopService.updateWorkshopStatus.bind(workshopService),
  deleteWorkshop: workshopService.deleteWorkshop.bind(workshopService),
  getMyWorkshopsAsStudent: workshopService.getMyWorkshopsAsStudent.bind(workshopService),
  getMyWorkshopsAsTutor: workshopService.getMyWorkshopsAsTutor.bind(workshopService),
};
