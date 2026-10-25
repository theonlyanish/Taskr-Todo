import { Task } from '../types/Task';
import { toMarkdown } from './importExport';
import {
  DEFAULT_LIST_ID,
  LIST_COLORS,
  TaskList,
  listOf,
  nameTaken,
  nextListColor,
  openTaskCounts,
  storedListId,
  tasksInList,
  withPersonal
} from './taskLists';

const list = (id: string, name: string, color: string, createdAt: string): TaskList => ({ id, name, color, createdAt });
const work = list('work', 'Work', LIST_COLORS[1], '2026-10-20T00:00:00.000Z');
const trip = list('trip', 'Japan trip', LIST_COLORS[2], '2026-10-22T00:00:00.000Z');
const lists = withPersonal([trip, work]);

const task = (title: string, extra: Partial<Task> = {}): Task => ({
  id: title,
  title,
  status: 'To Do',
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
  ...extra
});

describe('lists', () => {
  it('always start with Personal, then the rest oldest first', () => {
    expect(lists.map(entry => entry.name)).toEqual(['Personal', 'Work', 'Japan trip']);
  });

  it('give a new list the next colour not in use', () => {
    expect(nextListColor([work])).toBe(LIST_COLORS[2]);
    expect(nextListColor([work, trip])).toBe(LIST_COLORS[3]);
  });

  it('put a task with no list, or an unknown one, in Personal', () => {
    const known = new Set(lists.map(entry => entry.id));
    expect(listOf(task('A'), known)).toBe(DEFAULT_LIST_ID);
    expect(listOf(task('B', { listId: 'deleted-elsewhere' }), known)).toBe(DEFAULT_LIST_ID);
    expect(listOf(task('C', { listId: 'work' }), known)).toBe('work');
  });

  it('store nothing for Personal', () => {
    expect(storedListId(DEFAULT_LIST_ID)).toBeNull();
    expect(storedListId('work')).toBe('work');
  });

  it('notice a name that’s already taken, whatever the case', () => {
    expect(nameTaken(' work ', lists)).toBe(true);
    expect(nameTaken('personal', lists)).toBe(true);
    expect(nameTaken('Home', lists)).toBe(false);
    // Renaming a list to its own name is fine
    expect(nameTaken('Work', lists, 'work')).toBe(false);
  });
});

describe('the tasks of a list', () => {
  const subtask = task('Buy yen', { isSubtask: true, parentId: 'Plan Kyoto' });
  const tasks = [
    task('Plan Kyoto', { listId: 'trip', subtasks: [subtask] }),
    subtask,
    task('Write report', { listId: 'work' }),
    task('Ship notes', { listId: 'work', status: 'Completed' }),
    task('Call mum'),
    task('Orphan', { listId: 'gone' })
  ];

  it('include their subtasks, wherever those sit', () => {
    expect(tasksInList(tasks, 'trip', lists).map(t => t.title)).toEqual(['Plan Kyoto', 'Buy yen']);
  });

  it('leave Personal with every task not in another list', () => {
    expect(tasksInList(tasks, DEFAULT_LIST_ID, lists).map(t => t.title)).toEqual(['Call mum', 'Orphan']);
  });

  it('count what’s still to do in each list', () => {
    expect(openTaskCounts(tasks, lists)).toEqual({ [DEFAULT_LIST_ID]: 2, work: 1, trip: 1 });
  });
});

describe('exporting several lists', () => {
  const tasks = [task('Write report', { listId: 'work' }), task('Call mum')];

  it('groups by list, leaving out empty ones', () => {
    const markdown = toMarkdown(tasks, new Date(2026, 9, 25), lists);
    expect(markdown).toContain('## Personal');
    expect(markdown).toContain('## Work');
    expect(markdown).not.toContain('## Japan trip');
    expect(markdown.indexOf('## Personal')).toBeLessThan(markdown.indexOf('## Work'));
    expect(markdown).toContain('### To Do (1)');
  });

  it('stays as before with only Personal', () => {
    const markdown = toMarkdown(tasks, new Date(2026, 9, 25));
    expect(markdown).not.toContain('## Personal');
    expect(markdown).toContain('## To Do (2)');
  });
});
