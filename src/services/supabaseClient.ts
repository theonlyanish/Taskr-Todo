import { createClient } from '@supabase/supabase-js';
import { Task } from '../types/Task';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing environment variables for Supabase configuration');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// For the few requests supabase-js has no call for (the auth settings). The
// anon key is public by design; row level security protects the data.
export const supabaseConfig = { url: supabaseUrl, key: supabaseKey };

// Define the Supabase table structure
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  due_date: string | null;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  is_subtask: boolean | null;
  subtasks: any[] | null;
  position?: number | null; // absent until the task_position migration has run
  deleted_at?: string | null; // set while in Recently deleted (recently_deleted migration)
  started_at?: string | null; // these two need the task_status_times migration
  completed_at?: string | null;
  list_id?: string | null; // needs the task_lists migration
  repeat?: string | null; // needs the task_repeat migration
}

// Helper functions to convert between our app's Task type and Supabase's format
export const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  status: row.status,
  dueDate: row.due_date ? new Date(row.due_date) : undefined,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  parentId: row.parent_id || undefined,
  isSubtask: row.is_subtask || false,
  subtasks: row.subtasks ? row.subtasks.map(st => toTask(st as TaskRow)) : [],
  position: row.position ?? undefined,
  startedAt: row.started_at ? new Date(row.started_at) : undefined,
  completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  listId: row.list_id ?? undefined,
  repeat: row.repeat ?? undefined
});
