import { supabase } from '../lib/supabase';
import type {
  Project,
  ProjectPosition,
  ProjectMember,
  ProjectApplication,
} from '../types/project';

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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return [];

    const { data, error } = await supabase
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('owner_id', authData.user.id)
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return [];

    const { data, error } = await supabase
      .from('project_applications')
      .select('*, project:projects(*), position:project_positions(*)')
      .eq('applicant_id', authData.user.id)
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('project_applications')
      .insert({
        project_id: projectId,
        position_id: positionId,
        applicant_id: authData.user.id,
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
};
