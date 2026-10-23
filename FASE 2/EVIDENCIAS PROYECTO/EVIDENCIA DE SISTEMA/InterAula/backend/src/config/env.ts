import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  geminiApiKey?: string;
}

function loadConfig(): AppConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Configuración inválida: SUPABASE_URL no está definida en las variables de entorno.');
  }

  if (!supabaseAnonKey) {
    throw new Error('Configuración inválida: SUPABASE_ANON_KEY no está definida en las variables de entorno.');
  }

  const corsRaw = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000';
  const corsOrigins = corsRaw.split(',').map((origin) => origin.trim()).filter(Boolean);

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  };
}

export const env = loadConfig();
