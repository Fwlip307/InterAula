import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';

function isTableMissingError(error: any): boolean {
  return Boolean(
    error?.code === 'PGRST205' ||
    error?.message?.includes('Could not find the table') ||
    error?.message?.includes('does not exist')
  );
}

export const projectBackendService = {
  /**
   * Obtener proyectos públicos activos
   */
  async getProjects() {
    const { data, error } = await supabasePublic
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(`Error al consultar proyectos: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Obtener detalle de proyecto por ID
   */
  async getProjectById(id: string) {
    const { data, error } = await supabasePublic
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) return null;
      throw new Error(`Error al buscar proyecto: ${error.message}`);
    }
    return data;
  },

  /**
   * Obtener proyectos del usuario autenticado
   */
  async getMyProjects(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(`Error al consultar mis proyectos: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Obtener posiciones de un proyecto
   */
  async getProjectPositions(projectId: string) {
    const { data, error } = await supabasePublic
      .from('project_positions')
      .select('*, skill:skills(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(`Error al consultar posiciones: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Obtener miembros de un proyecto
   */
  async getProjectMembers(projectId: string) {
    const { data, error } = await supabasePublic
      .from('project_members')
      .select('*, profile:profiles(*), position:project_positions(*)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(`Error al consultar miembros: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Obtener postulaciones del usuario autenticado
   */
  async getMyApplications(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('project_applications')
      .select('*, project:projects(*), position:project_positions(*)')
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(`Error al consultar postulaciones: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Crear proyecto colaborativo con sus posiciones
   */
  async createProject(user: AuthenticatedUser, token: string, dto: {
    title: string;
    short_description?: string;
    description?: string;
    category?: string;
    max_members?: number;
    positions?: string[];
  }) {
    const client = getAuthenticatedSupabase(token);

    const { data: project, error } = await client
      .from('projects')
      .insert({
        owner_id: user.id, // Forzado por el servidor
        title: dto.title.trim(),
        short_description: dto.short_description?.trim() || null,
        description: dto.description?.trim() || null,
        category: dto.category || 'Desarrollo de Software',
        status: 'recruiting',
        visibility: 'public',
        max_members: dto.max_members || 4,
      })
      .select('*, owner:profiles(*)')
      .single();

    if (error || !project) {
      throw new Error(error?.message || 'No fue posible crear el proyecto');
    }

    let createdPositions: any[] = [];
    if (dto.positions && dto.positions.length > 0) {
      const positionsToInsert = dto.positions
        .map((p) => p.trim())
        .filter(Boolean)
        .map((title) => ({
          project_id: project.id,
          title,
          description: `Participación activa en el rol de ${title} para el proyecto.`,
          level_required: 'intermediate',
          slots: 1,
          status: 'open',
        }));

      if (positionsToInsert.length > 0) {
        const { data: posData } = await client
          .from('project_positions')
          .insert(positionsToInsert)
          .select('*, skill:skills(*)');

        if (posData) {
          createdPositions = posData;
        }
      }
    }

    return { ...project, positions: createdPositions };
  },

  /**
   * Postular a una posición de proyecto
   */
  async applyToPosition(
    user: AuthenticatedUser,
    token: string,
    projectId: string,
    positionId: string,
    message?: string
  ) {
    const client = getAuthenticatedSupabase(token);

    // 1. Validar que no sea el dueño del proyecto
    const { data: project, error: projErr } = await client
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      throw new Error('Proyecto no encontrado');
    }

    if (project.owner_id === user.id) {
      throw new Error('No puedes postular a tu propio proyecto');
    }

    // 2. Registrar postulación
    const { data, error } = await client
      .from('project_applications')
      .insert({
        project_id: projectId,
        position_id: positionId,
        applicant_id: user.id,
        message: message?.trim() || null,
        status: 'pending',
      })
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya tienes una postulación activa para esta posición');
      }
      throw new Error(error.message || 'No fue posible enviar la postulación');
    }

    return data;
  },

  /**
   * Retirar postulación propia
   */
  async withdrawApplication(user: AuthenticatedUser, token: string, applicationId: string) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('project_applications')
      .update({ status: 'withdrawn' })
      .eq('id', applicationId)
      .eq('applicant_id', user.id)
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      throw new Error(error.message || 'No fue posible retirar la postulación');
    }

    return data;
  },

  /**
   * Revisar y dictaminar postulación (solo el dueño del proyecto)
   */
  async reviewApplication(
    user: AuthenticatedUser,
    token: string,
    applicationId: string,
    status: 'accepted' | 'rejected'
  ) {
    const client = getAuthenticatedSupabase(token);

    // 1. Validar que el usuario sea el dueño del proyecto
    const { data: application, error: appErr } = await client
      .from('project_applications')
      .select('*, project:projects(owner_id)')
      .eq('id', applicationId)
      .single();

    if (appErr || !application) {
      throw new Error('Postulación no encontrada');
    }

    const projectOwnerId = (application.project as any)?.owner_id;
    if (projectOwnerId !== user.id && user.role !== 'admin') {
      throw new Error('Solo el creador del proyecto puede aceptar o rechazar postulaciones');
    }

    const { data, error } = await client
      .from('project_applications')
      .update({ status })
      .eq('id', applicationId)
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      throw new Error(error.message || 'Error al resolver la postulación');
    }

    // 2. Si se acepta, incorporar automáticamente a project_members si la tabla existe
    if (status === 'accepted') {
      await client
        .from('project_members')
        .insert({
          project_id: application.project_id,
          profile_id: application.applicant_id,
          position_id: application.position_id,
          role: 'member',
        })
        .maybeSingle();
    }

    return data;
  },

  /**
   * Eliminar proyecto
   */
  async deleteProject(user: AuthenticatedUser, token: string, projectId: string) {
    const client = getAuthenticatedSupabase(token);

    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', user.id);

    if (error) {
      throw new Error(error.message || 'No fue posible eliminar el proyecto');
    }

    return { success: true, message: 'Proyecto eliminado correctamente' };
  },
};
