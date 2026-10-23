import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
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
 * Helper interno para obtener el usuario autenticado opcional (ej. consultas de lectura).
 */
async function getOptionalAuthUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return null;
  }
  return authData.user;
}

export const CERTIFIED_TUTOR_EMAILS: string[] = [];
export const CERTIFIED_TUTOR_EMAIL = '';
export const CERTIFIED_TUTOR_ID = '';
export const KNOWN_CERTIFIED_USER_IDS: string[] = [];

/**
 * @deprecated Utilizar la verificación formal en base de datos (checkIsVerifiedTutor).
 */
export function isCertifiedAccount(_emailOrId?: string | null): boolean {
  return false;
}

export const CERTIFIED_OFFERED_SUBJECTS: OfferedSubject[] = [];

/**
 * Consulta en la base de datos si un perfil es tutor acreditado o validador académico.
 */
export async function checkIsVerifiedTutor(profileId: string): Promise<boolean> {
  try {
    const { data: offered } = await supabase
      .from('profile_offered_subjects')
      .select('is_verified')
      .eq('profile_id', profileId)
      .eq('is_verified', true)
      .limit(1);

    if (offered && offered.length > 0) return true;

    const { data: validator } = await supabase
      .from('academic_validators')
      .select('profile_id')
      .eq('profile_id', profileId)
      .limit(1);

    return Boolean(validator && validator.length > 0);
  } catch {
    return false;
  }
}

export const profileService = {
  // Obtener perfil del usuario actualmente autenticado
  async getMyProfile(): Promise<Profile | null> {
    try {
      const data = await apiClient.get<Profile>(API_ENDPOINTS.PROFILES.ME);
      if (data) return data;
    } catch (apiErr) {
      console.warn('[profileService] Backend API fallback para getMyProfile:', apiErr);
    }

    const user = await getOptionalAuthUser();
    if (!user) return null;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      return data as Profile;
    }

    // Inicialización predeterminada segura si el perfil aún no se ha creado en la DB
    const fallbackName = user.user_metadata?.full_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Estudiante';

    return {
      id: user.id,
      email: user.email || '',
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      display_name: fallbackName,
      avatar_url: user.user_metadata?.avatar_url || null,
      institution: '',
      career: '',
      bio: '',
      location: '',
      profile_completed: false,
      available_for_tutoring: false,
      available_for_projects: true,
      project_bio: '',
      portfolio_url: null,
      github_url: null,
      linkedin_url: null,
      phone: '',
      show_email: false,
      show_phone: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  // Obtener perfil público de cualquier estudiante por ID (respetando privacidad de contacto)
  async getProfileById(id: string): Promise<Profile | null> {
    try {
      const data = await apiClient.get<Profile>(API_ENDPOINTS.PROFILES.BY_ID(id));
      if (data) return data;
    } catch (apiErr) {
      console.warn('[profileService] Backend API fallback para getProfileById:', apiErr);
    }

    // 1. Consultar prioritariamente desde la vista segura public_profiles
    const { data: publicData, error: viewError } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!viewError && publicData) {
      return publicData as Profile;
    }

    // 2. Respaldo directo sobre profiles aplicando estricta política de privacidad
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.warn('[profileService] Perfil no encontrado:', error?.message || viewError?.message);
      return null;
    }

    const authUser = await getOptionalAuthUser();
    const isOwner = authUser?.id === data.id;

    return {
      ...data,
      email: data.show_email || isOwner ? data.email : null,
      phone: data.show_phone || isOwner ? data.phone : null,
      learning_preferences: isOwner ? data.learning_preferences : [],
    } as Profile;
  },

  // Actualizar datos del perfil del usuario en sesión a través del backend propio
  async updateMyProfile(data: UpdateProfileDTO): Promise<Profile | null> {
    const updated = await apiClient.put<Profile>(API_ENDPOINTS.PROFILES.ME, data);
    return updated;
  },

  // Actualizar específicamente las preferencias de aprendizaje inclusivas
  async updateLearningPreferences(preferences: LearningPreference[]): Promise<Profile | null> {
    return this.updateMyProfile({ learning_preferences: preferences });
  },

  // Catálogo de materias
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

    if (error || !data || data.length === 0) {
      const { getAllCatalogSubjects } = await import('./catalogResolver');
      const catalog = getAllCatalogSubjects();
      return catalog.map((cs) => ({
        id: cs.id,
        name: cs.name,
        category: cs.areaName,
        is_pilot: cs.isBoosted || false,
        created_at: new Date().toISOString(),
      }));
    }

    const list = (data || []) as Subject[];
    const hasProgWeb = list.some((s) => s.name?.toLowerCase().includes('programación web'));
    if (!hasProgWeb) {
      list.push({
        id: 'informatica_software.programacion_web',
        name: 'Programación Web',
        category: 'Tecnología e Informática',
        is_pilot: true,
        pilot_priority: 1,
        created_at: new Date().toISOString(),
      });
    }

    return list;
  },

  // Materias que un perfil enseña / ofrece
  async getOfferedSubjects(profileId: string): Promise<OfferedSubject[]> {
    const { data, error } = await supabase
      .from('profile_offered_subjects')
      .select('*, subject:subjects(*)')
      .eq('profile_id', profileId);

    if (error) {
      console.warn('[profileService] Error en getOfferedSubjects:', error.message);
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

  // Agregar materia que el usuario puede enseñar a través del backend propio
  async addOfferedSubject(
    subjectId: string,
    level: AcademicLevel,
    description?: string
  ): Promise<OfferedSubject> {
    const created = await apiClient.post<OfferedSubject>(API_ENDPOINTS.PROFILES.OFFERED_SUBJECTS, {
      subject_id: subjectId,
      level,
      description,
    });
    return created;
  },

  // Eliminar materia ofrecida a través del backend propio
  async removeOfferedSubject(subjectId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.PROFILES.OFFERED_SUBJECT_BY_ID(subjectId));
  },

  // Agregar materia que el usuario necesita aprender a través del backend propio
  async addNeededSubject(
    subjectId: string,
    currentLevel?: AcademicLevel,
    notes?: string
  ): Promise<NeededSubject> {
    const created = await apiClient.post<NeededSubject>(API_ENDPOINTS.PROFILES.NEEDED_SUBJECTS, {
      subject_id: subjectId,
      current_level: currentLevel,
      notes,
    });
    return created;
  },

  // Eliminar materia necesaria a través del backend propio
  async removeNeededSubject(subjectId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.PROFILES.NEEDED_SUBJECT_BY_ID(subjectId));
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
