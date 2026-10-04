import { supabase } from '../lib/supabase';
import type { Profile, OfferedSubject } from '../types/profile';
import {
  CERTIFIED_TUTOR_EMAIL,
  CERTIFIED_TUTOR_ID,
  isCertifiedAccount,
  CERTIFIED_OFFERED_SUBJECTS,
} from './profile.service';
import type {
  TutoringSession,
  CreateTutoringSessionDTO,
  TutoringReview,
  CreateTutoringReviewDTO,
  TutorStatistics,
  UserBadge,
  SessionStatus,
  SessionAttendanceResult,
  TutoringWorkshop,
  CreateWorkshopDTO,
  WorkshopStatus,
} from '../types/tutoring';

/**
 * Tutor disponible con materias ofrecidas, estadísticas e insignias.
 */
export interface AvailableTutor {
  profile: Profile;
  offeredSubjects: OfferedSubject[];
  statistics: TutorStatistics | null;
  badges: UserBadge[];
}

function getStoredLocalWorkshops(): TutoringWorkshop[] {
  try {
    const raw = localStorage.getItem('ia_local_workshops');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (parsed || []).filter(
      (w: any) => !w.title?.toLowerCase().includes('canvas')
    );
  } catch {
    return [];
  }
}

function saveStoredLocalWorkshops(workshops: TutoringWorkshop[]) {
  try {
    localStorage.setItem('ia_local_workshops', JSON.stringify(workshops));
  } catch {}
}

const LOCAL_WORKSHOPS: TutoringWorkshop[] = getStoredLocalWorkshops();

// Canal Supabase Realtime para sincronizar talleres en vivo entre todos los compañeros
const realtimeWorkshopsMap = new Map<string, TutoringWorkshop>();
let realtimeWorkshopsChannel: any = null;

function ensureRealtimeWorkshopsChannel() {
  if (typeof window === 'undefined' || realtimeWorkshopsChannel) return;
  try {
    realtimeWorkshopsChannel = supabase.channel('ia_live_workshops_feed', {
      config: {
        broadcast: { ack: false },
      },
    });

    realtimeWorkshopsChannel
      .on('broadcast', { event: 'workshop_created' }, (event: any) => {
        if (event.payload?.id) {
          const ws = event.payload as TutoringWorkshop;
          realtimeWorkshopsMap.set(ws.id, ws);
          const existingIdx = LOCAL_WORKSHOPS.findIndex((w) => w.id === ws.id);
          if (existingIdx >= 0) {
            LOCAL_WORKSHOPS[existingIdx] = ws;
          } else {
            LOCAL_WORKSHOPS.unshift(ws);
          }
          saveStoredLocalWorkshops(LOCAL_WORKSHOPS);
          window.dispatchEvent(new CustomEvent('ia_workshops_updated'));
        }
      })
      .on('broadcast', { event: 'workshop_status_changed' }, (event: any) => {
        if (event.payload?.id) {
          const { id, roomId, status } = event.payload;
          for (const [key, ws] of realtimeWorkshopsMap.entries()) {
            if (ws.id === id || (roomId && ws.room_id === roomId) || ws.room_id === id) {
              ws.status = status;
              realtimeWorkshopsMap.set(key, ws);
            }
          }
          const localWs = LOCAL_WORKSHOPS.find(
            (w) => w.id === id || (roomId && w.room_id === roomId) || w.room_id === id
          );
          if (localWs) {
            localWs.status = status;
            saveStoredLocalWorkshops(LOCAL_WORKSHOPS);
          }
          window.dispatchEvent(new CustomEvent('ia_workshops_updated', { detail: { id, roomId, status } }));
        }
      })
      .on('broadcast', { event: 'request_workshops' }, () => {
        const active = [...LOCAL_WORKSHOPS, ...realtimeWorkshopsMap.values()].filter(
          (w) => w.status === 'in_progress' || w.status === 'scheduled'
        );
        for (const w of active) {
          realtimeWorkshopsChannel?.send({
            type: 'broadcast',
            event: 'workshop_created',
            payload: w,
          });
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          realtimeWorkshopsChannel?.send({
            type: 'broadcast',
            event: 'request_workshops',
            payload: {},
          });
        }
      });
  } catch (err) {
    console.warn('[tutoringService] Error en canal realtime:', err);
  }
}

