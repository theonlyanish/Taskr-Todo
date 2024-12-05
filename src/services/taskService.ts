import { Task } from '../types/Task';

const STORAGE_KEY = 'tasks';

// Export the taskService object with methods for managing tasks
export const taskService = {
  // Method to retrieve tasks from local storage
  getTasks: (): Task[] => {
    const tasks = localStorage.getItem(STORAGE_KEY);
    return tasks ? JSON.parse(tasks) : [];
  },

  // Method to save tasks to local storage
  saveTasks: (tasks: Task[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  },

  // Method to add a new task to the tasks array
  addTask: (tasks: Task[], newTask: Task): Task[] => {
    const updatedTasks = [...tasks, newTask];
    taskService.saveTasks(updatedTasks);
    return updatedTasks;
  },

  // Method to update an existing task in the tasks array
  updateTask: (tasks: Task[], updatedTask: Task): Task[] => {
    const updatedTasks = tasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    );
    taskService.saveTasks(updatedTasks);
    return updatedTasks;
  },

  // Method to delete a task from the tasks array
  deleteTask: (tasks: Task[], taskId: string): Task[] => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    taskService.saveTasks(updatedTasks);
    return updatedTasks;
  }
};
