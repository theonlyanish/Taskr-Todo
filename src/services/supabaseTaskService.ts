import { Task } from '../types/Task';
import { supabase, toTask } from './supabaseClient';

export class SupabaseTaskService {
  static async getTasks(): Promise<Task[]> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(toTask);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }

  // Static method to save a new task to the database
  static async saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task | null> {
    try {
      const newTaskData = {
        title: task.title,
        description: task.description || null,
        status: task.status,
        due_date: task.dueDate?.toISOString() || null,
      };

      // Inserting the new task into the database and selecting the inserted data
      const { data, error } = await supabase
        .from('tasks')
        .insert([newTaskData])
        .select()
        .single();

      // Checking for errors and throwing if any
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // Returning the inserted task data transformed to the Task interface, or null if insertion failed
      return data ? toTask(data) : null;
    } catch (error) {
      console.error('Error saving task:', error);
      return null;
    }
  }

  // Static method to update an existing task in the database
  static async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    try {
      // Creating an update object with the provided updates
      const updateData: Record<string, any> = {};
      
      // Dynamically adding updates to the updateData object
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate?.toISOString() || null;

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      // Returning the updated task data transformed to the Task interface, or null if update failed
      return data ? toTask(data) : null;
    } catch (error) {
      console.error('Error updating task:', error);
      return null;
    }
  }

  // Static method to delete a task from the database
  static async deleteTask(taskId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }
} 