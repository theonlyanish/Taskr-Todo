-- Lists (projects) that a signed-in user sorts tasks into: Work, Home, a
-- trip. Personal is built into the app and isn't stored: it holds every task
-- with no list_id.
CREATE TABLE IF NOT EXISTS public.task_lists (
  id uuid PRIMARY KEY,
  -- Removed with the account (see delete_own_account)
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_lists_user_id_idx ON public.task_lists (user_id);

-- Everyone sees and changes only their own lists
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own lists" ON public.task_lists
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users add their own lists" ON public.task_lists
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users change their own lists" ON public.task_lists
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users delete their own lists" ON public.task_lists
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Which list a task is in. Deliberately not a foreign key: the app treats a
-- task whose list is unknown as being in Personal, so a list deleted on one
-- device, or a guest's list that reaches the account after its tasks, can
-- never make tasks fail to save or disappear.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS list_id uuid;

CREATE INDEX IF NOT EXISTS tasks_list_id_idx ON public.tasks (user_id, list_id);

COMMENT ON COLUMN public.tasks.list_id IS 'The task_lists row it belongs to; null (or an unknown id) means Personal';
