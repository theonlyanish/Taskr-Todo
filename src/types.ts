export type TaskStatus = 'To Do' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NetworkStatus {
  isOnline: boolean;
  isSyncing: boolean;
  hasError: boolean;
  lastSyncTime?: string;
}

