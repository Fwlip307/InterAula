import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';

export const workshopBackendService = {
  /**
   * Obtiene talleres programados o en curso
   */
  async getUpcomingWorkshops(subjectId?: string, currentUserId?: string) {
    let query = supabasePublic
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
    if (error) {
      throw new Error(`Error al consultar talleres: ${error.message}`);
    }

    return (data || []).map((w: any) => {
      const enrollments = w.enrollments || [];
      const isEnrolled = currentUserId ? enrollments.some((e: any) => e.student_id === currentUserId) : false;
      return {
        ...w,
        enrollments_count: enrollments.length,
        is_enrolled: isEnrolled,
      };
    });
  },

  /**
   * Obtiene un taller por id o room_id
   */
  async getWorkshopById(idOrRoomId: string, currentUserId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRoomId);

    let query = supabasePublic
      .from('tutoring_workshops')
      .select(`
        *,
        tutor:profiles(*),
        subject:subjects(*),
        enrollments:workshop_enrollments(*, student:profiles(*))
      `);

    if (isUuid) {
      query = query.eq('id', idOrRoomId);
    } else {
      query = query.eq('room_id', idOrRoomId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`Error al buscar taller: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    const enrollments = data.enrollments || [];
    const isEnrolled = currentUserId ? enrollments.some((e: any) => e.student_id === currentUserId) : false;

    return {
      ...data,
      enrollments_count: enrollments.length,
      is_enrolled: isEnrolled,
    };
  },

  /**
   * Crear taller con verificación estricta de tutor y reglas de negocio
   */
  async createWorkshop(user: AuthenticatedUser, token: string, body: any) {
    const scheduledDate = new Date(body.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Fecha programada inválida');
    }

    const maxStudents = body.max_students || body.max_participants || 30;
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('tutoring_workshops')
      .insert({
        tutor_id: user.id, // Forzado desde la sesión validada
        subject_id: body.subject_id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        scheduled_at: body.scheduled_at,
        duration_minutes: body.duration_minutes || 60,
        max_students: maxStudents,
        status: 'scheduled',
      })
      .select(`
        *,
        tutor:profiles(*),
        subject:subjects(*)
      `)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'No fue posible crear el taller en la base de datos');
    }

    return {
      ...data,
      enrollments_count: 0,
      is_enrolled: false,
    };
  },

  /**
   * Inscribir estudiante en taller
   */
  async enroll(user: AuthenticatedUser, token: string, workshopId: string) {
    const client = getAuthenticatedSupabase(token);

    // 1. Obtener taller para validar capacidad y dueño
    const { data: workshop, error: wsError } = await client
      .from('tutoring_workshops')
      .select('id, tutor_id, max_students, status')
      .eq('id', workshopId)
      .single();

    if (wsError || !workshop) {
      throw new Error('El taller no existe');
    }

    if (workshop.tutor_id === user.id) {
      throw new Error('No puedes inscribirte a tu propio taller');
    }

    if (workshop.status === 'cancelled' || workshop.status === 'completed') {
      throw new Error('No es posible inscribirse a un taller finalizado o cancelado');
    }

    // 2. Comprobar cupo
    const { count, error: countError } = await client
      .from('workshop_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId);

    if (countError) {
      throw new Error('Error al verificar cupo del taller');
    }

    if (count !== null && workshop.max_students && count >= workshop.max_students) {
      throw new Error('El taller ha alcanzado el límite máximo de estudiantes');
    }

    // 3. Insertar inscripción
    const { error: enrollError } = await client
      .from('workshop_enrollments')
      .insert({
        workshop_id: workshopId,
        student_id: user.id,
      });

    if (enrollError) {
      if (enrollError.code === '23505') {
        throw new Error('Ya estás inscrito en este taller');
      }
      throw new Error(enrollError.message || 'No fue posible completar la inscripción');
    }

    return { success: true, message: 'Inscripción realizada con éxito' };
  },

  /**
   * Desinscribir estudiante de un taller
   */
  async unenroll(user: AuthenticatedUser, token: string, workshopId: string) {
    const client = getAuthenticatedSupabase(token);

    const { error } = await client
      .from('workshop_enrollments')
      .delete()
      .eq('workshop_id', workshopId)
      .eq('student_id', user.id);

    if (error) {
      throw new Error(error.message || 'No fue posible cancelar tu inscripción');
    }

    return { success: true, message: 'Inscripción cancelada' };
  },

  /**
   * Actualizar estado del taller (solo el tutor titular o admin)
   */
  async updateStatus(user: AuthenticatedUser, token: string, workshopId: string, status: string) {
    const client = getAuthenticatedSupabase(token);

    // Validar propiedad
    const { data: ws, error: fetchErr } = await client
      .from('tutoring_workshops')
      .select('tutor_id')
      .eq('id', workshopId)
      .single();

    if (fetchErr || !ws) {
      throw new Error('Taller no encontrado');
    }

    if (ws.tutor_id !== user.id) {
      throw new Error('No tienes autorización para modificar este taller');
    }

    const { data, error } = await client
      .from('tutoring_workshops')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', workshopId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Error al actualizar estado del taller');
    }

    return data;
  },

  /**
   * Eliminar taller (solo el tutor titular o admin)
   */
  async deleteWorkshop(user: AuthenticatedUser, token: string, workshopId: string) {
    const client = getAuthenticatedSupabase(token);

    const { data: ws, error: fetchErr } = await client
      .from('tutoring_workshops')
      .select('tutor_id')
      .eq('id', workshopId)
      .single();

    if (fetchErr || !ws) {
      throw new Error('Taller no encontrado');
    }

    if (ws.tutor_id !== user.id) {
      throw new Error('No tienes autorización para eliminar este taller');
    }

    const { error } = await client
      .from('tutoring_workshops')
      .delete()
      .eq('id', workshopId)
      .eq('tutor_id', user.id);

    if (error) {
      throw new Error('No fue posible eliminar el taller');
    }

    return { success: true, message: 'Taller eliminado correctamente' };
  },

  /**
   * Obtener talleres del estudiante
   */
  async getMyWorkshopsAsStudent(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('workshop_enrollments')
      .select(`
        workshop:tutoring_workshops(
          *,
          tutor:profiles(*),
          subject:subjects(*),
          enrollments:workshop_enrollments(*)
        )
      `)
      .eq('student_id', user.id);

    if (error) {
      throw new Error(`Error al obtener inscripciones: ${error.message}`);
    }

    return (data || [])
      .map((row: any) => row.workshop)
      .filter(Boolean)
      .map((w: any) => ({
        ...w,
        enrollments_count: (w.enrollments || []).length,
        is_enrolled: true,
      }));
  },

  /**
   * Obtener talleres creados por el tutor
   */
  async getMyWorkshopsAsTutor(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('tutoring_workshops')
      .select(`
        *,
        tutor:profiles(*),
        subject:subjects(*),
        enrollments:workshop_enrollments(*)
      `)
      .eq('tutor_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener talleres del tutor: ${error.message}`);
    }

    return (data || []).map((w: any) => ({
      ...w,
      enrollments_count: (w.enrollments || []).length,
      is_enrolled: false,
    }));
  },
};
