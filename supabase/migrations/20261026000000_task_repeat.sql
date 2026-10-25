-- Repeating tasks: how a task repeats, as the app writes it ("week:1",
-- "month:1@31"; see src/utils/repeat.ts). Completing a repeating task adds
-- the next one as a new row, so nothing here runs on the server.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS repeat text;

COMMENT ON COLUMN public.tasks.repeat IS 'How the task repeats, e.g. week:1; null for a one-off task';
