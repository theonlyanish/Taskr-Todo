import { Task } from '../types/Task';
import { comingUpGroups } from './ComingUp';

// Sunday 25 October 2026, midday local time; due dates are midnight UTC
const NOW = new Date(2026, 9, 25, 12);
const due = (day: number) => new Date(Date.UTC(2026, 9, day));

const task = (title: string, extra: Partial<Task> = {}): Task => ({
  id: title,
  title,
  status: 'To Do',
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
  ...extra
});

const summary = (tasks: Task[]) =>
  comingUpGroups(tasks, NOW).map(group => `${group.title}: ${group.tasks.map(t => t.title).join(', ')}`);

describe('coming up', () => {
  it('groups overdue, today and the next six days, soonest first', () => {
    const tasks = [
      task('Friday', { dueDate: due(30) }),
      task('Late', { dueDate: due(20) }),
      task('Today', { dueDate: due(25) }),
      task('Tomorrow', { dueDate: due(26) }),
      task('Next month', { dueDate: due(31 + 10) }),
      task('Week away', { dueDate: due(31) }),
      task('No date')
    ];
    expect(summary(tasks)).toEqual(['Overdue: Late', 'Today: Today', 'This week: Tomorrow, Friday, Week away']);
  });

  it('leaves out finished tasks and empty groups', () => {
    expect(summary([task('Done', { dueDate: due(24), status: 'Completed' }), task('Soon', { dueDate: due(27) })])).toEqual([
      'This week: Soon'
    ]);
  });

  it('includes subtasks once, even when they also sit at the top level', () => {
    const subtask = task('Buy stamps', { isSubtask: true, parentId: 'Post letters', dueDate: due(25) });
    const parent = task('Post letters', { subtasks: [subtask] });
    expect(summary([parent, subtask])).toEqual(['Today: Buy stamps']);
  });
});
