import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isProduction, getSupabaseConfig } from './config/env';

const config = getSupabaseConfig();

export const isSupabaseConfigured = config.isConfigured;

// Fail-safe client initialization:
// In development, we use dummy values if credentials aren't provided because
// all queries route to local mock storage.
// In production, we require real credentials and fail clearly.
if (isProduction() && !isSupabaseConfigured) {
  console.error(
    'CRITICAL PRODUCTION ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in production mode!'
  );
}

export const supabase: SupabaseClient = createClient(
  config.url || 'https://placeholder.supabase.co',
  config.anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: isProduction(),
      autoRefreshToken: isProduction(),
      detectSessionInUrl: isProduction(),
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
