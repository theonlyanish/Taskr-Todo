import { useSyncExternalStore } from 'react';

// Which tasks have their subtasks showing. Subtasks start hidden behind a
// progress chip ("1/3 subtasks"); opening a task is remembered on this device
// and applies in both the list and the board.

const STORAGE_KEY = 'expandedSubtasks';
// Enough for any real list; the oldest are forgotten first
const MAX_REMEMBERED = 300;

const load = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

let expanded = new Set<string>(load());
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setSubtasksExpanded = (taskId: string, open: boolean) => {
  if (expanded.has(taskId) === open) return;
  const next = new Set(expanded);
  if (open) next.add(taskId);
  else next.delete(taskId);
  expanded = new Set(Array.from(next).slice(-MAX_REMEMBERED));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expanded)));
  } catch {
    // Not remembered after a reload, but still works now
  }
  listeners.forEach(listener => listener());
};

export const useSubtasksExpanded = (taskId: string) =>
  useSyncExternalStore(subscribe, () => expanded.has(taskId));
