import { Task } from '../types/Task';

// Lists (projects) that tasks are sorted into: Work, Home, a trip. Everyone
// has Personal, which holds every task not in another list (all tasks made
// before lists existed, and any whose list has gone). It can't be deleted.
// The rest are the user's own, kept on this device for guests and in the
// task_lists table for accounts (services/listService).

export interface TaskList {
  id: string;
  name: string;
  color: string;
  createdAt: string; // ISO date, for their order
}

export const DEFAULT_LIST_ID = 'personal';
export const LIST_NAME_MAX = 40;

// Personal takes the first; new lists take the next one not in use
export const LIST_COLORS = ['#0984e3', '#00a676', '#8e5bd6', '#e0447c', '#e17b1c', '#0fa3b1'];

export const PERSONAL_LIST: TaskList = {
  id: DEFAULT_LIST_ID,
  name: 'Personal',
  color: LIST_COLORS[0],
  createdAt: '1970-01-01T00:00:00.000Z'
};

// Personal first, then the user's lists oldest first
export const withPersonal = (lists: TaskList[]): TaskList[] => [
  PERSONAL_LIST,
  ...[...lists].filter(list => list.id !== DEFAULT_LIST_ID).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
];

export const nextListColor = (lists: TaskList[]) => {
  const used = new Set(withPersonal(lists).map(list => list.color));
  return LIST_COLORS.find(color => !used.has(color)) ?? LIST_COLORS[(lists.length + 1) % LIST_COLORS.length];
};

export const newList = (name: string, lists: TaskList[], now = new Date()): TaskList => ({
  id: crypto.randomUUID(),
  name: name.trim().slice(0, LIST_NAME_MAX),
  color: nextListColor(lists),
  createdAt: now.toISOString()
});

// The list a top-level task is in; one that's unknown (deleted, or not synced
// to this device yet) counts as Personal
export const listOf = (task: Task, knownIds: Set<string>) =>
  task.listId && knownIds.has(task.listId) ? task.listId : DEFAULT_LIST_ID;

// The tasks of one list, with the subtasks of its tasks (subtasks can also
// sit at the top level of the task array)
export const tasksInList = (tasks: Task[], listId: string, lists: TaskList[]): Task[] => {
  const knownIds = new Set(lists.map(list => list.id));
  const inList = new Set(
    tasks.filter(task => !task.isSubtask && listOf(task, knownIds) === listId).map(task => task.id)
  );
  return tasks.filter(task => (task.isSubtask ? !!task.parentId && inList.has(task.parentId) : inList.has(task.id)));
};

// Unfinished tasks in each list, for the list menu
export const openTaskCounts = (tasks: Task[], lists: TaskList[]): Record<string, number> => {
  const knownIds = new Set(lists.map(list => list.id));
  const counts: Record<string, number> = Object.fromEntries(lists.map(list => [list.id, 0]));
  tasks
    .filter(task => !task.isSubtask && task.status !== 'Completed')
    .forEach(task => {
      const id = listOf(task, knownIds);
      counts[id] = (counts[id] ?? 0) + 1;
    });
  return counts;
};

// What a task stores for a list: nothing for Personal
export const storedListId = (listId: string): string | null => (listId === DEFAULT_LIST_ID ? null : listId);

// The same name as another list, ignoring case and spaces
export const nameTaken = (name: string, lists: TaskList[], exceptId?: string) =>
  withPersonal(lists).some(
    list => list.id !== exceptId && list.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

/* ---------- Kept on this device ---------- */

const listsKey = (userId?: string) => (userId ? `lists:${userId}` : 'lists');
const currentKey = (userId?: string) => (userId ? `currentList:${userId}` : 'currentList');

const isList = (value: unknown): value is TaskList => {
  const list = value as TaskList;
  return !!list && typeof list.id === 'string' && typeof list.name === 'string' && typeof list.color === 'string';
};

// Storage can be unavailable (private windows, blocked site data)
export const loadLists = (userId?: string): TaskList[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(listsKey(userId)) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isList).filter(list => list.id !== DEFAULT_LIST_ID) : [];
  } catch {
    return [];
  }
};

export const storeLists = (lists: TaskList[], userId?: string) => {
  try {
    localStorage.setItem(listsKey(userId), JSON.stringify(lists.filter(list => list.id !== DEFAULT_LIST_ID)));
  } catch {
    // Not kept after a reload on this device
  }
};

export const forgetLists = (userId: string) => {
  try {
    localStorage.removeItem(listsKey(userId));
    localStorage.removeItem(currentKey(userId));
  } catch {
    // Storage unavailable: nothing was kept
  }
};

export const loadCurrentListId = (userId?: string) => {
  try {
    return localStorage.getItem(currentKey(userId)) ?? DEFAULT_LIST_ID;
  } catch {
    return DEFAULT_LIST_ID;
  }
};

export const storeCurrentListId = (listId: string, userId?: string) => {
  try {
    localStorage.setItem(currentKey(userId), listId);
  } catch {
    // Opens on Personal next time instead
  }
};
