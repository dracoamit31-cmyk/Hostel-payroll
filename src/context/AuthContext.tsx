import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getUsers } from '../mockData';
import {
  supabase,
  formatInternalEmail,
  extractPhoneDigitsFromEmail,
  isSupabaseConfigured,
} from '../supabaseClient';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  loginWithPhonePin: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // For backwards compatibility and direct profile switching
  login: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to resolve User profile by phone digits from mockData
  const resolveUserProfileByPhone = async (phoneDigits: string): Promise<User | null> => {
    if (!phoneDigits) return null;
    const users = await getUsers();
    const cleanDigits = phoneDigits.replace(/\D/g, '');
    const matched = users.find((u) => u.phone.replace(/\D/g, '') === cleanDigits);
    return matched || null;
  };

  // Sync Supabase Auth Session
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(data.session);

        if (data.session?.user?.email) {
          const phoneDigits = extractPhoneDigitsFromEmail(data.session.user.email);
          const profile = await resolveUserProfileByPhone(phoneDigits);
          if (profile && mounted) {
            setCurrentUser(profile);
          }
        }
      } catch (err) {
        console.error('Error initializing auth session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      if (newSession?.user?.email) {
        const phoneDigits = extractPhoneDigitsFromEmail(newSession.user.email);
        const profile = await resolveUserProfileByPhone(phoneDigits);
        if (profile && mounted) {
          setCurrentUser(profile);
        }
      } else {
        if (mounted) {
          setCurrentUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Log in with Phone Number and PIN
   * Internally maps phone to ${digits}@hostelops.internal and PIN to password
   */
  const loginWithPhonePin = async (
    phone: string,
    pin: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const email = formatInternalEmail(phone);
      const cleanPhoneDigits = phone.replace(/\D/g, '');

      // Verify that this phone corresponds to a known user in the system
      const userProfile = await resolveUserProfileByPhone(cleanPhoneDigits);
      if (!userProfile) {
        return {
          success: false,
          error: `No staff or manager profile found registered with phone number ${phone}.`,
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (error) {
        // If the user doesn't exist in Supabase Auth yet (e.g. first time login),
        // we can attempt an automatic initial registration.
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('user not found')
        ) {
          // Attempt sign-up for seamless onboarding of mock accounts in Supabase
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password: pin,
            options: {
              data: {
                phone: userProfile.phone,
                name: userProfile.name,
                role: userProfile.role,
              },
            },
          });

          if (signUpError) {
            // Check if rate limited on email sending (Supabase default is 3 emails/hour for signups unless email confirmation is disabled)
            if (signUpError.message.toLowerCase().includes('rate limit')) {
              // Set the mock user profile directly so development isn't blocked by Supabase's built-in email rate limiter
              setCurrentUser(userProfile);
              return {
                success: true,
                error:
                  'Note: Supabase email rate limit reached. Signed in locally with user profile. (To fix this permanently, disable "Confirm email" in your Supabase Dashboard under Authentication -> Providers -> Email).',
              };
            }

            return {
              success: false,
              error: `Supabase Auth Error: ${error.message}. (Sign-up fallback: ${signUpError.message})`,
            };
          }

          if (signUpData.session) {
            setSession(signUpData.session);
            setCurrentUser(userProfile);
            return { success: true };
          } else if (signUpData.user && !signUpData.session) {
            // If email confirmation is enabled in Supabase, session is null until confirmed.
            // Allow login to proceed for development with the matched profile while advising how to disable email confirmation in Supabase:
            setCurrentUser(userProfile);
            return {
              success: true,
              error:
                'Signed in. Note: In your Supabase Dashboard under Authentication > Providers > Email, turn OFF "Confirm email" so that new users get logged in immediately without email verification.',
            };
          }
        }

        return {
          success: false,
          error: error.message || 'Failed to authenticate with Supabase.',
        };
      }

      if (data.session) {
        setSession(data.session);
        setCurrentUser(userProfile);
        return { success: true };
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown authentication error';
      return { success: false, error: errorMsg };
    }
  };

  /**
   * Log out from Supabase Auth
   */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during Supabase signOut:', err);
    } finally {
      setSession(null);
      setCurrentUser(null);
    }
  };

  /**
   * Direct login helper (for mock switching / fallback)
   */
  const login = (user: User) => {
    setCurrentUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        loading,
        isSupabaseConfigured,
        loginWithPhonePin,
        logout,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

