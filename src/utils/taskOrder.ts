import type { Task } from '../types/Task';

// The order of tasks within a section or column. A task the user has dragged
// has a position; every other task is placed by when it was created. Both are
// on the same scale (milliseconds), so a moved task can sit between two that
// were never moved, and existing lists keep their order without any changes.

export const orderKey = (task: Task) => task.position ?? new Date(task.createdAt).getTime();

export const sortByOrder = (tasks: Task[]) => [...tasks].sort((a, b) => orderKey(a) - orderKey(b));

// Room between neighbours when there's nothing on one side: a second
const STEP = 1000;

// A position between two neighbours (either may be missing), or null when
// they're too close together for a number to fit in between
export const positionBetween = (before?: Task, after?: Task): number | null => {
  if (!before && !after) return null;
  if (!before) return orderKey(after!) - STEP;
  if (!after) return orderKey(before) + STEP;
  const low = orderKey(before);
  const high = orderKey(after);
  const middle = (low + high) / 2;
  return middle > low && middle < high ? middle : null;
};

export interface TaskPosition {
  id: string;
  position: number;
}

// Where a task goes when placed at index in an ordered list (the list
// without that task). Usually only the moved task changes; if its new
// neighbours have no room left between them, the whole list is spaced out
// again, and those other tasks are returned too.
export const placeAt = (
  ordered: Task[],
  index: number,
  task: Task
): { position: number; others: TaskPosition[] } => {
  const before = ordered[index - 1];
  const after = ordered[index];
  const position = positionBetween(before, after);
  if (position !== null) return { position, others: [] };

  // Only one task, or no room: number the list again, a second apart
  const withTask = [...ordered.slice(0, index), task, ...ordered.slice(index)];
  const start = orderKey(withTask[0]);
  const spaced = withTask.map((item, i) => ({ id: item.id, position: start + i * STEP }));
  return {
    position: spaced[index].position,
    others: spaced.filter(item => item.id !== task.id && item.position !== orderKey(withTask.find(t => t.id === item.id)!))
  };
};

// Moving one place up or down: the position that puts the task past its neighbour
export const stepPosition = (ordered: Task[], taskId: string, step: -1 | 1) => {
  const index = ordered.findIndex(task => task.id === taskId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  const task = ordered[index];
  const rest = ordered.filter(item => item.id !== taskId);
  return { ...placeAt(rest, target, task), index: target };
};
