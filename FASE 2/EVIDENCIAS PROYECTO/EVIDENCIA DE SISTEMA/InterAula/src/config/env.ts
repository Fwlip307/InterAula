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
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[InterAula Config] Variables VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY no configuradas en el entorno actual. Consulta .env.example para inicializarlas.'
    );
  }

  return {
    apiUrl,
    supabaseUrl,
    supabaseAnonKey,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

export const frontendEnv = loadFrontendConfig();
