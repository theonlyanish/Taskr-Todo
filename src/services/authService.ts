import { supabase, supabaseConfig } from './supabaseClient';
import { AuthChangeEvent, User } from '@supabase/supabase-js';
import { isSupabaseUnavailable } from './supabaseErrors';
import type { Preferences } from '../utils/preferences';

export type SignOutScope = 'local' | 'others' | 'global';

export interface DeviceSession {
  id: string;
  createdAt: Date;
  lastActiveAt: Date;
  userAgent: string | null;
  isCurrent: boolean;
}

interface SessionRow {
  id: string;
  created_at: string;
  last_active_at: string;
  user_agent: string | null;
  is_current: boolean;
}

let googleEnabled: Promise<boolean> | null = null;

const OAUTH_KEY = 'oauthSignInStarted';

const markOAuthSignIn = () => {
  try {
    sessionStorage.setItem(OAUTH_KEY, '1');
  } catch {
    // The guest's tasks then stay on this device instead of moving across
  }
};

// Reads and clears the note
const takeOAuthSignIn = () => {
  try {
    const started = sessionStorage.getItem(OAUTH_KEY) === '1';
    sessionStorage.removeItem(OAUTH_KEY);
    return started;
  } catch {
    return false;
  }
};

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

  // Whether Google sign-in is switched on for this Supabase project (its
  // public auth settings), so the button only shows once it works. Asked
  // once per visit; false if the project can't be reached.
  static googleSignInEnabled(): Promise<boolean> {
    googleEnabled ??= fetch(`${supabaseConfig.url}/auth/v1/settings`, { headers: { apikey: supabaseConfig.key } })
      .then(response => (response.ok ? response.json() : null))
      .then(settings => settings?.external?.google === true)
      .catch(() => false);
    return googleEnabled;
  }

  // Leaves for Google and comes back to this page signed in. A note in the
  // tab says the sign-in was started here, so the app can then move a guest's
  // tasks into the account, as after signing in with a password.
  static async signInWithGoogle() {
    markOAuthSignIn();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      takeOAuthSignIn();
      throw error;
    }
  }

  // True once, on the page Google sent the user back to
  static finishingOAuthSignIn(): boolean {
    return takeOAuthSignIn();
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

  // Permanently deletes the account and all its tasks on the server (see the
  // delete_own_account migration), then forgets the session on this device
  static async deleteAccount() {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw error;
    // The account is gone, so there's no server session left to end
    await supabase.auth.signOut({ scope: 'local' });
  }

  // 'local' signs out this device only (supabase-js would otherwise default to
  // every device); 'others' every device but this one; 'global' all of them.
  // Other devices are signed out once their current sign-in token expires
  // (within the hour) and can't be renewed.
  static async signOut(scope: SignOutScope = 'local') {
    const { error } = await supabase.auth.signOut({ scope });
    if (error) throw error;
  }

  // Where this user is signed in (the list_my_sessions migration)
  static async listSessions(): Promise<DeviceSession[]> {
    const { data, error, status } = await supabase.rpc('list_my_sessions');
    if (error) throw Object.assign(error, { status });
    return (data as SessionRow[]).map(row => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      lastActiveAt: new Date(row.last_active_at),
      userAgent: row.user_agent,
      isCurrent: row.is_current
    }));
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