import { useCallback, useEffect, useRef, useState } from 'react';
import { Task } from '../types/Task';
import { daysUntil } from './dueDate';

// Due-date reminders: a browser notification on the morning a task is due.
// They're opt-in and kept on this device, and only shown while Taskr is open
// in a tab (reminders with the app closed would need push from a server).
//
// At 9am, or the first time Taskr is open after that, one notification lists
// the tasks due today that aren't done. Each task is announced once a day.
// A task given today's date after 9am isn't announced: you've just seen it.

export const REMINDER_HOUR = 9;

const ENABLED_KEY = 'reminders';
const OFFERED_KEY = 'remindersOffered';
const SENT_KEY = 'remindersSent';

// Storage can be unavailable (private windows, blocked site data)
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not saved; applies for this visit only
  }
};

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

const permission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

// "2026-10-24" for the local day
export const dayKey = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const reminderTime = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), REMINDER_HOUR);

// Every task and subtask once (subtasks also sit inside their parent)
const allTasks = (tasks: Task[]) =>
  tasks.filter(task => !task.isSubtask).flatMap(task => [task, ...(task.subtasks ?? [])]);

// Tasks to announce now: due today, not done, already due today as of the
// reminder time, and not announced today. `sent` maps task id to the day it
// was announced.
export const remindersDue = (tasks: Task[], now: Date, sent: Record<string, string>): Task[] => {
  const cutoff = reminderTime(now);
  if (now < cutoff) return [];
  const today = dayKey(now);
  return allTasks(tasks).filter(
    task =>
      task.dueDate &&
      task.status !== 'Completed' &&
      daysUntil(new Date(task.dueDate), now) === 0 &&
      new Date(task.updatedAt) < cutoff &&
      sent[task.id] !== today
  );
};

// What the notification says
export const reminderText = (due: Task[]) => {
  if (due.length === 1) return { title: 'Due today', body: due[0].title };
  const shown = due.slice(0, 4).map(task => `• ${task.title}`);
  if (due.length > 4) shown.push(`and ${due.length - 4} more`);
  return { title: `${due.length} tasks due today`, body: shown.join('\n') };
};

const readSent = (): Record<string, string> => {
  try {
    const parsed = JSON.parse(read(SENT_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

// Record today's announcements, dropping earlier days so the list stays small
const markSent = (taskIds: string[], now: Date) => {
  const today = dayKey(now);
  const kept = Object.fromEntries(Object.entries(readSent()).filter(([, day]) => day === today));
  taskIds.forEach(id => {
    kept[id] = today;
  });
  write(SENT_KEY, JSON.stringify(kept));
};

const ICON = '/favicon_io/android-chrome-192x192.png';

// Desktop browsers show a notification directly. Android Chrome only allows
// them through the service worker, whose click handler reopens Taskr.
const show = async (due: Task[], now: Date, onOpen: (task: Task | null) => void) => {
  const { title, body } = reminderText(due);
  const options: NotificationOptions = {
    body,
    icon: ICON,
    // One per day, so two open tabs replace each other's rather than doubling up
    tag: `taskr-due-${dayKey(now)}`,
    data: { taskId: due.length === 1 ? due[0].id : null }
  };
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
      onOpen(due.length === 1 ? due[0] : null);
    };
  } catch {
    const registration = await navigator.serviceWorker?.ready;
    await registration?.showNotification(title, options);
  }
};

export type ReminderStatus = 'unsupported' | 'off' | 'on' | 'blocked';

const currentStatus = (): ReminderStatus => {
  const allowed = permission();
  if (allowed === 'unsupported') return 'unsupported';
  if (allowed === 'denied') return 'blocked';
  return read(ENABLED_KEY) === 'on' && allowed === 'granted' ? 'on' : 'off';
};

// Reminder settings for the app, and the check that shows them. onOpen is
// called with the task when a one-task reminder is clicked (null for several).
export const useDueReminders = (tasks: Task[], onOpen: (task: Task | null) => void) => {
  const [status, setStatus] = useState<ReminderStatus>(currentStatus);
  const [offered, setOffered] = useState(() => read(OFFERED_KEY) === '1');

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const check = useCallback(() => {
    if (currentStatus() !== 'on') return;
    const now = new Date();
    const due = remindersDue(tasksRef.current, now, readSent());
    if (!due.length) return;
    // Marked first, so another open tab doesn't announce them too
    markSent(due.map(task => task.id), now);
    show(due, now, task => onOpenRef.current(task)).catch(error =>
      console.error('Could not show the reminder:', error)
    );
  }, []);

  // Checked each minute against the clock (a timer set for 9am would run late
  // after the computer sleeps), and on coming back to the tab. The first check
  // waits a few seconds so a signed-in account's tasks have arrived.
  useEffect(() => {
    if (status !== 'on') return;
    const first = window.setTimeout(check, 5000);
    const interval = window.setInterval(check, 60_000);
    const handleVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [status, check]);

  // A reminder shown through the service worker was clicked (see
  // public/service-worker.js)
  useEffect(() => {
    const worker = navigator.serviceWorker;
    if (!worker) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'taskr-open-task') return;
      const task = allTasks(tasksRef.current).find(t => t.id === event.data.taskId) ?? null;
      onOpenRef.current(task);
    };
    worker.addEventListener('message', handleMessage);
    return () => worker.removeEventListener('message', handleMessage);
  }, []);

  // Asks the browser for permission; must run from a click
  const enable = async () => {
    write(OFFERED_KEY, '1');
    setOffered(true);
    if (!notificationsSupported()) return 'unsupported' as const;
    const answer = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (answer === 'granted') {
      write(ENABLED_KEY, 'on');
      setStatus('on');
      // Anything already due today is announced straight away
      window.setTimeout(check, 0);
      return 'on' as const;
    }
    setStatus(currentStatus());
    return answer === 'denied' ? ('blocked' as const) : ('off' as const);
  };

  const disable = () => {
    write(ENABLED_KEY, 'off');
    setStatus(currentStatus());
  };

  // "Not now" on the offer: don't offer again (Ctrl+K still turns them on)
  const dismissOffer = () => {
    write(OFFERED_KEY, '1');
    setOffered(true);
  };

  // Worth offering once, the first time the user gives a task a due date
  const canOffer = status === 'off' && !offered;

  return { status, enable, disable, canOffer, dismissOffer };
};
