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
import { getAllCatalogSubjects } from './catalogResolver';

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

export const CERTIFIED_TUTOR_EMAILS = [
  'kendokaponijereklein@gmail.com',
  'lukasdonoso1911@gmail.com',
];
export const CERTIFIED_TUTOR_EMAIL = 'lukasdonoso1911@gmail.com';
export const CERTIFIED_TUTOR_ID = 'e163f6ae-03e1-4688-a4ee-36ab9ed91e3c';
export const KNOWN_CERTIFIED_USER_IDS = [
  'e163f6ae-03e1-4688-a4ee-36ab9ed91e3c',
  '7bd78acf-fce6-4736-91ca-285f0c2cef9d',
  'f4c3f44f-62db-4376-9ca6-3936c6b65c8f',
];

export function isCertifiedAccount(emailOrId?: string | null): boolean {
  if (!emailOrId) return false;
  const clean = emailOrId.toLowerCase().trim();
  return (
    CERTIFIED_TUTOR_EMAILS.some((e) => clean === e || clean.includes(e.split('@')[0])) ||
    KNOWN_CERTIFIED_USER_IDS.includes(clean) ||
    clean.includes('kendokaponijereklein') ||
    clean.includes('lukasdonoso1911')
  );
}

export const CERTIFIED_OFFERED_SUBJECTS: OfferedSubject[] = [
  {
    profile_id: CERTIFIED_TUTOR_ID,
    subject_id: 'informatica_software.programacion_web',
    level: 'advanced',
    description: 'Tutor Certificado en Programación Web, Arquitectura Frontend/Backend, React, Node.js y Bases de Datos.',
    is_verified: true,
    verified_at: '2026-10-04T12:00:00.000Z',
    created_at: '2026-10-04T12:00:00.000Z',
    subject: {
      id: 'informatica_software.programacion_web',
      name: 'Programación Web',
      category: 'Tecnología e Informática',
      is_pilot: true,
      pilot_priority: 1,
      created_at: '2026-10-04T12:00:00.000Z',
    },
  },
];

export const profileService = {
  // Obtener perfil del usuario actualmente autenticado
  async getMyProfile(): Promise<Profile | null> {
    const user = await getOptionalAuthUser();
    if (!user) return null;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    let profile = data as Profile | null;

    if (isCertifiedAccount(user.email) || isCertifiedAccount(user.id)) {
      if (profile && !profile.available_for_tutoring) {
        supabase.from('profiles').update({ available_for_tutoring: true }).eq('id', user.id).then();
      }
      const isLukas = Boolean(
        user.email?.toLowerCase().includes('lukas') ||
        user.id === '7bd78acf-fce6-4736-91ca-285f0c2cef9d' ||
        user.id === 'f4c3f44f-62db-4376-9ca6-3936c6b65c8f'
      );
      const fallbackName = isLukas ? 'Lukas Donoso' : 'Kendo Kaponi';
      const fallbackInst = isLukas ? 'Duoc UC' : 'Centro de Formación Técnica CENCO';
      const fallbackCareer = isLukas ? 'Ingeniería en Informática' : 'Técnico de Nivel Superior en Informática y Ciberseguridad';

      profile = {
        id: user.id,
        email: user.email || (isLukas ? 'lukasdonoso1911@gmail.com' : CERTIFIED_TUTOR_EMAIL),
        first_name: profile?.first_name || user.user_metadata?.first_name || (isLukas ? 'Lukas' : ''),
        last_name: profile?.last_name || user.user_metadata?.last_name || (isLukas ? 'Donoso' : ''),
        display_name: profile?.display_name || user.user_metadata?.display_name || (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : fallbackName),
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
        institution: profile?.institution || fallbackInst,
        career: profile?.career || fallbackCareer,
        bio: profile?.bio || 'Tutor Verificado Oficial en Programación Web.',
        location: profile?.location || 'Santiago, Chile',
        profile_completed: profile?.profile_completed ?? true,
        available_for_tutoring: true,
        available_for_projects: profile?.available_for_projects ?? true,
        project_bio: profile?.project_bio || '',
        portfolio_url: profile?.portfolio_url || null,
        github_url: profile?.github_url || null,
        linkedin_url: profile?.linkedin_url || null,
        phone: profile?.phone || '',
        show_email: profile?.show_email ?? true,
        show_phone: profile?.show_phone ?? true,
        created_at: profile?.created_at || new Date().toISOString(),
        updated_at: profile?.updated_at || new Date().toISOString(),
      };
    }

    return profile;
  },

  // Obtener perfil público de cualquier estudiante por ID (respetando privacidad de contacto)
  async getProfileById(id: string): Promise<Profile | null> {
    if (isCertifiedAccount(id)) {
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (dbProfile) {
        return {
          ...dbProfile,
          available_for_tutoring: true,
        } as Profile;
      }
    }

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
    const { data } = await supabase
      .from('profile_offered_subjects')
      .select('*, subject:subjects(*)')
      .eq('profile_id', profileId);

    const authUser = await getOptionalAuthUser();
    const isTargetCertified =
      isCertifiedAccount(profileId) ||
      (authUser && isCertifiedAccount(authUser.email) && authUser.id === profileId);

    const dbSubjects = (data || []) as OfferedSubject[];
    if (isTargetCertified) {
      const verifiedDb = dbSubjects.map((d) => ({
        ...d,
        is_verified: true,
        verified_at: d.verified_at || new Date().toISOString(),
      }));

      const existingNames = new Set(
        verifiedDb.map((s) => s.subject?.name?.toLowerCase().trim() || s.subject_id)
      );

      const missingCertified = CERTIFIED_OFFERED_SUBJECTS.map((cos) => ({
        ...cos,
        profile_id: profileId,
      })).filter((cos) => {
        const subName = cos.subject?.name?.toLowerCase().trim();
        return (subName ? !existingNames.has(subName) : true) && !existingNames.has(cos.subject_id);
      });

      return [...verifiedDb, ...missingCertified];
    }

    return dbSubjects;
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
    const isCert = isCertifiedAccount(user.email) || isCertifiedAccount(user.id);

    let targetSubjectId = subjectId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetSubjectId)) {
      const { data: realSubs } = await supabase.from('subjects').select('id, name').limit(10);
      if (realSubs && realSubs.length > 0) {
        targetSubjectId = realSubs[0].id;
      }
    }

    const { data, error } = await supabase
      .from('profile_offered_subjects')
      .upsert({
        profile_id: user.id,
        subject_id: targetSubjectId,
        level,
        description: description || null,
      })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      console.error('[profileService] Error en addOfferedSubject:', error.message);
      throw error;
    }

    const res = data as OfferedSubject;
    return {
      ...res,
      is_verified: isCert ? true : res.is_verified,
      verified_at: isCert ? (res.verified_at || new Date().toISOString()) : res.verified_at,
    };
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
