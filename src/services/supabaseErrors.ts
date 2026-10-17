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
