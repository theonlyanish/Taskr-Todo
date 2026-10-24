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
  // When it last moved to In Progress, and when it was completed, for the
  // stats (see utils/statusTimes). null means cleared, e.g. reopened.
  startedAt?: Date | null;
  completedAt?: Date | null;
  parentId?: string;
  isSubtask?: boolean;
  subtasks?: Task[];
}
