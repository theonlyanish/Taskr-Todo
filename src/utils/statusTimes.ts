import { Task, TaskStatus } from '../types/Task';

// When a task moves between statuses, record when, for the stats:
// - to In Progress: startedAt is now (a reopened task starts again)
// - to Completed: completedAt is now; startedAt stays, to measure the time
//   spent in progress
// - back to To Do: both are cleared
// null clears a time (undefined would leave the stored one untouched).
export const statusTimes = (from: TaskStatus | undefined, to: TaskStatus, now: Date): Partial<Task> => {
  if (from === to) return {};
  if (to === 'In Progress') return { startedAt: now, completedAt: null };
  if (to === 'Completed') return { completedAt: now };
  return { startedAt: null, completedAt: null };
};

// A new task starting in progress or done (a subtask added under a parent
// that's already there) is stamped as starting there now
export const initialStatusTimes = (status: TaskStatus, now: Date): Partial<Task> =>
  status === 'To Do' ? {} : statusTimes(undefined, status, now);

const flatten = (taskList: Task[]) =>
  taskList.flatMap(task => [task, ...(task.isSubtask ? [] : task.subtasks ?? [])]);

// The task list `after` a change, with times stamped on every task (or
// subtask) whose status differs from `before`, including knock-on changes
// such as subtasks completed with their parent
export const withStatusTimes = (before: Task[], after: Task[], now: Date): Task[] => {
  const previous = new Map(flatten(before).map(task => [task.id, task.status]));
  const stamp = (task: Task): Task => {
    if (!previous.has(task.id)) return task;
    const times = statusTimes(previous.get(task.id), task.status, now);
    return Object.keys(times).length ? { ...task, ...times } : task;
  };
  return after.map(task => {
    const stamped = stamp(task);
    if (!stamped.subtasks?.length) return stamped;
    const subtasks = stamped.subtasks.map(stamp);
    return subtasks.some((subtask, index) => subtask !== stamped.subtasks![index]) ? { ...stamped, subtasks } : stamped;
  });
};
