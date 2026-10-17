import { useSyncExternalStore } from 'react';

// Due dates are stored as midnight UTC for the chosen calendar day (see
// CalendarView), so the day is read from the UTC parts. Reading it in local
// time would show the day before anywhere west of UTC.
const dueDay = (dueDate: Date) =>
  Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());

const localDay = (now: Date) => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

// Whole days from today until the due date: 0 is today, -1 yesterday
export const daysUntil = (dueDate: Date, now = new Date()) =>
  Math.round((dueDay(dueDate) - localDay(now)) / 86_400_000);

export type DueTone = 'overdue' | 'today' | 'upcoming';

export interface DueDateLabel {
  text: string; // short, for the card: "Tomorrow", "Friday", "3 days ago"
  full: string; // the exact date, for a tooltip and screen readers
  tone: DueTone;
}

const fullDate = (dueDate: Date) =>
  dueDate.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

// "Today", "Tomorrow", a weekday for the coming week, then a short date;
// past dates count back. Done tasks are never shown as overdue.
export const describeDue = (dueDate: Date, completed = false, now = new Date()): DueDateLabel => {
  const days = daysUntil(dueDate, now);
  const full = fullDate(dueDate);
  const tone: DueTone = completed || days > 0 ? 'upcoming' : days === 0 ? 'today' : 'overdue';

  let text: string;
  if (days === 0) text = 'Today';
  else if (days === 1) text = 'Tomorrow';
  else if (days === -1) text = 'Yesterday';
  else if (days > 1 && days < 7) {
    text = dueDate.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });
  } else if (days < -1 && days > -7) {
    text = `${-days} days ago`;
  } else {
    text = dueDate.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: dueDate.getUTCFullYear() === now.getFullYear() ? undefined : 'numeric',
      timeZone: 'UTC'
    });
  }
  return { text, full, tone };
};

// Today's date, updated at midnight, so "Tomorrow" becomes "Today" on a page
// left open overnight. One timer is shared by every label on the page.
let today = localDay(new Date());
const listeners = new Set<() => void>();
let midnightTimer: number | undefined;

const scheduleMidnight = () => {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  // A second past midnight, so the new day has certainly begun
  midnightTimer = window.setTimeout(() => {
    today = localDay(new Date());
    listeners.forEach(listener => listener());
    scheduleMidnight();
  }, nextMidnight.getTime() - now.getTime() + 1000);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) scheduleMidnight();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearTimeout(midnightTimer);
  };
};

// Re-renders the caller when the day changes; returns today's date as a number
export const useToday = () => useSyncExternalStore(subscribe, () => today);
