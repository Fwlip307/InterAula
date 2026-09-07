import { supabase } from '../lib/supabase';
import type {
  Profile,
  UpdateProfileDTO,
  Subject,
  OfferedSubject,
  NeededSubject,
  Skill,
  ProfileSkill,
  ProjectInterest,
  ProfileProjectInterest,
  AcademicLevel,
} from '../types/profile';

export const profileService = {
  // Obtener perfil del usuario actualmente autenticado
  async getMyProfile(): Promise<Profile | null> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error) {
      console.error('[profileService] Error en getMyProfile:', error.message);
      return null;
    }
    return data as Profile;
  },

  // Obtener perfil público de cualquier estudiante por ID
  async getProfileById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[profileService] Error en getProfileById:', error.message);
      return null;
    }
    return data as Profile;
  },

  // Actualizar datos del perfil del usuario en sesión
  async updateMyProfile(data: UpdateProfileDTO): Promise<Profile | null> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', authData.user.id)
      .select()
      .single();

    if (error) {
      console.error('[profileService] Error en updateMyProfile:', error.message);
      throw error;
    }
    return updated as Profile;
  },

  // Catálogo completo de materias académicas
  async getSubjects(): Promise<Subject[]> {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[profileService] Error en getSubjects:', error.message);
      return [];
    }
    return (data || []) as Subject[];
  },

  // Materias que un perfil enseña / ofrece
  async getOfferedSubjects(profileId: string): Promise<OfferedSubject[]> {
    const { data, error } = await supabase
      .from('profile_offered_subjects')
      .select('*, subject:subjects(*)')
      .eq('profile_id', profileId);

    if (error) {
      console.error('[profileService] Error en getOfferedSubjects:', error.message);
      return [];
    }
    return (data || []) as OfferedSubject[];
  },

  // Materias en las que un perfil necesita tutoría / apoyo
  async getNeededSubjects(profileId: string): Promise<NeededSubject[]> {
    const { data, error } = await supabase
      .from('profile_needed_subjects')
      .select('*, subject:subjects(*)')
      .eq('profile_id', profileId);

    if (error) {
      console.error('[profileService] Error en getNeededSubjects:', error.message);
      return [];
    }
    return (data || []) as NeededSubject[];
  },

  // Agregar materia que el usuario puede enseñar
  async addOfferedSubject(
    subjectId: string,
    level: AcademicLevel,
    description?: string
  ): Promise<OfferedSubject> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('profile_offered_subjects')
      .upsert({
        profile_id: authData.user.id,
        subject_id: subjectId,
        level,
        description: description || null,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      console.error('[profileService] Error en addOfferedSubject:', error.message);
      throw error;
    }
    return data as OfferedSubject;
  },

  // Eliminar materia ofrecida
  async removeOfferedSubject(subjectId: string): Promise<void> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('profile_offered_subjects')
      .delete()
      .eq('profile_id', authData.user.id)
      .eq('subject_id', subjectId);

    if (error) {
      console.error('[profileService] Error en removeOfferedSubject:', error.message);
      throw error;
    }
  },

  // Agregar materia que el usuario necesita aprender
  async addNeededSubject(
    subjectId: string,
    currentLevel?: AcademicLevel,
    notes?: string
  ): Promise<NeededSubject> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('profile_needed_subjects')
      .upsert({
        profile_id: authData.user.id,
        subject_id: subjectId,
        current_level: currentLevel || null,
        notes: notes || null,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      console.error('[profileService] Error en addNeededSubject:', error.message);
      throw error;
    }
    return data as NeededSubject;
  },

  // Eliminar materia necesaria
  async removeNeededSubject(subjectId: string): Promise<void> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('profile_needed_subjects')
      .delete()
      .eq('profile_id', authData.user.id)
      .eq('subject_id', subjectId);

    if (error) {
      console.error('[profileService] Error en removeNeededSubject:', error.message);
      throw error;
    }
  },

  // Catálogo completo de habilidades de proyectos
  async getSkills(): Promise<Skill[]> {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[profileService] Error en getSkills:', error.message);
      return [];
    }
    return (data || []) as Skill[];
  },

  // Habilidades asociadas a un perfil
  async getProfileSkills(profileId: string): Promise<ProfileSkill[]> {
    const { data, error } = await supabase
      .from('profile_skills')
      .select('*, skill:skills(*)')
      .eq('profile_id', profileId);

    if (error) {
      console.error('[profileService] Error en getProfileSkills:', error.message);
      return [];
    }
    return (data || []) as ProfileSkill[];
  },

  // Agregar habilidad al perfil
  async addProfileSkill(skillId: string, level: AcademicLevel): Promise<ProfileSkill> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('profile_skills')
      .upsert({
        profile_id: authData.user.id,
        skill_id: skillId,
        level,
      })
      .select('*, skill:skills(*)')
      .single();

    if (error) {
      console.error('[profileService] Error en addProfileSkill:', error.message);
      throw error;
    }
    return data as ProfileSkill;
  },

  // Eliminar habilidad del perfil
  async removeProfileSkill(skillId: string): Promise<void> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('profile_skills')
      .delete()
      .eq('profile_id', authData.user.id)
      .eq('skill_id', skillId);

    if (error) {
      console.error('[profileService] Error en removeProfileSkill:', error.message);
      throw error;
    }
  },

  // Catálogo de intereses de proyectos
  async getProjectInterests(): Promise<ProjectInterest[]> {
    const { data, error } = await supabase
      .from('project_interests')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[profileService] Error en getProjectInterests:', error.message);
      return [];
    }
    return (data || []) as ProjectInterest[];
  },

  // Áreas de interés del perfil
  async getProfileProjectInterests(profileId: string): Promise<ProfileProjectInterest[]> {
    const { data, error } = await supabase
      .from('profile_project_interests')
      .select('*, interest:project_interests(*)')
      .eq('profile_id', profileId);

    if (error) {
      console.error('[profileService] Error en getProfileProjectInterests:', error.message);
      return [];
    }
    return (data || []) as ProfileProjectInterest[];
  },

  // Agregar área de interés al perfil
  async addProjectInterest(interestId: string): Promise<ProfileProjectInterest> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('profile_project_interests')
      .upsert({
        profile_id: authData.user.id,
        interest_id: interestId,
      })
      .select('*, interest:project_interests(*)')
      .single();

    if (error) {
      console.error('[profileService] Error en addProjectInterest:', error.message);
      throw error;
    }
    return data as ProfileProjectInterest;
  },

  // Eliminar área de interés del perfil
  async removeProjectInterest(interestId: string): Promise<void> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('profile_project_interests')
      .delete()
      .eq('profile_id', authData.user.id)
      .eq('interest_id', interestId);

    if (error) {
      console.error('[profileService] Error en removeProjectInterest:', error.message);
      throw error;
    }
  },
};
