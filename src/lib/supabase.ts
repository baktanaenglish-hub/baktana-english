import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | undefined;

/** The shared Supabase client; its session is kept (and refreshed) in localStorage. */
export function getSupabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'baktana-english:supabase' },
  });
  return client;
}
