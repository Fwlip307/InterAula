import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type {
  Project,
  ProjectPosition,
  ProjectMember,
  ProjectApplication,
} from '../types/project';


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
    try {
      const data = await apiClient.get<Project[]>(API_ENDPOINTS.PROJECTS.ME);
      return data;
    } catch (apiErr) {
      console.warn('[projectService] Backend API fallback para getMyProjects:', apiErr);
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
    }
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
    try {
      const data = await apiClient.get<ProjectApplication[]>(API_ENDPOINTS.PROJECTS.MY_APPLICATIONS);
      return data;
    } catch (apiErr) {
      console.warn('[projectService] Backend API fallback para getMyApplications:', apiErr);
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
    }
  },

  // Postular a una vacante abierta a través del backend propio
  async applyToPosition(
    projectId: string,
    positionId: string,
    message?: string
  ): Promise<ProjectApplication> {
    const data = await apiClient.post<ProjectApplication>(
      API_ENDPOINTS.PROJECTS.APPLY(projectId, positionId),
      { message }
    );
    return data;
  },

  // Retirar una postulación pendiente a través del backend propio (solo el postulante)
  async withdrawApplication(applicationId: string): Promise<ProjectApplication> {
    const data = await apiClient.patch<ProjectApplication>(
      API_ENDPOINTS.PROJECTS.WITHDRAW(applicationId)
    );
    return data;
  },

  // Resolver postulación a través del backend propio (aceptar o rechazar - solo el propietario del proyecto)
  async reviewApplication(
    applicationId: string,
    status: 'accepted' | 'rejected'
  ): Promise<ProjectApplication> {
    const data = await apiClient.patch<ProjectApplication>(
      API_ENDPOINTS.PROJECTS.REVIEW_APPLICATION(applicationId),
      { status }
    );
    return data;
  },

  // Crear un nuevo proyecto colaborativo con sus posiciones iniciales a través del backend
  async createProject(dto: CreateProjectDTO): Promise<Project & { positions: ProjectPosition[] }> {
    const project = await apiClient.post<Project & { positions: ProjectPosition[] }>(API_ENDPOINTS.PROJECTS.BASE, dto);
    return project;
  },

  // Eliminar un proyecto propio a través del backend
  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.PROJECTS.BY_ID(projectId));
  },
};

