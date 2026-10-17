export type TaskStatus = 'To Do' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Where the user dragged it within its section; tasks never moved go by
  // creation time (see utils/taskOrder)
  position?: number;
  parentId?: string;
  isSubtask?: boolean;
  subtasks?: Task[];
}
