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
  LearningPreference,
} from '../types/profile';

/**
 * Helper interno para obtener el usuario autenticado obligatorio en operaciones de mutación.
 * Si no hay sesión válida activa, lanza un error tipado.
 */
async function getRequiredAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Usuario no autenticado');
  }
  return authData.user;
}

/**
 * Helper interno para obtener el usuario autenticado opcional (ej. consultas de lectura).
 */
async function getOptionalAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return null;
  }
  return authData.user;
}

export const profileService = {
  // Obtener perfil del usuario actualmente autenticado
  async getMyProfile(): Promise<Profile | null> {
    const user = await getOptionalAuthUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[profileService] Error en getMyProfile:', error.message);
      return null;
    }
    return data as Profile;
  },

  // Obtener perfil público de cualquier estudiante por ID (respetando privacidad de contacto)
  async getProfileById(id: string): Promise<Profile | null> {
    // 1. Consultar prioritariamente desde la vista segura public_profiles
    const { data: publicData, error: viewError } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!viewError && publicData) {
      return publicData as Profile;
    }

    // 2. Respaldo directo sobre profiles aplicando estricta política de privacidad
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('[profileService] Error en getProfileById:', error?.message || viewError?.message);
      return null;
    }

    const authUser = await getOptionalAuthUser();
    const isOwner = authUser?.id === data.id;

    return {
      ...data,
      email: data.show_email || isOwner ? data.email : null,
      phone: data.show_phone || isOwner ? data.phone : null,
    } as Profile;
  },

  // Actualizar datos del perfil del usuario en sesión
  async updateMyProfile(data: UpdateProfileDTO): Promise<Profile | null> {
    const user = await getRequiredAuthUser();

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[profileService] Error en updateMyProfile:', error.message);
      throw error;
    }
    return updated as Profile;
  },

  // Actualizar específicamente las preferencias de aprendizaje inclusivas
  async updateLearningPreferences(preferences: LearningPreference[]): Promise<Profile | null> {
    return this.updateMyProfile({ learning_preferences: preferences });
  },

  // Catálogo enfocado en las materias críticas de Informática
  async getSubjects(onlyPilot?: boolean): Promise<Subject[]> {
    let query = supabase
      .from('subjects')
      .select('*')
      .order('is_pilot', { ascending: false })
      .order('pilot_priority', { ascending: true })
      .order('name', { ascending: true });

    if (onlyPilot) {
      query = query.eq('is_pilot', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[profileService] Error en getSubjects:', error.message);
      return [];
    }

    const legacyCategoriesToExclude = ['Idiomas', 'Formación General', 'Gestión y Negocios'];
    const filtered = (data || []).filter((s: Subject) => {
      if (onlyPilot) return s.is_pilot;
      if (s.category && legacyCategoriesToExclude.includes(s.category)) return false;
      return true;
    });

    return filtered as Subject[];
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
    const user = await getRequiredAuthUser();

    const { data, error } = await supabase
      .from('profile_offered_subjects')
      .upsert({
        profile_id: user.id,
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
    const user = await getRequiredAuthUser();

    const { error } = await supabase
      .from('profile_offered_subjects')
      .delete()
      .eq('profile_id', user.id)
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
    const user = await getRequiredAuthUser();

    const { data, error } = await supabase
      .from('profile_needed_subjects')
      .upsert({
        profile_id: user.id,
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
    const user = await getRequiredAuthUser();

    const { error } = await supabase
      .from('profile_needed_subjects')
      .delete()
      .eq('profile_id', user.id)
      .eq('subject_id', subjectId);

    if (error) {
      console.error('[profileService] Error en removeNeededSubject:', error.message);
      throw error;
    }
  },

  // Métodos de habilidades e intereses (desacoplados tras migración 009)
  async getSkills(): Promise<Skill[]> {
    return [];
  },

  async getProfileSkills(_profileId: string): Promise<ProfileSkill[]> {
    return [];
  },

  async addProfileSkill(_skillId: string, _level: AcademicLevel): Promise<ProfileSkill> {
    return {} as ProfileSkill;
  },

  async removeProfileSkill(_skillId: string): Promise<void> {
    return;
  },

  async getProjectInterests(): Promise<ProjectInterest[]> {
    return [];
  },

  async getProfileProjectInterests(_profileId: string): Promise<ProfileProjectInterest[]> {
    return [];
  },

  async addProjectInterest(_interestId: string): Promise<ProfileProjectInterest> {
    return {} as ProfileProjectInterest;
  },

  async removeProjectInterest(_interestId: string): Promise<void> {
    return;
  },
};
