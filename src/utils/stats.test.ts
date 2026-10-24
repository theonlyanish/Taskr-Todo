import { Task } from '../types/Task';
import { completedTime, computeStats, formatDuration, startOfWeek } from './stats';
import { statusTimes, withStatusTimes } from './statusTimes';

// Saturday 24 October 2026, 3pm local time; the week began Monday 19 October
const NOW = new Date(2026, 9, 24, 15);
const day = (date: number, hour = 12) => new Date(2026, 9, date, hour);

let nextId = 0;
const task = (extra: Partial<Task> = {}): Task => ({
  id: `task-${nextId++}`,
  title: 'A task',
  status: 'To Do',
  createdAt: day(1),
  updatedAt: day(1),
  ...extra
});
const doneOn = (date: number, extra: Partial<Task> = {}) =>
  task({ status: 'Completed', completedAt: day(date), updatedAt: day(date), ...extra });

describe('recording status times', () => {
  it('stamps the start and finish, and clears them when a task goes back', () => {
    const now = day(24);
    expect(statusTimes('To Do', 'In Progress', now)).toEqual({ startedAt: now, completedAt: null });
    expect(statusTimes('In Progress', 'Completed', now)).toEqual({ completedAt: now });
    expect(statusTimes('Completed', 'To Do', now)).toEqual({ startedAt: null, completedAt: null });
    expect(statusTimes('Completed', 'Completed', now)).toEqual({});
  });

  it('stamps knock-on changes too, like subtasks completed with their parent', () => {
    const subtask = task({ id: 'sub', isSubtask: true, parentId: 'parent' });
    const parent = task({ id: 'parent', status: 'In Progress', subtasks: [subtask] });
    const after = [{ ...parent, status: 'Completed' as const, subtasks: [{ ...subtask, status: 'Completed' as const }] }];
    const [stamped] = withStatusTimes([parent], after, NOW);
    expect(stamped.completedAt).toBe(NOW);
    expect(stamped.subtasks![0].completedAt).toBe(NOW);
  });

  it('leaves tasks whose status didn’t change alone', () => {
    const untouched = task();
    expect(withStatusTimes([untouched], [untouched], NOW)[0]).toBe(untouched);
  });
});

describe('when a task counts as done', () => {
  it('uses the completion time, or the last edit for tasks done before times were kept', () => {
    expect(completedTime(doneOn(20))).toEqual({ at: day(20), approximate: false });
    expect(completedTime(task({ status: 'Completed', updatedAt: day(18) }))).toEqual({ at: day(18), approximate: true });
  });

  it('skips tasks imported already done, and unfinished ones', () => {
    expect(completedTime(task({ status: 'Completed', createdAt: day(5), updatedAt: day(5) }))).toBeNull();
    expect(completedTime(task({ status: 'In Progress' }))).toBeNull();
  });
});

describe('the stats', () => {
  it('counts tasks done per week, Monday to Sunday', () => {
    expect(startOfWeek(NOW)).toEqual(new Date(2026, 9, 19));
    const stats = computeStats(
      [doneOn(19, { completedAt: day(19, 0) }), doneOn(24), doneOn(18, { completedAt: day(18, 23) }), doneOn(12), task()],
      NOW
    );
    expect(stats.doneThisWeek).toBe(2);
    expect(stats.doneLastWeek).toBe(2);
    expect(stats.doneAllTime).toBe(4);
    expect(stats.weeks).toHaveLength(8);
    expect(stats.weeks[0].start).toEqual(new Date(2026, 7, 31));
  });

  it('counts tasks, not subtasks', () => {
    const subtask = doneOn(24, { isSubtask: true, parentId: 'p' });
    expect(computeStats([doneOn(24, { id: 'p', subtasks: [subtask] }), subtask], NOW).doneThisWeek).toBe(1);
  });

  it('keeps a streak alive until today is over, and remembers the best one', () => {
    // 21, 22, 23 in a row (nothing yet today), and an older run of four
    const tasks = [21, 22, 23, 23, 10, 11, 12, 13].map(date => doneOn(date));
    const stats = computeStats(tasks, NOW);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(4);
    expect(computeStats([...tasks, doneOn(24)], NOW).currentStreak).toBe(4);
    // A day missed ends it
    expect(computeStats([doneOn(21), doneOn(22)], NOW).currentStreak).toBe(0);
  });

  it('counts a streak across the clocks changing (1 November in Los Angeles)', () => {
    const tasks = [new Date(2026, 9, 31, 22), new Date(2026, 10, 1, 0, 30), new Date(2026, 10, 2, 9)].map(at =>
      task({ status: 'Completed', completedAt: at, updatedAt: at })
    );
    expect(computeStats(tasks, new Date(2026, 10, 2, 18)).currentStreak).toBe(3);
  });

  it('measures the middle time from In Progress to Completed', () => {
    const stats = computeStats(
      [
        doneOn(24, { startedAt: day(23) }), // 1 day
        doneOn(24, { startedAt: day(21) }), // 3 days
        doneOn(24, { startedAt: day(14) }), // 10 days
        doneOn(24) // never started: not measured
      ],
      NOW
    );
    expect(stats.medianInProgressMs).toBe(3 * 86_400_000);
    expect(stats.inProgressMeasured).toBe(3);
  });

  it('lists what’s in progress now, longest first', () => {
    const stats = computeStats(
      [
        task({ title: 'Recent', status: 'In Progress', startedAt: day(23) }),
        task({ title: 'Oldest', status: 'In Progress', startedAt: day(14) }),
        task({ title: 'No start time', status: 'In Progress' })
      ],
      NOW
    );
    expect(stats.inProgressNow.map(entry => entry.task.title)).toEqual(['Oldest', 'Recent']);
    expect(stats.inProgressCount).toBe(3);
  });

  it('says when some times are estimated', () => {
    expect(computeStats([doneOn(24)], NOW).approximate).toBe(false);
    expect(computeStats([task({ status: 'Completed', updatedAt: day(20) })], NOW).approximate).toBe(true);
  });
});

describe('durations', () => {
  it.each([
    [20 * 60_000, 'under an hour'],
    [3_600_000, '1 hour'],
    [5 * 3_600_000, '5 hours'],
    [23.7 * 3_600_000, '1 day'],
    [36 * 3_600_000, '2 days'],
    [12 * 86_400_000, '12 days']
  ])('%d ms reads as "%s"', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
