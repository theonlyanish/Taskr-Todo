import { Task } from '../types/Task';

// Numbers for the stats dialog, worked out from the task list on this device.
// Tasks count, not subtasks: completing a task with three subtasks is one task
// done. Deleted tasks drop out of the numbers.

export const WEEKS_SHOWN = 8;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// When a task was completed. Tasks completed before completion times were
// recorded use their last edit, which is usually the completion. A task that
// was never edited after it was created (an import of finished tasks) has no
// useful time and isn't counted.
export const completedTime = (task: Task): { at: Date; approximate: boolean } | null => {
  if (task.status !== 'Completed') return null;
  if (task.completedAt) return { at: new Date(task.completedAt), approximate: false };
  const updated = new Date(task.updatedAt);
  return updated.getTime() - new Date(task.createdAt).getTime() > 60_000 ? { at: updated, approximate: true } : null;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Weeks start on Monday
export const startOfWeek = (date: Date) => {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
};

const dayKey = (date: Date) => startOfDay(date).getTime();

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export interface WeekCount {
  start: Date;
  count: number;
}

export interface TaskStats {
  doneThisWeek: number;
  doneLastWeek: number;
  doneAllTime: number;
  // Oldest first, ending with this week
  weeks: WeekCount[];
  // Days in a row with something done, up to today (or yesterday, so a streak
  // isn't lost before today's first task is done)
  currentStreak: number;
  bestStreak: number;
  // Middle time from In Progress to Completed, and how many tasks it covers
  medianInProgressMs: number | null;
  inProgressMeasured: number;
  // In progress now, longest first, with how long; tasks with no start time
  // (moved there before times were recorded) are left out
  inProgressNow: { task: Task; forMs: number }[];
  inProgressCount: number;
  // Some completion times are estimated from the last edit
  approximate: boolean;
}

export const computeStats = (tasks: Task[], now: Date): TaskStats => {
  const topLevel = tasks.filter(task => !task.isSubtask);
  const completions = topLevel.map(completedTime).filter((time): time is NonNullable<typeof time> => !!time);

  const thisWeek = startOfWeek(now);
  const weeks: WeekCount[] = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * (WEEKS_SHOWN - 1 - index));
    return { start, count: 0 };
  });
  completions.forEach(({ at }) => {
    const weekStart = startOfWeek(at).getTime();
    const week = weeks.find(entry => entry.start.getTime() === weekStart);
    if (week) week.count++;
  });

  // Streaks, from the days with at least one task done
  const days = new Set(completions.map(({ at }) => dayKey(at)));
  const previousDay = (key: number) => {
    const date = new Date(key);
    date.setDate(date.getDate() - 1);
    return date.getTime();
  };
  let streakDay = days.has(dayKey(now)) ? dayKey(now) : previousDay(dayKey(now));
  let currentStreak = 0;
  while (days.has(streakDay)) {
    currentStreak++;
    streakDay = previousDay(streakDay);
  }
  let bestStreak = 0;
  days.forEach(day => {
    if (days.has(previousDay(day))) return; // not the start of a run
    let length = 0;
    for (let key = day; days.has(key); ) {
      length++;
      const next = new Date(key);
      next.setDate(next.getDate() + 1);
      key = next.getTime();
    }
    bestStreak = Math.max(bestStreak, length);
  });

  const inProgressDurations = topLevel
    .filter(task => task.status === 'Completed' && task.startedAt && task.completedAt)
    .map(task => new Date(task.completedAt!).getTime() - new Date(task.startedAt!).getTime())
    .filter(ms => ms >= 0);

  const inProgress = topLevel.filter(task => task.status === 'In Progress');
  const inProgressNow = inProgress
    .filter(task => task.startedAt)
    .map(task => ({ task, forMs: now.getTime() - new Date(task.startedAt!).getTime() }))
    .sort((a, b) => b.forMs - a.forMs);

  return {
    doneThisWeek: weeks[weeks.length - 1].count,
    doneLastWeek: weeks[weeks.length - 2].count,
    doneAllTime: topLevel.filter(task => task.status === 'Completed').length,
    weeks,
    currentStreak,
    bestStreak,
    medianInProgressMs: median(inProgressDurations),
    inProgressMeasured: inProgressDurations.length,
    inProgressNow,
    inProgressCount: inProgress.length,
    approximate: completions.some(({ approximate }) => approximate)
  };
};

// "under an hour", "5 hours", "1 day", "12 days"
export const formatDuration = (ms: number) => {
  if (ms < HOUR_MS) return 'under an hour';
  if (ms < DAY_MS) {
    const hours = Math.round(ms / HOUR_MS);
    return hours >= 24 ? '1 day' : `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(ms / DAY_MS);
  return `${days} day${days === 1 ? '' : 's'}`;
};
