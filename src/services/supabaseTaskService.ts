import { Task } from '../types/Task';
import { supabase, toTask } from './supabaseClient';
import { AuthService } from './authService';
import { isSupabaseUnavailable } from './supabaseErrors';

// Shape of a new row in the tasks table
const toRow = (task: Omit<Task, 'createdAt' | 'updatedAt'>, userId: string) => ({
  id: task.id,
  title: task.title,
  description: task.description || null,
  status: task.status,
  due_date: task.dueDate?.toISOString() || null,
  user_id: userId,
  parent_id: task.parentId || null,
  is_subtask: task.isSubtask || false,
  subtasks: task.subtasks && task.subtasks.length > 0 ? task.subtasks : []
});

// Rows per insert request when saving many tasks at once
const BULK_INSERT_SIZE = 200;

export class SupabaseTaskService {
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
      
      // Convert all tasks to our Task type
      const allTasks = data.map(toTask);
      
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
    const { data, error, status } = await supabase
      .from('tasks')
      .insert([toRow(task, userId)])
      .select()
      .single();
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
    updateData.updated_at = new Date().toISOString();

    const { data, error, status } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', userId) // Only update if the task belongs to the user
      .select('*')
      .single();
    if (error) throw Object.assign(error, { status });
    return toTask(data);
  }

  static async deleteTaskOrThrow(taskId: string, userId: string): Promise<void> {
    const { error, status } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId); // Only delete if the task belongs to the user
    if (error) throw Object.assign(error, { status });
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
