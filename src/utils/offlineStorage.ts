import { Task } from '../types/Task';

const TASKS_STORE = 'tasks';
const PENDING_CHANGES_STORE = 'pendingChanges';

interface PendingChange {
  type: 'add' | 'update' | 'delete';
  task: Task;
  timestamp: number;
}

export class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TaskrDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create tasks store
        if (!db.objectStoreNames.contains(TASKS_STORE)) {
          db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        }
        
        // Create pending changes store
        if (!db.objectStoreNames.contains(PENDING_CHANGES_STORE)) {
          db.createObjectStore(PENDING_CHANGES_STORE, { keyPath: 'timestamp' });
        }
      };
    });
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);

    // Clear existing tasks
    await store.clear();

    // Save new tasks
    for (const task of tasks) {
      await store.put(task);
    }
  }

  async getTasks(): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(TASKS_STORE, 'readonly');
      const store = tx.objectStore(TASKS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async addPendingChange(change: PendingChange): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(PENDING_CHANGES_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_CHANGES_STORE);
    await store.put(change);
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(PENDING_CHANGES_STORE, 'readonly');
      const store = tx.objectStore(PENDING_CHANGES_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async clearPendingChanges(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(PENDING_CHANGES_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_CHANGES_STORE);
    await store.clear();
  }
}

export const offlineStorage = new OfflineStorage(); 