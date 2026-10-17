/**
 * Helpers for telling "the Supabase backend is unreachable" apart from an
 * ordinary API error such as a wrong password.
 *
 * The free-tier project pauses after about a week without API activity. While
 * paused, requests fail at the network level (fetch rejects with a TypeError),
 * with a 5xx from the gateway, or with Supabase's 540 "project paused"
 * response. None of those are the user's fault, so the UI shows a friendly
 * message instead of the raw error string.
 */

export const CLOUD_ASLEEP_MESSAGE =
  'Cloud sync is asleep right now. Your tasks are still saved on this device.';

// Browser fetch() failure messages (Chrome, Firefox, Safari, Node) and the
// wording Supabase uses for a paused project.
const UNAVAILABLE_MESSAGE =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed|project (is )?paused|service unavailable|bad gateway|gateway time-?out/i;

// Plain-language versions of Supabase auth errors. suggestSignIn marks the
// "account already exists" case so the dialog can offer to switch modes.
const AUTH_MESSAGES: { match: RegExp; message: string; suggestSignIn?: boolean }[] = [
  { match: /invalid login credentials/i, message: 'That email and password don’t match. Check them and try again.' },
  { match: /email not confirmed/i, message: 'Confirm your email first. Open the link we sent to your inbox, then sign in.' },
  { match: /already (been )?registered|already exists/i, message: 'There’s already an account with that email.', suggestSignIn: true },
  { match: /password should be at least|password is too short/i, message: 'Use at least 6 characters for your password.' },
  { match: /should be different from the old password/i, message: 'Choose a password you haven’t used for this account before.' },
  { match: /rate limit|too many requests|only request this after/i, message: 'Too many attempts. Wait a minute, then try again.' },
  { match: /unable to validate email|invalid email|email address .* is invalid/i, message: 'That doesn’t look like a valid email address.' },
  { match: /auth session missing|session.*expired|invalid.*(token|link)|link.*(invalid|expired)/i, message: 'That link has expired. Request a new password reset email.' }
];

export const friendlyAuthError = (error: unknown): { message: string; suggestSignIn?: boolean } => {
  if (isSupabaseUnavailable(error)) return { message: CLOUD_ASLEEP_MESSAGE };
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const known = AUTH_MESSAGES.find(entry => entry.match.test(raw));
  if (known) return { message: known.message, suggestSignIn: known.suggestSignIn };
  return { message: raw ? `Something went wrong: ${raw}` : 'Something went wrong. Try again.' };
};

export const isSupabaseUnavailable = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const { name, message, status } = error as { name?: unknown; message?: unknown; status?: unknown };

  // supabase-js auth wraps network failures and 502-504 responses in this error;
  // AuthUnknownError is what a non-JSON gateway page (e.g. the 540 paused page) becomes.
  if (name === 'AuthRetryableFetchError' || name === 'AuthUnknownError') return true;

  // postgrest-js reports a failed fetch as status 0; 5xx and 540 come from the gateway.
  if (typeof status === 'number' && (status === 0 || status >= 500)) return true;

  return typeof message === 'string' && UNAVAILABLE_MESSAGE.test(message);
};
