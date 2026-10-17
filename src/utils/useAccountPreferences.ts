import { useCallback, useEffect, useRef } from 'react';
import { AuthService } from '../services/authService';
import { Preferences, parsePreferences, preferencesKey } from './preferences';

// Keeps the signed-in user's settings (theme, view, calendar layout) on their
// account, so another device opens the way they left it.
//
// On sign-in, or on loading while signed in, the account's settings are
// applied, unless this device changed them while it couldn't reach the account,
// in which case this device's settings are sent instead (the latest change
// wins). After that, every change is saved to the account shortly after it's
// made. A change that can't be saved is retried when the connection returns,
// or on the next load.

// Which account has changes on this device that haven't reached it yet
const UNSYNCED_KEY = 'preferencesUnsyncedFor';

const unsyncedFor = (): string | null => {
  try {
    return localStorage.getItem(UNSYNCED_KEY);
  } catch {
    return null;
  }
};

const setUnsyncedFor = (userId: string | null) => {
  try {
    if (userId) localStorage.setItem(UNSYNCED_KEY, userId);
    else localStorage.removeItem(UNSYNCED_KEY);
  } catch {
    // Retried on the next change instead
  }
};

// Wait this long after a change before saving, so flicking through views
// sends one update rather than several
const SAVE_DELAY_MS = 800;

export const useAccountPreferences = (
  userId: string | undefined,
  current: Preferences,
  apply: (preferences: Preferences) => void
) => {
  // What the account has, as a preferencesKey; null until it has been read
  const syncedKeyRef = useRef<string | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const save = useCallback(async (id: string) => {
    const preferences = currentRef.current;
    const key = preferencesKey(preferences);
    try {
      await AuthService.savePreferences(preferences);
      syncedKeyRef.current = key;
      // Unless something changed again while this was being sent
      if (preferencesKey(currentRef.current) === key && unsyncedFor() === id) {
        setUnsyncedFor(null);
      }
    } catch {
      // Offline or the account couldn't be reached: retried later
      setUnsyncedFor(id);
    }
  }, []);

  // Signed in, or loaded while signed in: bring the account and this device into line
  useEffect(() => {
    syncedKeyRef.current = null;
    if (!userId) return;

    let cancelled = false;
    (async () => {
      let saved: Preferences | null = null;
      try {
        // Fresh from the server when it's reachable, so a change made on
        // another device shows up; otherwise the copy saved on this device
        const user = await AuthService.getCurrentUser();
        if (user?.id === userId) saved = parsePreferences(user.user_metadata?.preferences);
      } catch {
        // Keep this device's settings
      }
      if (cancelled) return;

      if (saved && unsyncedFor() !== userId) {
        applyRef.current(saved);
        // Settings the account doesn't have yet keep this device's value
        syncedKeyRef.current = preferencesKey({ ...currentRef.current, ...withoutBlanks(saved) });
      } else {
        // Nothing on the account yet (first sign-in since this was added), or
        // this device has newer changes
        syncedKeyRef.current = saved ? preferencesKey(saved) : '';
        save(userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, save]);

  // A setting changed: save it to the account
  const currentKey = preferencesKey(current);
  useEffect(() => {
    // Not signed in, or still reading the account
    if (!userId || syncedKeyRef.current === null) return;
    if (syncedKeyRef.current === currentKey) {
      // Back to what the account already has (say, a view switched and switched
      // back), so there's nothing waiting to be sent
      if (unsyncedFor() === userId) setUnsyncedFor(null);
      return;
    }
    // Marked first, so closing the tab before it's sent still gets it sent next time
    setUnsyncedFor(userId);
    const timer = setTimeout(() => save(userId), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, currentKey, save]);

  // Back online: send anything that couldn't be saved earlier
  useEffect(() => {
    if (!userId) return;
    const handleOnline = () => {
      if (unsyncedFor() === userId) save(userId);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId, save]);
};

const withoutBlanks = (preferences: Preferences): Preferences =>
  Object.fromEntries(Object.entries(preferences).filter(([, value]) => value !== undefined));
