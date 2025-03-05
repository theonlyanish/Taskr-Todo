import { Task, TaskStatus } from '../types/Task';
import { SupabaseTaskService } from './supabaseTaskService';
import { AuthService } from './authService';
import { offlineStorage } from '../utils/offlineStorage';

const STORAGE_KEY = 'tasks';
const LAST_SYNC_KEY = 'lastSync';
const SYNC_STATUS_KEY = 'syncStatus';

export type SyncStatus = 'synced' | 'syncing' | 'unsynced' | 'error';

export class TaskService {
  static generateId(): string {
    return crypto.randomUUID();
  }

  static setSyncStatus(status: SyncStatus) {
    localStorage.setItem(SYNC_STATUS_KEY, status);
  }

  static getSyncStatus(): SyncStatus {
    return (localStorage.getItem(SYNC_STATUS_KEY) as SyncStatus) || 'synced';
  }

  // Get tasks based on authentication status
  static async getTasks(): Promise<Task[]> {
    try {
      const user = await AuthService.getCurrentUser();
      
      if (user) {
        // Get tasks from Supabase if user is logged in
        return await SupabaseTaskService.getTasks();
      } else {
        // Get tasks from localStorage if user is not logged in
        const tasks = localStorage.getItem(STORAGE_KEY);
        return tasks ? JSON.parse(tasks) : [];
      }
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  // Save task based on authentication status
  static async saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task | null> {
    try {
      const user = await AuthService.getCurrentUser();
      const taskId = this.generateId();
      const newTask: Task = {
        ...task,
        id: taskId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (user) {
        // Save to Supabase if user is logged in
        this.setSyncStatus('syncing');
        const taskWithId = {
          ...task,
          id: taskId
        };
        const savedTask = await SupabaseTaskService.saveTask(taskWithId);
        this.setSyncStatus('synced');
        return savedTask || newTask; // Fall back to newTask if Supabase fails
      } else {
        // Save to localStorage if user is not logged in
        const tasks = await this.getTasks();
        tasks.unshift(newTask);
        this.saveTasks(tasks);
        return newTask;
      }
    } catch (error) {
      console.error('Error saving task:', error);
      this.setSyncStatus('error');
      return null;
    }
  }

  // Update task based on authentication status
  static async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    try {
      const user = await AuthService.getCurrentUser();

      if (user) {
        // Update in Supabase if user is logged in
        this.setSyncStatus('syncing');
        const updatedTask = await SupabaseTaskService.updateTask(taskId, updates);
        this.setSyncStatus('synced');
        return updatedTask;
      } else {
        // Update in localStorage if user is not logged in
        const tasks = await this.getTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) return null;

        const updatedTask = { 
          ...tasks[taskIndex], 
          ...updates,
          updatedAt: new Date()
        };
        tasks[taskIndex] = updatedTask;
        this.saveTasks(tasks);
        return updatedTask;
      }
    } catch (error) {
      console.error('Error updating task:', error);
      this.setSyncStatus('error');
      return null;
    }
  }

  // Delete task based on authentication status
  static async deleteTask(taskId: string): Promise<boolean> {
    try {
      const user = await AuthService.getCurrentUser();

      if (user) {
        // Delete from Supabase if user is logged in
        this.setSyncStatus('syncing');
        const success = await SupabaseTaskService.deleteTask(taskId);
        this.setSyncStatus('synced');
        return success;
      } else {
        // Delete from localStorage if user is not logged in
        const tasks = await this.getTasks();
        const filteredTasks = tasks.filter(t => t.id !== taskId);
        this.saveTasks(filteredTasks);
        return filteredTasks.length < tasks.length;
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      this.setSyncStatus('error');
      return false;
    }
  }

  // Save tasks to localStorage
  private static saveTasks(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error saving tasks to localStorage:', error);
      throw new Error('Failed to save tasks');
    }
  }

  // Sync local tasks with cloud when user logs in
  static async syncTasksWithCloud(): Promise<void> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return;

      this.setSyncStatus('syncing');

      // Get local tasks from IndexedDB instead of localStorage
      const localTasks = await offlineStorage.getTasks();

      if (localTasks.length > 0) {
        // Upload local tasks to Supabase
        for (const task of localTasks) {
          await SupabaseTaskService.saveTask(task);
        }

        // Clear IndexedDB after successful sync
        await offlineStorage.saveTasks([]);
      }

      this.setSyncStatus('synced');
    } catch (error) {
      console.error('Error syncing tasks:', error);
      this.setSyncStatus('error');
    }
  }

  // Force sync with cloud
  static async forceSyncWithCloud(): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) return;

    try {
      this.setSyncStatus('syncing');
      const cloudTasks = await SupabaseTaskService.getTasks();
      this.setSyncStatus('synced');
      return;
    } catch (error) {
      console.error('Error force syncing tasks:', error);
      this.setSyncStatus('error');
    }
  }
}
