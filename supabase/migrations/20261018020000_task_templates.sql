-- Task templates saved by signed-in users (a task's title, description and
-- subtask titles), so they're available on every device. Built-in templates
-- live in the app and aren't stored here.
CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY,
  -- Removed with the account (see delete_own_account)
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_templates_user_id_idx ON public.task_templates (user_id);

-- Everyone sees and changes only their own templates
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own templates" ON public.task_templates
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users add their own templates" ON public.task_templates
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users delete their own templates" ON public.task_templates
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
