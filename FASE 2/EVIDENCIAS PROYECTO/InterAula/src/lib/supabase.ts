import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[InterAula - Supabase] Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Revisa SUPABASE_SETUP.md para configurarlas en .env.local.'
  );
}

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
