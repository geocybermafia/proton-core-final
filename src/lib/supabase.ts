import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RB0_nYwjmBeNFHZo9D6QjQ_GB9Bmyto';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
