-- Where the signed-in user is signed in, for the "Signed-in devices" list in
-- the app. Read-only: signing devices out uses Supabase's own sign-out
-- (signOut with scope 'others' or 'global'). Browsers can't read auth.sessions
-- directly, so this runs with the owner's rights but only ever returns the
-- caller's own sessions, and only what the list shows (no IP addresses).
CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id,
    s.created_at,
    COALESCE(s.refreshed_at, s.updated_at, s.created_at),
    s.user_agent,
    s.id::text = (auth.jwt() ->> 'session_id')
  FROM auth.sessions s
  WHERE s.user_id = auth.uid()
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY 3 DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
