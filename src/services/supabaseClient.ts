import { createClient } from '@supabase/supabase-js';
import { Task } from '../types/Task';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing environment variables for Supabase configuration');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Define the Supabase table structure
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

// Helper functions to convert between our app's Task type and Supabase's format
export const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  status: row.status,
  dueDate: row.due_date ? new Date(row.due_date) : undefined,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at)
});
