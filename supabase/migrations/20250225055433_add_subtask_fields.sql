-- Add subtask fields to tasks table
ALTER TABLE tasks 
  ADD COLUMN parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN is_subtask BOOLEAN DEFAULT FALSE,
  ADD COLUMN subtasks JSONB DEFAULT '[]'::jsonb;

-- Create an index on parent_id for faster queries
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);

-- Add comments to explain the purpose of the new fields
COMMENT ON COLUMN tasks.parent_id IS 'References the parent task for subtasks';
COMMENT ON COLUMN tasks.is_subtask IS 'Flag indicating whether this task is a subtask';
COMMENT ON COLUMN tasks.subtasks IS 'JSON array containing subtask data for quick access';
