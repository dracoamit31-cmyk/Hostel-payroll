import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing or incomplete. Please configure them in your environment settings.'
  );
}

// Initialize Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Helper to convert a phone number into the internal hidden email format
 * Example: "+91 98765 00001" -> "919876500001@hostelops.internal"
 */
export function formatInternalEmail(phone: string): string {
  const cleanDigits = phone.replace(/\D/g, '');
  return `${cleanDigits}@hostelops.internal`;
}

/**
 * Helper to extract raw digits from an internal email
 * Example: "919876500001@hostelops.internal" -> "919876500001"
 */
export function extractPhoneDigitsFromEmail(email: string): string {
  if (!email) return '';
  const [localPart] = email.split('@');
  return localPart.replace(/\D/g, '');
}
