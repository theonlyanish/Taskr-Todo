import { supabase } from './supabaseClient';
import { AuthChangeEvent, User } from '@supabase/supabase-js';
import { isSupabaseUnavailable } from './supabaseErrors';
import type { Preferences } from '../utils/preferences';

export class AuthService {
  static async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  // Emails a link back to this site; opening it signs the user in with a
  // PASSWORD_RECOVERY event so they can choose a new password
  static async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }

  static async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return data;
  }

  // Settings that follow the user between devices, kept on the account itself
  // (Supabase user metadata), so they need no table of their own
  static async savePreferences(preferences: Preferences) {
    const { error } = await supabase.auth.updateUser({ data: { preferences } });
    if (error) throw error;
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    // A missing session simply means "not signed in", but an unreachable
    // backend must not be mistaken for that.
    if (error && isSupabaseUnavailable(error)) {
      // Offline or asleep: getUser() needs the network, but the session saved
      // on this device still says who is signed in, so offline work can carry
      // on (changes are queued and synced later). With no session, report it.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return session.user;
      throw error;
    }
    return user;
  }

  static subscribeToAuthChanges(callback: (user: User | null, event: AuthChangeEvent) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null, event);
    });
  }
} 