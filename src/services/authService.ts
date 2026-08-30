import { User } from '../types';
import { isProduction } from '../config/env';
import {
  supabase,
  formatInternalEmail,
  extractPhoneDigitsFromEmail,
} from '../supabaseClient';
import * as mockData from '../mockData';

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  /**
   * Log in using phone number and numeric PIN.
   * In Development: Authenticates against local mock data store.
   * In Production: Authenticates against Supabase Auth using internal email + PIN,
   * then fetches user profile from the `users` table.
   */
  async loginWithPhonePin(phone: string, pin: string): Promise<AuthResponse> {
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits) {
      return { success: false, error: 'Please provide a valid phone number.' };
    }

    if (!pin || pin.length < 4 || pin.length > 6) {
      return { success: false, error: 'PIN must be between 4 and 6 digits.' };
    }

    // DEVELOPMENT MODE: Always use local mock profiles
    if (!isProduction()) {
      const users = await mockData.getUsers();
      const user = users.find((u) => u.phone.replace(/\D/g, '') === cleanDigits);

      if (!user) {
        return {
          success: false,
          error: `[DEV MODE] No user profile found for phone ${phone}. Use quick-select personas below.`,
        };
      }

      // In dev mode, default PIN '123456' or any 4-6 digit PIN is accepted
      try {
        localStorage.setItem('hostelops_dev_auth_user', JSON.stringify(user));
      } catch {
        // ignore localStorage errors in sandboxed iframes
      }
      return { success: true, user };
    }

    // PRODUCTION MODE: Real Supabase Auth
    try {
      const email = formatInternalEmail(phone);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Invalid phone number or PIN.',
        };
      }

      if (!data.user) {
        return { success: false, error: 'User account not found.' };
      }

      // Fetch user profile from Supabase `users` table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        // Fallback: search by phone
        const { data: profileByPhone } = await supabase
          .from('users')
          .select('*')
          .eq('phone', phone)
          .single();

        if (profileByPhone) {
          const user: User = {
            id: profileByPhone.id,
            name: profileByPhone.name,
            phone: profileByPhone.phone,
            role: profileByPhone.role,
            propertyId: profileByPhone.property_id,
            staffType: profileByPhone.staff_type,
            shiftStart: profileByPhone.shift_start,
            shiftEnd: profileByPhone.shift_end,
          };
          return { success: true, user };
        }

        return {
          success: false,
          error: 'User profile not found in database.',
        };
      }

      const user: User = {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        propertyId: profile.property_id,
        staffType: profile.staff_type,
        shiftStart: profile.shift_start,
        shiftEnd: profile.shift_end,
      };

      return { success: true, user };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown authentication error';
      return { success: false, error: msg };
    }
  },

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    if (isProduction()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase sign out error:', err);
      }
    } else {
      try {
        localStorage.removeItem('hostelops_dev_auth_user');
      } catch {
        // ignore
      }
    }
  },

  /**
   * Restore initial session on application load
   */
  async getInitialUser(): Promise<User | null> {
    if (!isProduction()) {
      try {
        const cached = localStorage.getItem('hostelops_dev_auth_user');
        if (cached) {
          return JSON.parse(cached) as User;
        }
      } catch {
        // fallback
      }
      return null;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return null;

      const userId = data.session.user.id;
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profile && data.session.user.email) {
        const phoneDigits = extractPhoneDigitsFromEmail(data.session.user.email);
        const { data: profileByPhone } = await supabase
          .from('users')
          .select('*')
          .ilike('phone', `%${phoneDigits}%`)
          .single();

        if (profileByPhone) {
          return {
            id: profileByPhone.id,
            name: profileByPhone.name,
            phone: profileByPhone.phone,
            role: profileByPhone.role,
            propertyId: profileByPhone.property_id,
            staffType: profileByPhone.staff_type,
            shiftStart: profileByPhone.shift_start,
            shiftEnd: profileByPhone.shift_end,
          };
        }
        return null;
      }

      if (!profile) return null;

      return {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        propertyId: profile.property_id,
        staffType: profile.staff_type,
        shiftStart: profile.shift_start,
        shiftEnd: profile.shift_end,
      };
    } catch (err) {
      console.error('Error fetching initial user profile:', err);
      return null;
    }
  },
};
