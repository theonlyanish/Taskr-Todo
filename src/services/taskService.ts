import { Task, TaskStatus } from '../types/Task';

const STORAGE_KEY = 'tasks';

export class TaskService {
  static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  static getTasks(): Task[] {
    const tasks = localStorage.getItem(STORAGE_KEY);
    return tasks ? JSON.parse(tasks) : [];
  }

  static saveTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
    const newTask: Task = {
      id: this.generateId(),
      createdAt: new Date(),
      ...task
    };

    const tasks = this.getTasks();
    tasks.push(newTask);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return newTask;
  }

  static updateTask(taskId: string, updates: Partial<Task>): Task | null {
    const tasks = this.getTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;

    const updatedTask = { ...tasks[taskIndex], ...updates };
    tasks[taskIndex] = updatedTask;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return updatedTask;
  }

  static deleteTask(taskId: string): boolean {
    const tasks = this.getTasks();
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTasks));
    return filteredTasks.length < tasks.length;
  }
}
