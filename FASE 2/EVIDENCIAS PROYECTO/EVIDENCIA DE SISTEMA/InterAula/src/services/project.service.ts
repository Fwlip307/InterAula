import { supabase } from '../lib/supabase';
import type {
  Project,
  ProjectPosition,
  ProjectMember,
  ProjectApplication,
} from '../types/project';

/**
 * Helper interno para obtener el usuario autenticado obligatorio en operaciones de mutación.
 */
async function getRequiredAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Usuario no autenticado');
  }
  return authData.user;
}

/**
 * Helper interno para obtener el usuario autenticado opcional (ej. consultas de lectura de proyectos propios).
 */
async function getOptionalAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return null;
  }
  return authData.user;
}

export interface CreateProjectDTO {
  title: string;
  short_description?: string;
  description?: string;
  category?: string;
  max_members?: number;
  positions?: string[];
}

export const projectService = {
  // Obtener proyectos públicos activos para el Hub
  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[projectService] Error en getProjects:', error.message);
      return [];
    }
    return (data || []) as Project[];
  },

  // Obtener detalle de un proyecto por ID
  async getProjectById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[projectService] Error en getProjectById:', error.message);
      return null;
    }
    return data as Project;
  },

  // Obtener proyectos creados por el usuario en sesión
  async getMyProjects(): Promise<Project[]> {
    const user = await getOptionalAuthUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[projectService] Error en getMyProjects:', error.message);
      return [];
    }
    return (data || []) as Project[];
  },

  // Obtener vacantes / posiciones abiertas de un proyecto
  async getProjectPositions(projectId: string): Promise<ProjectPosition[]> {
    const { data, error } = await supabase
      .from('project_positions')
      .select('*, skill:skills(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[projectService] Error en getProjectPositions:', error.message);
      return [];
    }
    return (data || []) as ProjectPosition[];
  },

  // Obtener miembros integrantes de un proyecto
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*), position:project_positions(*)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[projectService] Error en getProjectMembers:', error.message);
      return [];
    }
    return (data || []) as ProjectMember[];
  },

  // Obtener postulaciones enviadas por el usuario actual
  async getMyApplications(): Promise<ProjectApplication[]> {
    const user = await getOptionalAuthUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('project_applications')
      .select('*, project:projects(*), position:project_positions(*)')
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[projectService] Error en getMyApplications:', error.message);
      return [];
    }
    return (data || []) as ProjectApplication[];
  },

  // Postular a una vacante abierta
  async applyToPosition(
    projectId: string,
    positionId: string,
    message?: string
  ): Promise<ProjectApplication> {
    const user = await getRequiredAuthUser();

    const { data, error } = await supabase
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
      console.error('[projectService] Error en applyToPosition:', error.message);
      throw error;
    }
    return data as ProjectApplication;
  },

  // Retirar una postulación pendiente (solo el postulante)
  async withdrawApplication(applicationId: string): Promise<ProjectApplication> {
    const { data, error } = await supabase
      .from('project_applications')
      .update({ status: 'withdrawn' })
      .eq('id', applicationId)
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      console.error('[projectService] Error en withdrawApplication:', error.message);
      throw error;
    }
    return data as ProjectApplication;
  },

  // Resolver postulación (aceptar o rechazar - solo el propietario del proyecto)
  async reviewApplication(
    applicationId: string,
    status: 'accepted' | 'rejected'
  ): Promise<ProjectApplication> {
    const { data, error } = await supabase
      .from('project_applications')
      .update({ status })
      .eq('id', applicationId)
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      console.error('[projectService] Error en reviewApplication:', error.message);
      throw error;
    }
    return data as ProjectApplication;
  },

  // Crear un nuevo proyecto colaborativo con sus posiciones iniciales
  async createProject(dto: CreateProjectDTO): Promise<Project & { positions: ProjectPosition[] }> {
    const user = await getRequiredAuthUser();

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
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
      console.error('[projectService] Error al crear proyecto:', error?.message);
      throw error || new Error('No fue posible crear el proyecto');
    }

    let createdPositions: ProjectPosition[] = [];
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
        const { data: posData, error: posError } = await supabase
          .from('project_positions')
          .insert(positionsToInsert)
          .select('*, skill:skills(*)');

        if (posError) {
          console.error('[projectService] Error al crear posiciones del proyecto:', posError.message);
        } else if (posData) {
          createdPositions = posData as ProjectPosition[];
        }
      }
    }

    return { ...(project as Project), positions: createdPositions };
  },

  // Eliminar un proyecto propio
  async deleteProject(projectId: string): Promise<void> {
    const user = await getRequiredAuthUser();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', user.id);

    if (error) {
      console.error('[projectService] Error al eliminar proyecto:', error.message);
      throw error;
    }
  },
};

