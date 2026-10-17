-- Where the user dragged a task within its section or column. Tasks that were
-- never moved leave this empty and are ordered by created_at, on the same
-- scale (milliseconds since 1970), so no existing rows need filling in.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS position double precision;

COMMENT ON COLUMN public.tasks.position IS 'Drag-and-drop order within a status; null means order by created_at';
