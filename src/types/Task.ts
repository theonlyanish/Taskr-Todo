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
  // Which of the user's lists it's in (utils/taskLists); none means Personal.
  // Only top-level tasks have one: subtasks go wherever their parent is.
  listId?: string | null;
  // How it repeats ("week:1"; see utils/repeat), always with a due date.
  // Completing it adds the next one. Top-level tasks only.
  repeat?: string | null;
  isSubtask?: boolean;
  subtasks?: Task[];
}
