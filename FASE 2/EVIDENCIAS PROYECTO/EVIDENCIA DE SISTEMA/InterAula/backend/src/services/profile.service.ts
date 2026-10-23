import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';

export const profileBackendService = {
  async getMyProfile(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al obtener perfil: ${error.message}`);
    }

    if (data) {
      return data;
    }

    // Retorna fallback seguro con datos de autenticación si no ha sido inicializado
    const fallbackName =
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'Estudiante';

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
      phone: '',
      show_email: false,
      show_phone: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async getPublicProfile(targetUserId: string, currentUserId?: string) {
    // Consulta a través de la vista protegida public_profiles
    const { data, error } = await supabasePublic
      .from('public_profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error consultando perfil público: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Regla de privacidad adicional en el servidor:
    // Si no es el propio usuario, asegurar que email y teléfono solo se expongan si el flag está activo
    const isOwner = currentUserId === targetUserId;
    return {
      ...data,
      email: data.show_email || isOwner ? data.email : null,
      phone: data.show_phone || isOwner ? data.phone : null,
    };
  },

  async updateMyProfile(user: AuthenticatedUser, token: string, updates: Record<string, any>) {
    const client = getAuthenticatedSupabase(token);

    // Protección anti mass-assignment: eliminar campos que nunca deben ser asignados por el cliente
    const sanitizedUpdates = { ...updates };
    delete (sanitizedUpdates as any).id;
    delete (sanitizedUpdates as any).email;
    delete (sanitizedUpdates as any).role;
    delete (sanitizedUpdates as any).is_admin;
    delete (sanitizedUpdates as any).is_verified;

    const payload = {
      ...sanitizedUpdates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`No fue posible actualizar el perfil: ${error.message}`);
    }

    return data;
  },

  async addOfferedSubject(
    user: AuthenticatedUser,
    token: string,
    data: { subject_id: string; level: string; description?: string }
  ) {
    const client = getAuthenticatedSupabase(token);

    // Regla de negocio: is_verified SIEMPRE comienza en false en nuevas publicaciones
    // Solo puede acreditarse a través del flujo de certificación o validador
    const payload = {
      profile_id: user.id,
      subject_id: data.subject_id,
      level: data.level,
      description: data.description?.trim() || null,
      is_verified: false,
      verified_at: null,
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await client
      .from('profile_offered_subjects')
      .upsert(payload, { onConflict: 'profile_id,subject_id' })
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      throw new Error(`Error al ofrecer materia: ${error.message}`);
    }

    return inserted;
  },

  async removeOfferedSubject(user: AuthenticatedUser, token: string, subjectId: string) {
    const client = getAuthenticatedSupabase(token);

    const { error } = await client
      .from('profile_offered_subjects')
      .delete()
      .eq('profile_id', user.id)
      .eq('subject_id', subjectId);

    if (error) {
      throw new Error(`Error al eliminar materia ofrecida: ${error.message}`);
    }

    return { success: true };
  },

  async getOfferedSubjects(userId: string) {
    const { data, error } = await supabasePublic
      .from('profile_offered_subjects')
      .select('*, subject:subjects(*)')
      .eq('profile_id', userId);

    if (error) {
      throw new Error(`Error consultando materias ofrecidas: ${error.message}`);
    }

    return data || [];
  },

  async addNeededSubject(
    user: AuthenticatedUser,
    token: string,
    data: { subject_id: string; level: string; notes?: string }
  ) {
    const client = getAuthenticatedSupabase(token);

    const payload = {
      profile_id: user.id,
      subject_id: data.subject_id,
      level: data.level,
      notes: data.notes?.trim() || null,
    };

    const { data: inserted, error } = await client
      .from('profile_needed_subjects')
      .insert(payload)
      .select('*, subject:subjects(*)')
      .single();

    if (error) {
      throw new Error(`Error al registrar necesidad de aprendizaje: ${error.message}`);
    }

    return inserted;
  },

  async removeNeededSubject(user: AuthenticatedUser, token: string, id: string) {
    const client = getAuthenticatedSupabase(token);

    const { error } = await client
      .from('profile_needed_subjects')
      .delete()
      .eq('id', id)
      .eq('profile_id', user.id);

    if (error) {
      throw new Error(`Error al eliminar materia necesitada: ${error.message}`);
    }

    return { success: true };
  },

  async getNeededSubjects(userId: string) {
    const { data, error } = await supabasePublic
      .from('profile_needed_subjects')
      .select('*, subject:subjects(*)')
      .eq('profile_id', userId);

    if (error) {
      throw new Error(`Error consultando materias necesitadas: ${error.message}`);
    }

    return data || [];
  },

  async getCatalogSubjects(onlyPilot?: boolean) {
    let query = supabasePublic
      .from('subjects')
      .select('*')
      .order('pilot_priority', { ascending: true })
      .order('name', { ascending: true });

    if (onlyPilot) {
      query = query.eq('is_pilot', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Error consultando catálogo de asignaturas: ${error.message}`);
    }

    return data || [];
  },
};
