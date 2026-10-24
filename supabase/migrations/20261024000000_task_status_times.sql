-- When a task last moved to In Progress, and when it was completed, for the
-- stats page (tasks done per week, streaks, time spent in progress). Tasks
-- completed before this ran have no completed_at; the app falls back to their
-- last edit time, so no existing rows need filling in.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.tasks.started_at IS 'When the task last moved to In Progress; cleared if moved back to To Do';
COMMENT ON COLUMN public.tasks.completed_at IS 'When the task was completed; cleared if reopened';
