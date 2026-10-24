import { Task } from '../types/Task';
import { remindersDue, reminderText } from './reminders';

// Due dates are stored as midnight UTC of the chosen day
const due = (isoDay: string) => new Date(`${isoDay}T00:00:00.000Z`);
// Saturday 24 October 2026, local time
const at = (hour: number, minute = 0) => new Date(2026, 9, 24, hour, minute);
const YESTERDAY = new Date(2026, 9, 23, 12);

const task = (title: string, extra: Partial<Task> = {}): Task => ({
  id: title,
  title,
  status: 'To Do',
  dueDate: due('2026-10-24'),
  createdAt: YESTERDAY,
  updatedAt: YESTERDAY,
  ...extra
});

const titles = (tasks: Task[]) => tasks.map(t => t.title);

describe('which tasks get a reminder', () => {
  it('announces tasks due today from 9am, not before', () => {
    const tasks = [task('Pay rent')];
    expect(remindersDue(tasks, at(8, 59), {})).toEqual([]);
    expect(titles(remindersDue(tasks, at(9), {}))).toEqual(['Pay rent']);
    // Opened later in the day, it still catches up
    expect(titles(remindersDue(tasks, at(16), {}))).toEqual(['Pay rent']);
  });

  it('skips tasks that are done, due another day or have no date', () => {
    const tasks = [
      task('Done', { status: 'Completed' }),
      task('Tomorrow', { dueDate: due('2026-10-25') }),
      task('Overdue', { dueDate: due('2026-10-23') }),
      task('No date', { dueDate: undefined }),
      task('In progress', { status: 'In Progress' })
    ];
    expect(titles(remindersDue(tasks, at(10), {}))).toEqual(['In progress']);
  });

  it('announces each task once a day', () => {
    const tasks = [task('Pay rent'), task('Call mum')];
    expect(titles(remindersDue(tasks, at(10), { 'Pay rent': '2026-10-24' }))).toEqual(['Call mum']);
    // Announced on an earlier day doesn't count
    expect(titles(remindersDue(tasks, at(10), { 'Pay rent': '2026-10-23' }))).toEqual(['Pay rent', 'Call mum']);
  });

  it('leaves out a task given today’s date after 9am, since you’ve just seen it', () => {
    const tasks = [task('Just added', { createdAt: at(11), updatedAt: at(11) })];
    expect(remindersDue(tasks, at(11, 1), {})).toEqual([]);
  });

  it('includes subtasks due today, counting each once', () => {
    const subtask = task('Buy stamps', { isSubtask: true, parentId: 'Post letters' });
    const parent = task('Post letters', { dueDate: undefined, subtasks: [subtask] });
    // Subtasks can also sit at the top level of the list
    expect(titles(remindersDue([parent, subtask], at(10), {}))).toEqual(['Buy stamps']);
  });

  it('reads dates that came back from storage as strings', () => {
    const stored = task('Pay rent', {
      dueDate: '2026-10-24T00:00:00.000Z' as unknown as Date,
      updatedAt: YESTERDAY.toISOString() as unknown as Date
    });
    expect(titles(remindersDue([stored], at(10), {}))).toEqual(['Pay rent']);
  });
});

describe('what the reminder says', () => {
  it('names a single task', () => {
    expect(reminderText([task('Pay rent')])).toEqual({ title: 'Due today', body: 'Pay rent' });
  });

  it('lists up to four, then counts the rest', () => {
    const text = reminderText(['A', 'B', 'C', 'D', 'E', 'F'].map(name => task(name)));
    expect(text.title).toBe('6 tasks due today');
    expect(text.body).toBe('• A\n• B\n• C\n• D\nand 2 more');
  });
});
