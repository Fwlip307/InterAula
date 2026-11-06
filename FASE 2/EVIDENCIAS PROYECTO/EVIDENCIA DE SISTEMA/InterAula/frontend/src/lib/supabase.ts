import { createClient } from '@supabase/supabase-js';
import { frontendEnv } from '../config/env';

const supabaseUrl = frontendEnv.supabaseUrl;
const supabasePublishableKey = frontendEnv.supabaseAnonKey;

// Inicializa el cliente de Supabase para InterAula con persistencia de sesión
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
