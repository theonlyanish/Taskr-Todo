import { supabase } from './supabaseClient';
import { DEFAULT_LIST_ID, TaskList } from '../utils/taskLists';

// The signed-in user's lists (the task_lists table, added by the task_lists
// migration; row level security limits everyone to their own). Until that
// migration has run, lists stay on each device.

interface ListRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

const toList = (row: ListRow): TaskList => ({
  id: row.id,
  name: row.name,
  color: row.color,
  createdAt: new Date(row.created_at).toISOString()
});

let tableMissing = false;

// PostgREST's "table not in the schema cache", or Postgres's "relation does not exist"
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST205' ||
  error.code === '42P01' ||
  (/task_lists/.test(error.message ?? '') && /not find|does not exist/i.test(error.message ?? ''));

const noteMissingTable = () => {
  if (!tableMissing) {
    tableMissing = true;
    console.warn('Lists are saved on this device only until the task_lists migration is run.');
  }
};

export class ListService {
  // The account's lists, or null when they can only be kept on this device
  static async list(): Promise<TaskList[] | null> {
    if (tableMissing) return null;
    const { data, error, status } = await supabase
      .from('task_lists')
      .select('id, name, color, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingTable(error)) {
        noteMissingTable();
        return null;
      }
      throw Object.assign(error, { status });
    }
    return (data as ListRow[]).map(toList);
  }

  // Adds a list, or saves a new name or colour
  static async save(list: TaskList, userId: string): Promise<void> {
    if (tableMissing || list.id === DEFAULT_LIST_ID) return;
    const { error, status } = await supabase.from('task_lists').upsert([{
      id: list.id,
      user_id: userId,
      name: list.name,
      color: list.color,
      created_at: list.createdAt
    }]);
    if (error) {
      if (isMissingTable(error)) return noteMissingTable();
      throw Object.assign(error, { status });
    }
  }

  // Tasks in it are moved or deleted by the app first; any left over show in Personal
  static async remove(listId: string, userId: string): Promise<void> {
    if (tableMissing || listId === DEFAULT_LIST_ID) return;
    const { error, status } = await supabase
      .from('task_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId);
    if (error) {
      if (isMissingTable(error)) return noteMissingTable();
      throw Object.assign(error, { status });
    }
  }
}
