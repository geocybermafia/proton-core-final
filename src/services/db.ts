/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { db } from '../firebase';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Re-export unified Firestore instance from primary Firebase configuration
export const firestore = db;
