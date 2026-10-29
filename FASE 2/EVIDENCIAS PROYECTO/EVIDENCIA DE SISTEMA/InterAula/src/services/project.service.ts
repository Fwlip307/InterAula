import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type {
  Project,
  ProjectPosition,
  ProjectMember,
  ProjectApplication,
  ProjectStatus,
  ProjectVisibility,
  ProjectModality,
  ProjectCompensationType,
  ProjectAgreements,
  ProjectMilestone,
  PositionStatus,
} from '../types/project';

export interface PositionInputDTO {
  id?: string;
  title: string;
  description?: string | null;
  skills_required?: string[];
  mandatory_requirements?: string[];
  optional_requirements?: string[];
  level_required?: string;
  dedication_hours?: number;
  slots?: number;
  compensation_override?: string | null;
  status?: PositionStatus;
}

export interface CreateProjectDTO {
  title: string;
  short_description?: string;
  description?: string;
  problem_statement?: string;
  objectives?: string;
  category?: string;
  career?: string;
  technologies?: string[];
  tags?: string[];
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  modality?: ProjectModality;
  dedication_hours?: number;
  max_members?: number;
  requirements?: string;
  compensation_type?: ProjectCompensationType;
  compensation_amount?: number | null;
  compensation_currency?: string;
  compensation_periodicity?: string;
  compensation_notes?: string;
  agreements?: ProjectAgreements;
  external_links?: Record<string, string>;
  milestones?: ProjectMilestone[];
  positions?: Array<string | PositionInputDTO>;
}

export interface ApplyPositionDTO {
  message?: string;
  relevant_skills?: string[];
  portfolio_url?: string;
  availability_notes?: string;
  accepted_agreements?: boolean;
}

export const projectService = {
  /**
   * Obtener proyectos públicos activos a través del backend propio.
   */
  async getProjects(): Promise<Project[]> {
    try {
      const data = await apiClient.get<Project[]>(API_ENDPOINTS.PROJECTS.BASE);
      if (Array.isArray(data)) return data;
    } catch (apiErr) {
      console.warn('[projectService] Lectura de respaldo en getProjects:', apiErr);
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, owner:profiles(*)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data as Project[];
    } catch {
      return [];
    }
  },

  /**
   * Obtener detalle de un proyecto por ID a través del backend propio.
   */
  async getProjectById(id: string): Promise<Project | null> {
    try {
      const data = await apiClient.get<Project>(API_ENDPOINTS.PROJECTS.BY_ID(id));
      if (data) return data;
    } catch {
      // Fallback lectura pública
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, owner:profiles(*)')
        .eq('id', id)
        .single();

      if (error) return null;
      return data as Project;
    } catch {
      return null;
    }
  },

  /**
   * Obtener proyectos creados por el usuario en sesión.
   */
  async getMyProjects(): Promise<Project[]> {
    try {
      const data = await apiClient.get<Project[]>(API_ENDPOINTS.PROJECTS.ME);
      return Array.isArray(data) ? data : [];
    } catch (apiErr) {
      console.warn('[projectService] Error en getMyProjects:', apiErr);
      return [];
    }
  },

  /**
   * Obtener vacantes / posiciones de un proyecto.
   */
  async getProjectPositions(projectId: string): Promise<ProjectPosition[]> {
    try {
      const data = await apiClient.get<ProjectPosition[]>(API_ENDPOINTS.PROJECTS.POSITIONS(projectId));
      if (Array.isArray(data)) return data;
    } catch {
      // Ignorar y devolver vacío
    }
    return [];
  },

  /**
   * Obtener miembros integrantes de un proyecto.
   */
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    try {
      const data = await apiClient.get<ProjectMember[]>(API_ENDPOINTS.PROJECTS.MEMBERS(projectId));
      if (Array.isArray(data)) return data;
    } catch {
      // Ignorar
    }
    return [];
  },

  /**
   * Obtener postulaciones recibidas en un proyecto propio (solo creador).
   */
  async getProjectApplications(projectId: string): Promise<ProjectApplication[]> {
    try {
      const data = await apiClient.get<ProjectApplication[]>(
        API_ENDPOINTS.PROJECTS.PROJECT_APPLICATIONS(projectId)
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[projectService] Error en getProjectApplications:', err);
      return [];
    }
  },

  /**
   * Obtener postulaciones enviadas por el usuario actual.
   */
  async getMyApplications(): Promise<ProjectApplication[]> {
    try {
      const data = await apiClient.get<ProjectApplication[]>(API_ENDPOINTS.PROJECTS.MY_APPLICATIONS);
      return Array.isArray(data) ? data : [];
    } catch (apiErr) {
      console.warn('[projectService] Error en getMyApplications:', apiErr);
      return [];
    }
  },

  /**
   * Postular a una vacante abierta a través del backend propio.
   */
  async applyToPosition(
    projectId: string,
    positionId: string,
    payloadOrMessage?: string | ApplyPositionDTO
  ): Promise<ProjectApplication> {
    const body: ApplyPositionDTO =
      typeof payloadOrMessage === 'string'
        ? { message: payloadOrMessage, accepted_agreements: true }
        : { accepted_agreements: true, ...(payloadOrMessage || {}) };

    return apiClient.post<ProjectApplication>(
      API_ENDPOINTS.PROJECTS.APPLY(projectId, positionId),
      body
    );
  },

  /**
   * Retirar una postulación pendiente a través del backend propio (solo el postulante).
   */
  async withdrawApplication(applicationId: string): Promise<ProjectApplication> {
    return apiClient.patch<ProjectApplication>(API_ENDPOINTS.PROJECTS.WITHDRAW(applicationId));
  },

  /**
   * Resolver postulación a través del backend propio (aceptar o rechazar - solo el propietario del proyecto).
   */
  async reviewApplication(
    applicationId: string,
    status: 'accepted' | 'rejected',
    feedback?: string
  ): Promise<ProjectApplication> {
    return apiClient.patch<ProjectApplication>(
      API_ENDPOINTS.PROJECTS.REVIEW_APPLICATION(applicationId),
      { status, feedback }
    );
  },

  /**
   * Actualizar estado de una vacante (open, paused, filled, closed).
   */
  async updatePositionStatus(
    projectId: string,
    positionId: string,
    status: PositionStatus
  ): Promise<ProjectPosition> {
    return apiClient.patch<ProjectPosition>(
      API_ENDPOINTS.PROJECTS.POSITION_STATUS(projectId, positionId),
      { status }
    );
  },

  /**
   * Crear un nuevo proyecto colaborativo con sus posiciones, condiciones económicas y acuerdos.
   */
  async createProject(dto: CreateProjectDTO): Promise<Project & { positions: ProjectPosition[] }> {
    return apiClient.post<Project & { positions: ProjectPosition[] }>(API_ENDPOINTS.PROJECTS.BASE, dto);
  },

  /**
   * Actualizar un proyecto existente a través del backend.
   */
  async updateProject(projectId: string, dto: Partial<CreateProjectDTO>): Promise<Project> {
    return apiClient.put<Project>(API_ENDPOINTS.PROJECTS.BY_ID(projectId), dto);
  },

  /**
   * Eliminar un proyecto propio a través del backend.
   */
  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.PROJECTS.BY_ID(projectId));
  },
};
