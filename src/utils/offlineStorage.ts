import { Task } from '../types/Task';
import type { TaskTemplate } from './templates';

const DB_NAME = 'TaskrDB';
// Version 2 added the account cache and outbox stores
const DB_VERSION = 2;

const TASKS_STORE = 'tasks'; // guest tasks
const PENDING_CHANGES_STORE = 'pendingChanges'; // guest change log (not synced anywhere)
const ACCOUNT_TASKS_STORE = 'accountTasks'; // last known tasks of each signed-in user
const OUTBOX_STORE = 'outbox'; // signed-in changes waiting to reach Supabase

interface PendingChange {
  type: 'add' | 'update' | 'delete';
  task: Task;
  timestamp: number;
}

// A signed-in change that couldn't be sent (offline, or Supabase asleep)
export type OutboxChange =
  | { type: 'add'; task: Task }
  | { type: 'update'; task: Task }
  | { type: 'delete'; taskId: string }
  | { type: 'template-add'; template: TaskTemplate }
  | { type: 'template-delete'; templateId: string };

export interface OutboxEntry {
  seq?: number; // assigned by IndexedDB, keeps changes in the order they were made
  userId: string;
  queuedAt: number;
  change: OutboxChange;
}

// Resolves once a readwrite transaction has actually been written
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export class OfflineStorage {
  private opening: Promise<IDBDatabase> | null = null;

  init(): Promise<IDBDatabase> {
    this.opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        // Let a newer version of the app (in another tab) upgrade the database
        db.onversionchange = () => db.close();
        resolve(db);
      };
      // Another tab still has the old version open; the upgrade waits for it
      request.onblocked = () => console.warn('Close other Taskr tabs to finish updating local storage.');

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TASKS_STORE)) {
          db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PENDING_CHANGES_STORE)) {
          db.createObjectStore(PENDING_CHANGES_STORE, { keyPath: 'timestamp' });
        }
        if (!db.objectStoreNames.contains(ACCOUNT_TASKS_STORE)) {
          db.createObjectStore(ACCOUNT_TASKS_STORE, { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: 'seq', autoIncrement: true });
        }
      };
    });
    return this.opening;
  }

  // Waits for the database, so callers made before init() finishes still work
  private database(): Promise<IDBDatabase> {
    return this.init();
  }

  /* ---------- Guest tasks ---------- */

  async saveTasks(tasks: Task[]): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);
    store.clear();
    for (const task of tasks) {
      store.put(task);
    }
    await done(tx);
  }

  async getTasks(): Promise<Task[]> {
    const db = await this.database();
    return result(db.transaction(TASKS_STORE, 'readonly').objectStore(TASKS_STORE).getAll());
  }

  async addPendingChange(change: PendingChange): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(PENDING_CHANGES_STORE, 'readwrite');
    tx.objectStore(PENDING_CHANGES_STORE).put(change);
    await done(tx);
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    const db = await this.database();
    return result(db.transaction(PENDING_CHANGES_STORE, 'readonly').objectStore(PENDING_CHANGES_STORE).getAll());
  }

  async clearPendingChanges(): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(PENDING_CHANGES_STORE, 'readwrite');
    tx.objectStore(PENDING_CHANGES_STORE).clear();
    await done(tx);
  }

  /* ---------- Signed-in users: task cache ---------- */

  // The account's tasks as last seen, so they show (and can be edited) offline
  async saveAccountTasks(userId: string, tasks: Task[]): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(ACCOUNT_TASKS_STORE, 'readwrite');
    tx.objectStore(ACCOUNT_TASKS_STORE).put({ userId, tasks, savedAt: Date.now() });
    await done(tx);
  }

  async getAccountTasks(userId: string): Promise<Task[] | null> {
    const db = await this.database();
    const record = await result<{ tasks: Task[] } | undefined>(
      db.transaction(ACCOUNT_TASKS_STORE, 'readonly').objectStore(ACCOUNT_TASKS_STORE).get(userId)
    );
    return record?.tasks ?? null;
  }

  // Which accounts have a copy of their tasks on this device
  async getAccountIds(): Promise<string[]> {
    const db = await this.database();
    const keys = await result<IDBValidKey[]>(
      db.transaction(ACCOUNT_TASKS_STORE, 'readonly').objectStore(ACCOUNT_TASKS_STORE).getAllKeys()
    );
    return keys.map(String);
  }

  async clearAccountTasks(userId: string): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(ACCOUNT_TASKS_STORE, 'readwrite');
    tx.objectStore(ACCOUNT_TASKS_STORE).delete(userId);
    await done(tx);
  }

  /* ---------- Signed-in users: outbox ---------- */

  async addToOutbox(entry: OutboxEntry): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).add(entry);
    await done(tx);
  }

  // Oldest first, for one user
  async getOutbox(userId: string): Promise<OutboxEntry[]> {
    const db = await this.database();
    const entries = await result<OutboxEntry[]>(db.transaction(OUTBOX_STORE, 'readonly').objectStore(OUTBOX_STORE).getAll());
    return entries.filter(entry => entry.userId === userId).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  }

  async removeFromOutbox(seq: number): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).delete(seq);
    await done(tx);
  }
}

export const offlineStorage = new OfflineStorage();