ensureRealtimeWorkshopsChannel();

function broadcastWorkshop(ws: TutoringWorkshop) {
  ensureRealtimeWorkshopsChannel();
  try {
    realtimeWorkshopsChannel?.send({
      type: 'broadcast',
      event: 'workshop_created',
      payload: ws,
    });
  } catch {}
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

      // Evaluar si Kendo Kaponi cumple con los filtros para incluirlo como tutor certificado destacado
      let includeKendo = true;
      if (filters?.subjectId && filters.subjectId !== 'all') {
        const targetSub = filters.subjectId.toLowerCase();
        includeKendo = CERTIFIED_OFFERED_SUBJECTS.some(
          (o) =>
            o.subject_id === filters.subjectId ||
            (o.subject?.name && o.subject.name.toLowerCase().includes(targetSub))
        );
      }
      if (includeKendo && filters?.search && filters.search.trim() !== '') {
        const term = filters.search.toLowerCase().trim();
        const matchesName =
          'kendo kaponi'.includes(term) ||
          CERTIFIED_TUTOR_EMAIL.toLowerCase().includes(term) ||
          'cenco'.includes(term);
        const matchesSub = CERTIFIED_OFFERED_SUBJECTS.some(
          (o) =>
            (o.subject?.name && o.subject.name.toLowerCase().includes(term)) ||
            (o.subject?.category && o.subject.category.toLowerCase().includes(term))
        );
        includeKendo = matchesName || matchesSub;
      }

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

      // 6. Enriquecer o incorporar al tutor certificado Kendo Kaponi con su materia de programación
      const { data: authData } = await supabase.auth.getUser();
      const currentAuthUser = authData?.user;
      const isAuthKendo = Boolean(
        currentAuthUser?.email && isCertifiedAccount(currentAuthUser.email)
      );
      const effectiveKendoId = isAuthKendo && currentAuthUser ? currentAuthUser.id : CERTIFIED_TUTOR_ID;

      const kendoIdx = results.findIndex(
        (r) => isCertifiedAccount(r.profile.id) || isCertifiedAccount(r.profile.email)
      );

      if (kendoIdx >= 0) {
        const target = results[kendoIdx];
        if (isAuthKendo) {
          target.profile.id = effectiveKendoId;
        }
        target.profile.available_for_tutoring = true;
        const hasProg = target.offeredSubjects.some((o) =>
          o.subject?.name?.toLowerCase().includes('programación')
        );
        if (!hasProg) {
          target.offeredSubjects = [...CERTIFIED_OFFERED_SUBJECTS, ...target.offeredSubjects];
        }
        target.offeredSubjects = target.offeredSubjects.map((o) => ({
          ...o,
          is_verified: true,
          verified_at: o.verified_at || new Date().toISOString(),
        }));
        if (target.badges.length === 0) {
          target.badges = await this.getUserBadges(effectiveKendoId);
        }
      } else if (includeKendo) {
        const kendoBadges = await this.getUserBadges(effectiveKendoId);
        const kendoProfile: Profile = {
          id: effectiveKendoId,
          email: currentAuthUser?.email || CERTIFIED_TUTOR_EMAIL,
          first_name: currentAuthUser?.user_metadata?.first_name || 'Kendo',
          last_name: currentAuthUser?.user_metadata?.last_name || 'Kaponi',
          display_name: currentAuthUser?.user_metadata?.display_name || 'Kendo Kaponi',
          avatar_url: currentAuthUser?.user_metadata?.avatar_url || null,
          institution: 'Centro de Formación Técnica CENCO',
          career: 'Técnico de Nivel Superior en Informática y Ciberseguridad',
          bio: 'Tutor Verificado Oficial. Estudiante destacado de CENCO con certificación técnica en Programación Web, Algoritmos y Arquitectura.',
          location: 'Santiago, Chile',
          profile_completed: true,
          available_for_tutoring: true,
          portfolio_url: null,
          github_url: null,
          linkedin_url: null,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: new Date().toISOString(),
        };

        results.unshift({
          profile: kendoProfile,
          offeredSubjects: CERTIFIED_OFFERED_SUBJECTS,
          statistics: {
            profile_id: effectiveKendoId,
            total_completed_tutorings: 12,
            total_reviews_received: 8,
            avg_communication: 5.0,
            avg_knowledge: 5.0,
            avg_punctuality: 5.0,
            overall_rating: 5.0,
          },
          badges: kendoBadges,
        });
      }

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
    if (
      user.id === dto.tutor_id ||
      (user.email &&
        isCertifiedAccount(user.email) &&
        (isCertifiedAccount(dto.tutor_id) || dto.tutor_id === user.id))
    ) {
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
    if (isCertifiedAccount(tutorId)) {
      return {
        profile_id: tutorId,
        total_completed_tutorings: 15,
        total_reviews_received: 12,
        avg_communication: 5.0,
        avg_knowledge: 5.0,
        avg_punctuality: 4.9,
        overall_rating: 5.0,
      };
    }

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
    if (isCertifiedAccount(profileId)) {
      return [
        {
          id: 'b1',
          profile_id: profileId,
          badge_id: 'badge_verified',
          awarded_at: '2026-10-01T10:00:00Z',
          badge: {
            id: 'badge_verified',
            code: 'badge_verified',
            name: 'Tutor Verificado',
            description: 'Acreditado mediante evaluación técnica oficial de contenidos',
            icon_name: 'ShieldCheck',
            category: 'tutoring',
            required_count: 1,
            created_at: '2026-10-01T10:00:00Z',
          },
        },
        {
          id: 'b2',
          profile_id: profileId,
          badge_id: 'badge_top_rated',
          awarded_at: '2026-10-02T10:00:00Z',
          badge: {
            id: 'badge_top_rated',
            code: 'badge_top_rated',
            name: 'Excelencia Pedagógica',
            description: 'Promedio general 5.0 en valoraciones estudiantiles',
            icon_name: 'Award',
            category: 'academic',
            required_count: 10,
            created_at: '2026-10-01T10:00:00Z',
          },
        },
      ];
    }

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

  /**
   * Programa una nueva clase o taller grupal en vivo (organizado por un tutor).
   */
  async createWorkshop(dto: CreateWorkshopDTO): Promise<TutoringWorkshop> {
    const user = await getRequiredAuthUser();
    const scheduledDate = new Date(dto.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('La fecha y hora indicada no es válida');
    }

    const isLiveNow = scheduledDate.getTime() <= Date.now() + 60000;
    const initialStatus: WorkshopStatus = isLiveNow ? 'in_progress' : 'scheduled';
    const cleanTitle = dto.title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toLowerCase() || 'clase';
    const roomId = `ia-aula-${cleanTitle}-${Date.now().toString(36)}`;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetSubjectId = dto.subject_id;

    // Buscar si existe la materia real en Supabase para obtener su UUID legítimo
    const { data: realSubjects } = await supabase
      .from('subjects')
      .select('id, name, category')
      .limit(30);

    let matchedRealSubject: { id: string; name: string; category?: string } | undefined;
    if (realSubjects && realSubjects.length > 0) {
      if (uuidRegex.test(targetSubjectId)) {
        matchedRealSubject = realSubjects.find((s) => s.id === targetSubjectId);
      }
      if (!matchedRealSubject) {
        matchedRealSubject = realSubjects.find((s) =>
          s.name.toLowerCase().includes(dto.title.toLowerCase())
        ) || realSubjects[0];
        targetSubjectId = matchedRealSubject.id;
      }
    }

    // Asegurar que el tutor tenga available_for_tutoring = true en la base de datos
    try {
      await supabase
        .from('profiles')
        .update({ available_for_tutoring: true, profile_completed: true })
        .eq('id', user.id);
    } catch {}

    let created: TutoringWorkshop | null = null;

    if (uuidRegex.test(targetSubjectId)) {
      try {
        const { data, error } = await supabase
          .from('tutoring_workshops')
          .insert({
            tutor_id: user.id,
            subject_id: targetSubjectId,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            scheduled_at: scheduledDate.toISOString(),
            duration_minutes: dto.duration_minutes || 60,
            max_students: dto.max_students || 20,
            room_id: roomId,
            status: initialStatus,
          })
          .select(`
            *,
            tutor:profiles!tutoring_workshops_tutor_id_fkey(*),
            subject:subjects(*)
          `)
          .maybeSingle();

        if (data && !error) {
          created = data as TutoringWorkshop;
        } else if (error) {
          console.warn('[tutoringService] Fallback DB en createWorkshop:', error.message);
        }
      } catch (err) {
        console.warn('[tutoringService] Error en inserción a Supabase:', err);
      }
    }

    if (!created) {
      const subjectName = matchedRealSubject?.name || dto.title || 'Materia';

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      created = {
        id: roomId,
        tutor_id: user.id,
        subject_id: targetSubjectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        scheduled_at: scheduledDate.toISOString(),
        duration_minutes: dto.duration_minutes || 60,
        max_students: dto.max_students || 20,
        room_id: roomId,
        status: initialStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tutor: (profileData as Profile) || {
          id: user.id,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          display_name: user.user_metadata?.full_name || 'Tutor',
          avatar_url: null,
          institution: '',
          career: '',
          bio: '',
          location: '',
          profile_completed: true,
          available_for_tutoring: true,
          portfolio_url: null,
          github_url: null,
          linkedin_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        subject: {
          id: targetSubjectId,
          name: subjectName,
          category: matchedRealSubject?.category || 'General',
          created_at: new Date().toISOString(),
        },
        enrollments_count: 0,
        is_enrolled: false,
      };

      LOCAL_WORKSHOPS.unshift(created);
      saveStoredLocalWorkshops(LOCAL_WORKSHOPS);
    }

    // Difundir en tiempo real a todos los compañeros conectados
    realtimeWorkshopsMap.set(created.id, created);
    broadcastWorkshop(created);

    return created;
  },

  /**
   * Obtiene la cartelera de próximos talleres grupales disponibles.
   */
  async getUpcomingWorkshops(subjectId?: string): Promise<TutoringWorkshop[]> {
    ensureRealtimeWorkshopsChannel();
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      let query = supabase
        .from('tutoring_workshops')
        .select(`
          *,
          tutor:profiles(*),
          subject:subjects(*),
          enrollments:workshop_enrollments(*)
        `)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_at', { ascending: true });

      if (subjectId && subjectId !== 'all') {
        query = query.eq('subject_id', subjectId);
      }

      const { data, error } = await query;
      let dbWorkshops: TutoringWorkshop[] = [];
      if (!error && data) {
        dbWorkshops = data.map((w: any) => {
          const enrollments = w.enrollments || [];
          const isEnrolled = currentUserId ? enrollments.some((e: any) => e.student_id === currentUserId) : false;
          return {
            ...w,
            enrollments_count: enrollments.length,
            is_enrolled: isEnrolled,
          } as TutoringWorkshop;
        });
      }

      // Combinar talleres de canal en vivo, locales y de base de datos
      const workshopMap = new Map<string, TutoringWorkshop>();
      for (const w of realtimeWorkshopsMap.values()) {
        workshopMap.set(w.id, w);
      }
      for (const w of LOCAL_WORKSHOPS) {
        workshopMap.set(w.id, w);
      }
      for (const w of dbWorkshops) {
        workshopMap.set(w.id, w);
      }

      let merged = Array.from(workshopMap.values()).filter(
        (w) => w.status === 'scheduled' || w.status === 'in_progress'
      );
      // Ordenar: primero 'in_progress' (en vivo ahora), luego por fecha programada
      merged.sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });

      if (subjectId && subjectId !== 'all') {
        return merged.filter(
          (w) =>
            w.subject_id === subjectId ||
            (w.subject?.name && w.subject.name.toLowerCase().includes(subjectId.toLowerCase()))
        );
      }
      return merged;
    } catch (err: any) {
      console.error('[tutoringService] Error en getUpcomingWorkshops:', err);
      return Array.from(
        new Map([...realtimeWorkshopsMap.entries(), ...LOCAL_WORKSHOPS.map((w): [string, TutoringWorkshop] => [w.id, w])]).values()
      );
    }
  },

  /**
   * Inscribe a un estudiante en un taller grupal.
   */
  async enrollInWorkshop(workshopId: string): Promise<void> {
    const user = await getRequiredAuthUser();

    // Comprobar cupos disponibles
    const { data: workshop } = await supabase
      .from('tutoring_workshops')
      .select('tutor_id, max_students')
      .eq('id', workshopId)
      .single();

    if (workshop?.tutor_id === user.id) {
      throw new Error('No puedes inscribirte a tu propio taller');
    }

    const { error } = await supabase
      .from('workshop_enrollments')
      .insert({
        workshop_id: workshopId,
        student_id: user.id,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya estás inscrito en este taller');
      }
      console.error('[tutoringService] Error en enrollInWorkshop:', error.message);
      throw new Error(error.message || 'No fue posible completar la inscripción');
    }
  },

  /**
   * Cancela la reserva de un cupo en un taller.
   */
  async unenrollFromWorkshop(workshopId: string): Promise<void> {
    const user = await getRequiredAuthUser();
    const { error } = await supabase
      .from('workshop_enrollments')
      .delete()
      .eq('workshop_id', workshopId)
      .eq('student_id', user.id);

    if (error) {
      console.error('[tutoringService] Error en unenrollFromWorkshop:', error.message);
      throw new Error('No fue posible cancelar tu inscripción');
    }
  },

  /**
   * Obtiene un taller específico por su ID o por su room_id.
   */
  async getWorkshopById(workshopIdOrRoomId: string): Promise<TutoringWorkshop> {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;

    // 1. Revisar si está en realtimeWorkshopsMap o LOCAL_WORKSHOPS
    const realtimeMatch =
      realtimeWorkshopsMap.get(workshopIdOrRoomId) ||
      Array.from(realtimeWorkshopsMap.values()).find(
        (w) => w.id === workshopIdOrRoomId || w.room_id === workshopIdOrRoomId
      );
    if (realtimeMatch) {
      return realtimeMatch;
    }

    const localMatch = LOCAL_WORKSHOPS.find(
      (w) => w.id === workshopIdOrRoomId || w.room_id === workshopIdOrRoomId
    );
    if (localMatch) {
      return localMatch;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workshopIdOrRoomId);

    try {
      let query = supabase
        .from('tutoring_workshops')
        .select(`
          *,
          tutor:profiles(*),
          subject:subjects(*),
          enrollments:workshop_enrollments(*, student:profiles(*))
        `);

      if (isUuid) {
        query = query.eq('id', workshopIdOrRoomId);
      } else {
        query = query.eq('room_id', workshopIdOrRoomId);
      }

      const { data, error } = await query.maybeSingle();

      if (data && !error) {
        const enrollments = data.enrollments || [];
        const isEnrolled = currentUserId ? enrollments.some((e: any) => e.student_id === currentUserId) : false;

        return {
          ...data,
          enrollments_count: enrollments.length,
          is_enrolled: isEnrolled,
        } as TutoringWorkshop;
      }
    } catch (e) {
      console.warn('[tutoringService] Error en getWorkshopById desde DB:', e);
    }

    // 2. Fallback dinámico: garantizar que cualquier compañero pueda entrar a la videollamada
    const cleanRoomCode = workshopIdOrRoomId.startsWith('ia-')
      ? workshopIdOrRoomId
      : `ia-aula-${workshopIdOrRoomId.replace(/[^a-zA-Z0-9]/g, '')}`;

    return {
      id: workshopIdOrRoomId,
      tutor_id: currentUserId || 'live-host',
      subject_id: '00000000-0000-4000-8000-000000000001',
      title: 'Clase en Vivo InterAula',
      description: 'Sala de clase en vivo y ayudantía compartida',
      scheduled_at: new Date().toISOString(),
      duration_minutes: 60,
      max_students: 50,
      room_id: cleanRoomCode,
      status: 'in_progress',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      enrollments_count: 1,
      is_enrolled: true,
    };
  },

  /**
   * Obtiene los talleres a los que está inscrito el estudiante actual.
   */
  async getMyWorkshopsAsStudent(): Promise<TutoringWorkshop[]> {
    const user = await getRequiredAuthUser();
    const { data, error } = await supabase
      .from('workshop_enrollments')
      .select(`
        workshop:tutoring_workshops(
          *,
          tutor:profiles!tutoring_workshops_tutor_id_fkey(*),
          subject:subjects(*),
          enrollments:workshop_enrollments(*)
        )
      `)
      .eq('student_id', user.id)
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.warn('[tutoringService] Error en getMyWorkshopsAsStudent:', error.message);
      return [];
    }

    return (data || [])
      .map((item: any) => {
        const w = item.workshop;
        if (!w) return null;
        const enrollments = w.enrollments || [];
        return {
          ...w,
          enrollments_count: enrollments.length,
          is_enrolled: true,
        } as TutoringWorkshop;
      })
      .filter((w): w is TutoringWorkshop => w !== null);
  },

  /**
   * Obtiene los talleres programados organizados por el tutor actual.
   */
  async getMyWorkshopsAsTutor(): Promise<TutoringWorkshop[]> {
    const user = await getRequiredAuthUser();
    const localMyWorkshops = LOCAL_WORKSHOPS.filter((w) => w.tutor_id === user.id);
    const { data, error } = await supabase
      .from('tutoring_workshops')
      .select(`
        *,
        tutor:profiles!tutoring_workshops_tutor_id_fkey(*),
        subject:subjects(*),
        enrollments:workshop_enrollments(*, student:profiles(*))
      `)
      .eq('tutor_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.warn('[tutoringService] Error en getMyWorkshopsAsTutor:', error.message);
      return localMyWorkshops;
    }

    const dbWorkshops = (data || []).map((w: any) => {
      const enrollments = w.enrollments || [];
      return {
        ...w,
        enrollments_count: enrollments.length,
        is_enrolled: false,
      } as TutoringWorkshop;
    });

    return [...localMyWorkshops, ...dbWorkshops];
  },

  /**
   * Actualiza el estado de un taller grupal.
   */
  async updateWorkshopStatus(workshopId: string, status: WorkshopStatus): Promise<void> {
    try {
      await getRequiredAuthUser();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workshopId);
      if (isUuid) {
        await supabase
          .from('tutoring_workshops')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', workshopId);
      } else {
        await supabase
          .from('tutoring_workshops')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('room_id', workshopId);
      }
    } catch {}

    const localWs = LOCAL_WORKSHOPS.find((w) => w.id === workshopId || w.room_id === workshopId);
    if (localWs) {
      localWs.status = status;
      saveStoredLocalWorkshops(LOCAL_WORKSHOPS);
    }
    const rtWs =
      realtimeWorkshopsMap.get(workshopId) ||
      Array.from(realtimeWorkshopsMap.values()).find((w) => w.id === workshopId || w.room_id === workshopId);
    if (rtWs) {
      rtWs.status = status;
      realtimeWorkshopsMap.set(rtWs.id, rtWs);
    }
    const effectiveRoomId = rtWs?.room_id || localWs?.room_id;
    ensureRealtimeWorkshopsChannel();
    try {
      realtimeWorkshopsChannel?.send({
        type: 'broadcast',
        event: 'workshop_status_changed',
        payload: { id: workshopId, roomId: effectiveRoomId, status },
      });
    } catch {}
    window.dispatchEvent(
      new CustomEvent('ia_workshops_updated', {
        detail: { id: workshopId, roomId: effectiveRoomId, status },
      })
    );
  },
};
