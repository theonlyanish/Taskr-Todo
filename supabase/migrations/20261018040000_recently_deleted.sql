-- Recently deleted: deleting a task marks it (and its subtasks) with the time
-- instead of removing it, so it can be restored for 30 days from "Recently
-- deleted" in the app. Rows with deleted_at set are hidden everywhere else.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_deleted_at_idx ON public.tasks (user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.tasks.deleted_at IS 'When the task was deleted; removed for good after 30 days';

-- Remove tasks deleted more than 30 days ago, every night at 03:17 UTC, using
-- Supabase Cron (pg_cron, free on every plan). The app also clears a user's
-- own expired ones when they open it, so if Cron can't be set up here the
-- rest of this file still applies and old tasks are still removed.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  -- Running this file again replaces the job rather than adding a second one
  PERFORM cron.schedule(
    'purge-deleted-tasks',
    '17 3 * * *',
    $job$ DELETE FROM public.tasks WHERE deleted_at < now() - interval '30 days' $job$
  );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Supabase Cron not set up (%); deleted tasks are cleared by the app instead.', SQLERRM;
END;
$$;
