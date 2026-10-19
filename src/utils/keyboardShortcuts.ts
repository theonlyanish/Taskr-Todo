import { useEffect, useRef } from 'react';

// Single-key shortcuts for getting around without a mouse. They aren't shown
// anywhere in the app: pressing ? opens the list (see ShortcutsDialog).
//
//   j / k   next / previous task
//   x       complete or untick the focused task
//   e       edit the focused task
//   n       new task
//   /       search and commands (like Ctrl+K)
//   ?       the list of shortcuts
//
// (1, 2 and 3 switch views; ViewSwitcher handles those.)

interface ShortcutHandlers {
  onToggle: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onNewTask: () => void;
  onSearch: () => void;
  onHelp: () => void;
}

// Keys typed into a field are text, not shortcuts
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// The element each task is focused by: a list row's main button, or a board card
const TASK_TARGETS = '.task-item > .task-content, .kanban-task-card';

const visibleTaskTargets = () =>
  Array.from(document.querySelectorAll<HTMLElement>(TASK_TARGETS)).filter(
    element => element.getClientRects().length > 0 && !element.closest('[hidden]')
  );

// The task the keyboard is on, if any
export const focusedTaskId = () =>
  (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;

// Puts focus back on a task, for after it moves to another section or column.
// With a status, only once the task shows it (until React re-renders, the old
// row is still there and is about to go). Returns whether it focused.
export const focusTaskById = (taskId: string, status?: string) => {
  const target = visibleTaskTargets().find(element => {
    const task = element.closest<HTMLElement>('[data-task-id]');
    return task?.dataset.taskId === taskId && (!status || task.dataset.status === status);
  });
  if (!target) return false;
  target.focus();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
};

// Next or previous task in the order they're shown; from nowhere, the first
export const moveTaskFocus = (step: 1 | -1) => {
  const targets = visibleTaskTargets();
  if (targets.length === 0) return;
  const current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-id]');
  const index = targets.findIndex(target => target === document.activeElement || target.closest('[data-task-id]') === current);
  const next = index < 0 ? targets[0] : targets[Math.min(targets.length - 1, Math.max(0, index + step))];
  next.focus();
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

// Tries something every 30ms until it works, for up to about half a second:
// for focusing an element that only appears once React has re-rendered
export const retryUntil = (attempt: () => boolean, triesLeft = 15) => {
  if (attempt() || triesLeft <= 0) return;
  window.setTimeout(() => retryUntil(attempt, triesLeft - 1), 30);
};

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      // Dialogs (the palette, sign-in, templates…) keep their own keys
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      const { onToggle, onEdit, onNewTask, onSearch, onHelp } = handlersRef.current;
      const taskId = focusedTaskId();
      switch (event.key) {
        case 'j':
          moveTaskFocus(1);
          break;
        case 'k':
          moveTaskFocus(-1);
          break;
        case 'x':
          if (!taskId) return;
          onToggle(taskId);
          break;
        case 'e':
          if (!taskId) return;
          onEdit(taskId);
          break;
        case 'n':
          onNewTask();
          break;
        case '/':
          onSearch();
          break;
        case '?':
          onHelp();
          break;
        default:
          return;
      }
      // Handled: don't also type the key into whatever takes focus next
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
