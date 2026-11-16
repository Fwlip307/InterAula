/**
 * Configuración de entorno centralizada para el Frontend (Vite).
 * Valida y expone variables VITE_* de forma tipada, segura y sin valores hardcodeados de producción.
 */

export interface FrontendConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

function loadFrontendConfig(): FrontendConfig {
  const metaEnv = (import.meta as any).env ?? (globalThis as any).process?.env ?? {};
  const apiUrl = (metaEnv.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
  const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[InterAula Config] Variables VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY no configuradas en el entorno actual. Consulta .env.example para inicializarlas.'
    );
  }

  return {
    apiUrl,
    supabaseUrl,
    supabaseAnonKey,
    isDevelopment: Boolean(metaEnv.DEV ?? true),
    isProduction: Boolean(metaEnv.PROD ?? false),
  };
}

export const frontendEnv = loadFrontendConfig();
