import { supabase } from '../lib/supabase';
import type { TutoringWorkshop, CreateWorkshopDTO } from '../types/tutoring';

async function getRequiredAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Usuario no autenticado');
  }
  return authData.user;
}

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

    // Fallback dinámico seguro para acceso a sala
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
   * Crea un nuevo taller grupal en Supabase.
   */
  async createWorkshop(dto: CreateWorkshopDTO): Promise<TutoringWorkshop> {
    const user = await getRequiredAuthUser();
    ensureRealtimeWorkshopsChannel();

    const scheduledDate = new Date(dto.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('La fecha y hora del taller no es válida');
    }

    const { data, error } = await supabase
      .from('tutoring_workshops')
      .insert({
        tutor_id: user.id,
        subject_id: dto.subject_id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        scheduled_at: dto.scheduled_at,
        duration_minutes: dto.duration_minutes || 60,
        max_students: dto.max_students || 30,
        status: 'scheduled',
      })
      .select(`
        *,
        tutor:profiles(*),
        subject:subjects(*)
      `)
      .single();

    if (error || !data) {
      console.error('[workshopService] Error en createWorkshop:', error?.message);
      throw new Error(error?.message || 'No fue posible crear el taller en la base de datos');
    }

    const workshop = {
      ...data,
      enrollments_count: 0,
      is_enrolled: false,
    } as TutoringWorkshop;

    realtimeWorkshopsMap.set(workshop.id, workshop);

    // Notificar a otros clientes conectados
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
   * Inscribe a un estudiante en un taller grupal.
   */
  async enrollInWorkshop(workshopId: string): Promise<void> {
    const user = await getRequiredAuthUser();

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
      throw new Error('No fue posible cancelar tu inscripción');
    }
  },

  /**
   * Actualiza el estado de un taller ('scheduled', 'in_progress', 'completed', 'cancelled').
   */
  async updateWorkshopStatus(workshopId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('tutoring_workshops')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', workshopId);

    if (error) {
      console.warn('[workshopService] Error al actualizar estado del taller:', error.message);
    }

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
   * Elimina un taller programado.
   */
  async deleteWorkshop(workshopId: string): Promise<void> {
    const user = await getRequiredAuthUser();

    const { error } = await supabase
      .from('tutoring_workshops')
      .delete()
      .eq('id', workshopId)
      .eq('tutor_id', user.id);

    if (error) {
      console.error('[workshopService] Error en deleteWorkshop:', error.message);
      throw new Error('No fue posible eliminar el taller');
    }

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
  },

  /**
   * Obtiene los talleres creados por el tutor actual.
   */
  async getMyWorkshopsAsTutor(): Promise<TutoringWorkshop[]> {
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
  },
};
