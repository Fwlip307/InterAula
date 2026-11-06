import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { TutoringWorkshop, CreateWorkshopDTO } from '../types/tutoring';


// Canal Supabase Realtime para sincronizar talleres en vivo
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
          window.dispatchEvent(new CustomEvent('ia_workshops_updated', { detail: { id, roomId, status } }));
        }
      })
      .on('broadcast', { event: 'workshop_deleted' }, (event: any) => {
        if (event.payload?.id) {
          const { id, roomId } = event.payload;
          realtimeWorkshopsMap.delete(id);
          if (roomId) realtimeWorkshopsMap.delete(roomId);
          window.dispatchEvent(
            new CustomEvent('ia_workshops_updated', { detail: { id, roomId, deleted: true } })
          );
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[workshopService] Realtime channel setup warning:', err);
  }
}

export const workshopService = {
  /**
   * Obtiene los próximos talleres grupales programados o en progreso desde Supabase.
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
      let workshops: TutoringWorkshop[] = [];

      if (!error && data) {
        workshops = data.map((w: any) => {
          const enrollments = w.enrollments || [];
          const isEnrolled = currentUserId ? enrollments.some((e: any) => e.student_id === currentUserId) : false;
          return {
            ...w,
            enrollments_count: enrollments.length,
            is_enrolled: isEnrolled,
          } as TutoringWorkshop;
        });
      }

      // Merge con actualizaciones en memoria provenientes de Realtime
      for (const rw of realtimeWorkshopsMap.values()) {
        const idx = workshops.findIndex((w) => w.id === rw.id);
        if (idx >= 0) {
          workshops[idx] = { ...workshops[idx], ...rw };
        } else if (rw.status === 'scheduled' || rw.status === 'in_progress') {
          workshops.unshift(rw);
        }
      }

      // Ordenar: primero 'in_progress' y luego por fecha programada
      workshops.sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });

      return workshops;
    } catch (err: any) {
      console.error('[workshopService] Error en getUpcomingWorkshops:', err);
      return Array.from(realtimeWorkshopsMap.values());
    }
  },

  /**
   * Obtiene un taller específico por su ID o por su room_id.
   */
  async getWorkshopById(workshopIdOrRoomId: string): Promise<TutoringWorkshop> {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;

    // Buscar primero en mapa realtime
    const realtimeMatch =
      realtimeWorkshopsMap.get(workshopIdOrRoomId) ||
      Array.from(realtimeWorkshopsMap.values()).find(
        (w) => w.id === workshopIdOrRoomId || w.room_id === workshopIdOrRoomId
      );
    if (realtimeMatch) {
      return realtimeMatch;
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
      console.warn('[workshopService] Error en getWorkshopById desde DB:', e);
    }

    throw new Error('Taller o sala de tutoría no encontrada');
  },

  /**
   * Crea un nuevo taller grupal en el backend propio.
   */
  async createWorkshop(dto: CreateWorkshopDTO): Promise<TutoringWorkshop> {
    ensureRealtimeWorkshopsChannel();

    const scheduledDate = new Date(dto.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('La fecha y hora del taller no es válida');
    }

    const workshop = await apiClient.post<TutoringWorkshop>(API_ENDPOINTS.WORKSHOPS.BASE, {
      subject_id: dto.subject_id,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      scheduled_at: dto.scheduled_at,
      duration_minutes: dto.duration_minutes || 60,
      max_students: dto.max_students || 30,
    });

    realtimeWorkshopsMap.set(workshop.id, workshop);

    if (realtimeWorkshopsChannel) {
      realtimeWorkshopsChannel.send({
        type: 'broadcast',
        event: 'workshop_created',
        payload: workshop,
      });
    }

    return workshop;
  },

  /**
   * Inscribe a un estudiante en un taller grupal a través del backend propio.
   */
  async enrollInWorkshop(workshopId: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.WORKSHOPS.ENROLL(workshopId));
  },

  /**
   * Cancela la reserva de un cupo en un taller a través del backend propio.
   */
  async unenrollFromWorkshop(workshopId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.WORKSHOPS.ENROLL(workshopId));
  },

  /**
   * Actualiza el estado de un taller ('scheduled', 'in_progress', 'completed', 'cancelled').
   */
  async updateWorkshopStatus(workshopId: string, status: string): Promise<void> {
    await apiClient.patch(API_ENDPOINTS.WORKSHOPS.STATUS(workshopId), { status });

    const cached = realtimeWorkshopsMap.get(workshopId);
    if (cached) {
      cached.status = status as any;
    }

    if (realtimeWorkshopsChannel) {
      realtimeWorkshopsChannel.send({
        type: 'broadcast',
        event: 'workshop_status_changed',
        payload: { id: workshopId, status },
      });
    }
  },

  /**
   * Elimina un taller programado a través del backend propio.
   */
  async deleteWorkshop(workshopId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.WORKSHOPS.BY_ID(workshopId));

    realtimeWorkshopsMap.delete(workshopId);

    if (realtimeWorkshopsChannel) {
      realtimeWorkshopsChannel.send({
        type: 'broadcast',
        event: 'workshop_deleted',
        payload: { id: workshopId },
      });
    }
  },

  /**
   * Obtiene los talleres en los que el usuario actual está inscrito como estudiante.
   */
  async getMyWorkshopsAsStudent(): Promise<TutoringWorkshop[]> {
    try {
      const workshops = await apiClient.get<TutoringWorkshop[]>(API_ENDPOINTS.WORKSHOPS.ME_AS_STUDENT);
      return workshops;
    } catch (apiErr) {
      console.warn('[workshopService] Backend API fallback para getMyWorkshopsAsStudent:', apiErr);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData?.user?.id;
        if (!currentUserId) return [];

        const { data, error } = await supabase
          .from('workshop_enrollments')
          .select(`
            workshop:tutoring_workshops(
              *,
              tutor:profiles(*),
              subject:subjects(*),
              enrollments:workshop_enrollments(*)
            )
          `)
          .eq('student_id', currentUserId);

        if (error || !data) return [];

        return data
          .map((row: any) => row.workshop)
          .filter(Boolean)
          .map((w: any) => ({
            ...w,
            enrollments_count: (w.enrollments || []).length,
            is_enrolled: true,
          })) as TutoringWorkshop[];
      } catch (err) {
        console.error('[workshopService] Error en getMyWorkshopsAsStudent:', err);
        return [];
      }
    }
  },

  /**
   * Obtiene los talleres creados por el tutor actual.
   */
  async getMyWorkshopsAsTutor(): Promise<TutoringWorkshop[]> {
    try {
      const workshops = await apiClient.get<TutoringWorkshop[]>(API_ENDPOINTS.WORKSHOPS.ME_AS_TUTOR);
      return workshops;
    } catch (apiErr) {
      console.warn('[workshopService] Backend API fallback para getMyWorkshopsAsTutor:', apiErr);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData?.user?.id;
        if (!currentUserId) return [];

        const { data, error } = await supabase
          .from('tutoring_workshops')
          .select(`
            *,
            tutor:profiles(*),
            subject:subjects(*),
            enrollments:workshop_enrollments(*)
          `)
          .eq('tutor_id', currentUserId)
          .order('scheduled_at', { ascending: false });

        if (error || !data) return [];

        return data.map((w: any) => ({
          ...w,
          enrollments_count: (w.enrollments || []).length,
          is_enrolled: false,
        })) as TutoringWorkshop[];
      } catch (err) {
        console.error('[workshopService] Error en getMyWorkshopsAsTutor:', err);
        return [];
      }
    }
  },
};
