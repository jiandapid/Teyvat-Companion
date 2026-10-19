import { createClient } from '@supabase/supabase-js';

const projectUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const supabaseConfigured = Boolean(projectUrl && publishableKey);
export const supabase = supabaseConfigured
  ? createClient(projectUrl, publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
