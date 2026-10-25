import { Task } from '../types/Task';
import { supabase, toTask, TaskRow } from './supabaseClient';
import { AuthService } from './authService';
import { isSupabaseUnavailable } from './supabaseErrors';

const isoOrNull = (date: Date | null | undefined) => (date ? new Date(date).toISOString() : null);

// Columns added by later migrations (task_position, task_status_times). Until
// a migration has run, the server rejects writes that mention its column, so
// the write is retried without it and that value stays on this device only.
const OPTIONAL_COLUMNS: Record<string, string> = {
  position: 'Task order is saved on this device only until the task_position migration is run.',
  started_at: 'Stats are kept on this device only until the task_status_times migration is run.',
  completed_at: 'Stats are kept on this device only until the task_status_times migration is run.',
  list_id: 'Which list each task is in is kept on this device only until the task_lists migration is run.',
  repeat: 'Repeating tasks repeat on this device only until the task_repeat migration is run.'
};
const missingColumns = new Set<string>();

// PostgREST's "column not found in the schema cache", or Postgres's own
// "undefined column", naming one of the optional columns
const missingOptionalColumn = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST204' || error.code === '42703'
    ? Object.keys(OPTIONAL_COLUMNS).find(column => new RegExp(column, 'i').test(error.message ?? ''))
    : undefined;

const withoutMissingColumns = (data: Record<string, any>) =>
  Object.fromEntries(Object.entries(data).filter(([column]) => !missingColumns.has(column)));

// Sends a write, dropping optional columns the server doesn't have yet
const writeWithOptionalColumns = async <T extends { error: any }>(
  data: Record<string, any>,
  send: (data: Record<string, any>) => PromiseLike<T>
): Promise<T> => {
  let result = await send(withoutMissingColumns(data));
  while (result.error) {
    const column = missingOptionalColumn(result.error);
    if (!column || !(column in data) || missingColumns.has(column)) break;
    missingColumns.add(column);
    console.warn(OPTIONAL_COLUMNS[column]);
    result = await send(withoutMissingColumns(data));
  }
  return result;
};

// Shape of a new row in the tasks table. The status times are only included
// when set, so a row without them still saves before task_status_times runs.
const toRow = (task: Omit<Task, 'createdAt' | 'updatedAt'>, userId: string) => ({
  id: task.id,
  title: task.title,
  description: task.description || null,
  status: task.status,
  due_date: task.dueDate?.toISOString() || null,
  user_id: userId,
  parent_id: task.parentId || null,
  is_subtask: task.isSubtask || false,
  subtasks: task.subtasks && task.subtasks.length > 0 ? task.subtasks : [],
  ...(task.startedAt ? { started_at: isoOrNull(task.startedAt) } : {}),
  ...(task.completedAt ? { completed_at: isoOrNull(task.completedAt) } : {}),
  ...(task.listId ? { list_id: task.listId } : {}),
  ...(task.repeat ? { repeat: task.repeat } : {})
});

// Set once the server says the tasks table has no deleted_at column yet (the
// recently_deleted migration); until then deleting removes tasks straight away
let deletedColumnMissing = false;

const isMissingDeletedColumn = (error: { code?: string; message?: string }) =>
  (error.code === 'PGRST204' || error.code === '42703') && /deleted_at/i.test(error.message ?? '');

const noteDeletedColumnMissing = () => {
  if (!deletedColumnMissing) {
    deletedColumnMissing = true;
    console.warn('Deleted tasks are removed straight away until the recently_deleted migration is run.');
  }
};

// Tasks deleted this long ago are removed for good
export const KEEP_DELETED_DAYS = 30;

// One entry in Recently deleted: a task (with the subtasks deleted along with
// it), or a subtask deleted on its own
export interface DeletedTask {
  task: Task;
  deletedAt: Date;
  deletedAtRaw: string; // exactly as stored, to restore the same batch
  subtaskCount: number;
}

// Rows per insert request when saving many tasks at once
const BULK_INSERT_SIZE = 200;

export class SupabaseTaskService {
  // False until the task_lists migration has run: the server can't say which
  // list a task is in, so this device's copy does
  static storesListIds(): boolean {
    return !missingColumns.has('list_id');
  }

  // False until the task_repeat migration has run (this device's copy says)
  static storesRepeats(): boolean {
    return !missingColumns.has('repeat');
  }

