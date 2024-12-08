import { Task } from '../types/Task';
import { supabase, toTask, toTaskRow } from './supabaseClient';

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

  static async saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task | null> {
    try {
      const newTask = {
        ...task,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_date: task.dueDate?.toISOString() || null,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([newTask])
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    } catch (error) {
      console.error('Error saving task:', error);
      return null;
    }
  }

  static async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
        due_date: updates.dueDate?.toISOString(),
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    } catch (error) {
      console.error('Error updating task:', error);
      return null;
    }
  }

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