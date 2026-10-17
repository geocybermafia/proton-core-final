import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://ntndwrpruyrttlpjptzf.supabase.co';

export const SUPABASE_ANON_KEY = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_RB0_nYwjmBeNFHZo9D6QjQ_GB9Bmyto';

// Use environment variables for Supabase connection with configured fallback
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to determine if Supabase integration is active and configured
export const isSupabaseConfigured = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder'));
};