  // Save many new tasks (with nested subtasks) for the signed-in user, e.g. an
  // import. Parents go in before subtasks because parent_id references them.
  // Unlike saveTask this throws, so the caller can tell the user what failed;
  // the error's savedCount says how many rows went in before it.
  static async saveTasks(tasks: Task[]): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw Object.assign(new Error('Sign in to save tasks to your account'), { savedCount: 0 });

    const parents = tasks.map(task => toRow({ ...task, subtasks: [] }, user.id));
    const subtasks = tasks.flatMap(task => (task.subtasks || []).map(subtask => toRow(subtask, user.id)));

    let savedCount = 0;
    for (const rows of [parents, subtasks]) {
      for (let start = 0; start < rows.length; start += BULK_INSERT_SIZE) {
        const batch = rows.slice(start, start + BULK_INSERT_SIZE);
        const { error, status } = await supabase.from('tasks').insert(batch);
        if (error) throw Object.assign(error, { status, savedCount });
        savedCount += batch.length;
      }
    }
  }

  static async getTasks(): Promise<Task[]> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return [];

      const { data, error, status } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw Object.assign(error, { status });
      // Rows without a list_id key: the task_lists migration hasn't run
      if (data.length > 0 && !('list_id' in data[0])) missingColumns.add('list_id');
      if (data.length > 0 && !('repeat' in data[0])) missingColumns.add('repeat');

      // Convert all tasks to our Task type
      // Leaving out tasks in Recently deleted
      const allTasks = data.filter(row => !row.deleted_at).map(toTask);
      
      // Create a map of parent tasks
      const parentTasks = allTasks.filter(task => !task.isSubtask);
      
      // Create a map of subtasks by parent ID
      const subtasksByParentId: Record<string, Task[]> = {};
      allTasks.filter(task => task.isSubtask && task.parentId).forEach(subtask => {
        if (subtask.parentId) {
          if (!subtasksByParentId[subtask.parentId]) {
            subtasksByParentId[subtask.parentId] = [];
          }
          subtasksByParentId[subtask.parentId].push(subtask);
        }
      });
      
      // Assign subtasks to their parent tasks
      parentTasks.forEach(task => {
        if (subtasksByParentId[task.id]) {
          task.subtasks = subtasksByParentId[task.id];
        }
      });
      
      return parentTasks;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // An unreachable backend (paused project, network failure) is not an
      // empty task list - surface it so the app can fall back to local tasks.
      if (isSupabaseUnavailable(error)) throw error;
      return [];
    }
  }

  // The single-task writes below come in two forms. The ...OrThrow ones report
  // every error and are used to replay the offline outbox. The everyday ones
  // keep their old "return null/false on failure" behaviour, except that an
  // unreachable backend (offline, project asleep) is rethrown so the caller
  // can queue the change instead of losing it.

  static async insertTaskOrThrow(task: Omit<Task, 'createdAt' | 'updatedAt'>, userId: string): Promise<Task> {
    const { data, error, status } = await writeWithOptionalColumns(toRow(task, userId), row =>
      supabase.from('tasks').insert([row]).select().single()
    );
    if (error) throw Object.assign(error, { status });
    return toTask(data);
  }

  static async updateTaskOrThrow(
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>,
    userId: string
  ): Promise<Task> {
    // Only the fields that were passed in are changed
    const updateData: Record<string, any> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
    if (updates.parentId !== undefined) updateData.parent_id = updates.parentId || null;
    if (updates.isSubtask !== undefined) updateData.is_subtask = updates.isSubtask;
    if (updates.subtasks !== undefined) updateData.subtasks = updates.subtasks;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.startedAt !== undefined) updateData.started_at = isoOrNull(updates.startedAt);
    if (updates.completedAt !== undefined) updateData.completed_at = isoOrNull(updates.completedAt);
    if (updates.listId !== undefined) updateData.list_id = updates.listId || null;
    if (updates.repeat !== undefined) updateData.repeat = updates.repeat || null;
    updateData.updated_at = new Date().toISOString();

    const send = (data: Record<string, any>) =>
      supabase
        .from('tasks')
        .update(data)
        .eq('id', taskId)
        .eq('user_id', userId) // Only update if the task belongs to the user
        .select('*')
        .single();

    const { data, error, status } = await writeWithOptionalColumns(updateData, send);
    if (error) throw Object.assign(error, { status });
    return toTask(data);
  }

  // Moves a task, and its subtasks, to Recently deleted. Until that's set up
  // on the server, removes them for good instead (subtasks cascade).
  static async deleteTaskOrThrow(taskId: string, userId: string): Promise<void> {
    if (!deletedColumnMissing) {
      const { error, status } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId) // Only the user's own tasks
        .or(`id.eq.${taskId},parent_id.eq.${taskId}`)
        // Subtasks deleted earlier keep their own time
        .is('deleted_at', null);
      if (!error) return;
      if (!isMissingDeletedColumn(error)) throw Object.assign(error, { status });
      noteDeletedColumnMissing();
    }
    const { error, status } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId); // Only delete if the task belongs to the user
    if (error) throw Object.assign(error, { status });
  }

  // Removes a task for good without passing through Recently deleted, e.g. the
  // next one of a repeating task when its completion is undone
  static async discardTaskOrThrow(taskId: string, userId: string): Promise<void> {
    const { error, status } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', userId)
      .or(`id.eq.${taskId},parent_id.eq.${taskId}`);
    if (error) throw Object.assign(error, { status });
  }

  // Everything in Recently deleted, newest first; null until it's set up on the server
  static async getDeletedTasks(): Promise<DeletedTask[] | null> {
    if (deletedColumnMissing) return null;
    const user = await AuthService.getCurrentUser();
    if (!user) return [];
    const { data, error, status } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) {
      if (isMissingDeletedColumn(error)) {
        noteDeletedColumnMissing();
        return null;
      }
      throw Object.assign(error, { status });
    }
    const rows = data as (TaskRow & { deleted_at: string })[];
    const deletedIds = new Set(rows.map(row => row.id));
    return rows
      // A subtask whose parent is also in the bin comes back with the parent
      .filter(row => !(row.parent_id && deletedIds.has(row.parent_id)))
      .map(row => ({
        task: toTask(row),
        deletedAt: new Date(row.deleted_at),
        deletedAtRaw: row.deleted_at,
        subtaskCount: rows.filter(sub => sub.parent_id === row.id && sub.deleted_at === row.deleted_at).length
      }));
  }

  // Brings back a task and the subtasks deleted along with it
  static async restoreTask(entry: DeletedTask): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) return;
    const { error, status } = await supabase
      .from('tasks')
      .update({ deleted_at: null })
      .eq('user_id', user.id)
      .or(`id.eq.${entry.task.id},and(parent_id.eq.${entry.task.id},deleted_at.eq.${entry.deletedAtRaw})`);
    if (error) throw Object.assign(error, { status });
  }

  // Removes a deleted task for good (its subtasks go with it)
  static async deleteForever(taskId: string): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) return;
    const { error, status } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('id', taskId)
      .not('deleted_at', 'is', null);
    if (error) throw Object.assign(error, { status });
  }

  static async emptyRecentlyDeleted(): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) return;
    const { error, status } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null);
    if (error) throw Object.assign(error, { status });
  }

  // Removes this user's tasks deleted over 30 days ago. A nightly job on the
  // server does the same for everyone; this covers projects without it.
  static async removeExpiredDeleted(): Promise<void> {
    if (deletedColumnMissing) return;
    const user = await AuthService.getCurrentUser();
    if (!user) return;
    const cutoff = new Date(Date.now() - KEEP_DELETED_DAYS * 86_400_000).toISOString();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .lt('deleted_at', cutoff);
    if (error && isMissingDeletedColumn(error)) noteDeletedColumnMissing();
  }

  // Static method to save a new task to the database
  static async saveTask(task: Omit<Task, 'createdAt' | 'updatedAt'>): Promise<Task | null> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return null;
      return await SupabaseTaskService.insertTaskOrThrow(task, user.id);
    } catch (error) {
      console.error('Error saving task:', error);
      if (isSupabaseUnavailable(error)) throw error;
      return null;
    }
  }

  // Static method to update an existing task in the database
  static async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return null;
      return await SupabaseTaskService.updateTaskOrThrow(taskId, updates, user.id);
    } catch (error) {
      console.error('Error updating task:', error);
      if (isSupabaseUnavailable(error)) throw error;
      return null;
    }
  }

  // Static method to delete a task from the database
  static async deleteTask(taskId: string): Promise<boolean> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return false;
      await SupabaseTaskService.deleteTaskOrThrow(taskId, user.id);
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      if (isSupabaseUnavailable(error)) throw error;
      return false;
    }
  }
}
