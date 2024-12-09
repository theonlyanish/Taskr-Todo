import { Task, TaskStatus } from '../types/Task';

const STORAGE_KEY = 'tasks';
const LAST_SYNC_KEY = 'lastSync';

export class TaskService {
  static generateId(): string {
    return crypto.randomUUID(); // Using crypto.randomUUID() to generate a unique identifier
  }

  // Static method to retrieve tasks from localStorage
  static getTasks(): Task[] {
    try {
      const tasks = localStorage.getItem(STORAGE_KEY);
      return tasks ? JSON.parse(tasks) : [];
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  // Static method to save a new task to localStorage
  static saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    try {
      const newTask: Task = {
        ...task,
        id: this.generateId(), // Generating a unique identifier for the task
        createdAt: new Date(), // Setting the creation date to the current date and time
        updatedAt: new Date(), // Setting the update date to the current date and time
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

  // Static method to update an existing task in localStorage
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

  // Static method to delete a task from localStorage
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

  // Static method to save tasks to localStorage
  static saveTasks(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error saving tasks to localStorage:', error);
      throw new Error('Failed to save tasks');
    }
  }

  // Static method to synchronize tasks from a remote source
  static syncTasks(remoteTasks: Task[]): void {
    this.saveTasks(remoteTasks);
  }
}
