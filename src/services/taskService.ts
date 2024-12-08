import { Task, TaskStatus } from '../types/Task';

const STORAGE_KEY = 'tasks';
const LAST_SYNC_KEY = 'lastSync';

export class TaskService {
  static generateId(): string {
    return crypto.randomUUID();
  }

  static getTasks(): Task[] {
    try {
      const tasks = localStorage.getItem(STORAGE_KEY);
      return tasks ? JSON.parse(tasks) : [];
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  static saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    try {
      const newTask: Task = {
        ...task,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tasks = this.getTasks();
      tasks.unshift(newTask); // Add new task at the beginning
      this.saveTasks(tasks);
      return newTask;
    } catch (error) {
      console.error('Error saving task:', error);
      throw new Error('Failed to save task');
    }
  }

  static updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task | null {
    try {
      const tasks = this.getTasks();
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
    } catch (error) {
      console.error('Error updating task:', error);
      return null;
    }
  }

  static deleteTask(taskId: string): boolean {
    try {
      const tasks = this.getTasks();
      const filteredTasks = tasks.filter(t => t.id !== taskId);
      this.saveTasks(filteredTasks);
      return filteredTasks.length < tasks.length;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }

  private static saveTasks(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error saving tasks to localStorage:', error);
      throw new Error('Failed to save tasks');
    }
  }
}
