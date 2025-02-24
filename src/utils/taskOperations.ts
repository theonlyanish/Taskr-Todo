import { Task } from '../types';
import { offlineStorage } from './offlineStorage';

// You'll need to implement these backend functions according to your API
const fetchTasksFromBackend = async (): Promise<Task[]> => {
  // Implement your API call here
  throw new Error('Not implemented');
};

const saveTaskToBackend = async (task: Task): Promise<void> => {
  // Implement your API call here
  throw new Error('Not implemented');
};

const deleteTaskFromBackend = async (taskId: string): Promise<void> => {
  // Implement your API call here
  throw new Error('Not implemented');
};

export const loadTasks = async (): Promise<Task[]> => {
  try {
    // Try to fetch from backend first
    const tasks = await fetchTasksFromBackend();
    await offlineStorage.saveTasks(tasks);
    return tasks;
  } catch (error) {
    // If offline or error, load from local storage
    const tasks = await offlineStorage.getTasks();
    return tasks;
  }
};

export const addTask = async (task: Task, currentTasks: Task[]): Promise<Task[]> => {
  try {
    // Try to save to backend first
    await saveTaskToBackend(task);
    const updatedTasks = [...currentTasks, task];
    await offlineStorage.saveTasks(updatedTasks);
    return updatedTasks;
  } catch (error) {
    // If offline, save locally and add to pending changes
    const updatedTasks = [...currentTasks, task];
    await offlineStorage.saveTasks(updatedTasks);
    await offlineStorage.addPendingChange({
      type: 'add',
      task,
      timestamp: Date.now()
    });
    return updatedTasks;
  }
};

export const updateTask = async (task: Task, currentTasks: Task[]): Promise<Task[]> => {
  try {
    // Try to save to backend first
    await saveTaskToBackend(task);
    const updatedTasks = currentTasks.map(t => t.id === task.id ? task : t);
    await offlineStorage.saveTasks(updatedTasks);
    return updatedTasks;
  } catch (error) {
    // If offline, save locally and add to pending changes
    const updatedTasks = currentTasks.map(t => t.id === task.id ? task : t);
    await offlineStorage.saveTasks(updatedTasks);
    await offlineStorage.addPendingChange({
      type: 'update',
      task,
      timestamp: Date.now()
    });
    return updatedTasks;
  }
};

export const deleteTask = async (taskId: string, currentTasks: Task[]): Promise<Task[]> => {
  try {
    // Try to delete from backend first
    await deleteTaskFromBackend(taskId);
    const updatedTasks = currentTasks.filter(t => t.id !== taskId);
    await offlineStorage.saveTasks(updatedTasks);
    return updatedTasks;
  } catch (error) {
    // If offline, save locally and add to pending changes
    const task = currentTasks.find(t => t.id === taskId);
    if (task) {
      const updatedTasks = currentTasks.filter(t => t.id !== taskId);
      await offlineStorage.saveTasks(updatedTasks);
      await offlineStorage.addPendingChange({
        type: 'delete',
        task,
        timestamp: Date.now()
      });
      return updatedTasks;
    }
    return currentTasks;
  }
}; 