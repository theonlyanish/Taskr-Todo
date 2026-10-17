-- Lets a signed-in user delete their own account and all of their tasks.
-- Browsers can't delete Supabase users directly, so the app calls this with
-- supabase.rpc('delete_own_account'). It runs with the function owner's rights
-- (needed to remove the auth user) but only ever touches the caller's own data.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;

  -- Subtasks go with their parents (parent_id ON DELETE CASCADE), and any
  -- left over are caught by user_id too
  DELETE FROM public.tasks WHERE user_id = caller;
  DELETE FROM auth.users WHERE id = caller;
END;
$$;

-- Only signed-in users can call it
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS 'Deletes the calling user''s account and tasks (Delete account in the app)';
