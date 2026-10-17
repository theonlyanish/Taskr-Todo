import { supabase } from './supabaseClient';
import { AuthChangeEvent, User } from '@supabase/supabase-js';
import { isSupabaseUnavailable } from './supabaseErrors';

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

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    // A missing session simply means "not signed in", but an unreachable
    // backend must not be mistaken for that - let callers show a notice.
    if (error && isSupabaseUnavailable(error)) throw error;
    return user;
  }

  static subscribeToAuthChanges(callback: (user: User | null, event: AuthChangeEvent) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null, event);
    });
  }
} 