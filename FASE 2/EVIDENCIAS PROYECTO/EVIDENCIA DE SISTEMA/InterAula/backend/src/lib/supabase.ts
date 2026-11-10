import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

/**
 * Cliente público general de Supabase (anon).
 */
export const supabasePublic: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Crea un cliente de Supabase autenticado en el contexto del usuario actual.
 * Cada consulta ejecutada con este cliente respeta estrictamente las políticas RLS
 * configuradas en PostgreSQL con el UID del usuario que emitió el token.
 */
export function getAuthenticatedSupabase(bearerToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`,
      },
    },
  });
}

/**
 * Cliente administrativo con privilegios elevados (service_role).
 * Se utiliza de forma restrictiva y justificada exclusivamente en el servidor
 * para tareas de sistema que no deben ser manipuladas por el cliente.
 */
let adminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (!env.supabaseServiceRoleKey) {
    throw new HttpError(503, 'La acreditación automática no está disponible. Puedes solicitar revisión docente.');
  }

  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}
