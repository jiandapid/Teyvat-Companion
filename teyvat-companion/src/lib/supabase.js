import { createClient } from '@supabase/supabase-js';

// Supabase publishable keys are intended for browser applications. These defaults
// let the free hosted project work without Vercel secrets; environment variables
// may override them for local/testing deployments. Row-level security—not this
// public key—restricts users to their own workspace rows.
const projectUrl = String(import.meta.env.VITE_SUPABASE_URL || 'https://ktsgeuswodqhfbfbmeci.supabase.co').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CcTdZ2vlAYIU0mx09KOsYg_Q7r1S3xj').trim();

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
