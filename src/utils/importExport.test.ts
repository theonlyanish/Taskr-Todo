import fs from 'fs';
import path from 'path';
import { Task } from '../types/Task';
import { MAX_IMPORT_TASKS, parseCsv, parseDueDate, parseImportFile, skipExisting, toMarkdown } from './importExport';

// Saturday 17 October 2026
const TODAY = new Date(2026, 9, 17, 10, 0);
// Copies of the sample files in docs/import-samples, kept with the tests
const sample = (name: string) => fs.readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const day = (date?: Date) => date?.toISOString().slice(0, 10);

describe('CSV reading', () => {
  it('handles quoted commas, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\nlines"\n')).toEqual([['a', 'b, c', 'say "hi"', 'two\nlines']]);
  });
});

describe('due dates in imported files', () => {
  it.each([
    ['2026-12-20', '2026-12-20'],
    ['tomorrow', '2026-10-18'],
    ['Oct 25', '2026-10-25'],
    ['25 October 2026', '2026-10-25'],
    // Already passed this year: next year
    ['Jan 5', '2027-01-05']
  ])('reads "%s" as %s', (raw, expected) => {
    expect(day(parseDueDate(raw, TODAY))).toBe(expected);
  });

  it.each(['every Monday', '03/04/2026', ''])('leaves "%s" unread', raw => {
    expect(parseDueDate(raw, TODAY)).toBeUndefined();
  });
});

describe('importing the sample files', () => {
  it('reads a Todoist export, with subtasks, notes and unreadable dates kept as text', () => {
    const result = parseImportFile(sample('todoist-sample.csv'), TODAY);
    expect(result.source).toBe('Todoist');
    const groceries = result.tasks.find(task => task.title.startsWith('Buy groceries'))!;
    expect(groceries).toBeDefined();
    expect(groceries.subtasks?.map(sub => sub.title)).toEqual(['Check the pantry first', 'Use the reusable bags']);
    expect(day(groceries.dueDate)).toBe('2026-10-18');
    // Sections go into the description
    expect(groceries.description).toMatch(/Section: Errands/);
    // A note belongs to the row above it, here the last subtask
    expect(groceries.subtasks?.[1].description).toMatch(/Shop closes at 9pm/);
    expect(result.taskCount).toBe(result.tasks.length + result.subtaskCount);
  });

  it('reads a generic CSV with a title column, statuses and parents', () => {
    const result = parseImportFile(sample('generic-sample.csv'), TODAY);
    expect(result.source).toBe('CSV');
    const holiday = result.tasks.find(task => task.title === 'Plan holiday')!;
    expect(holiday.status).toBe('In Progress');
    expect(holiday.description).toBe('Somewhere warm, under $3,000');
    expect(holiday.subtasks?.map(sub => [sub.title, sub.status])).toEqual([
      ['Compare flights', 'Completed'],
      ['Book accommodation', 'To Do']
    ]);
    expect(result.tasks.find(task => task.title === 'Pay electricity bill')?.status).toBe('Completed');
  });

  it('refuses an empty file and a file with no tasks', () => {
    expect(() => parseImportFile('', TODAY)).toThrow(/empty/);
    expect(() => parseImportFile('Title\n', TODAY)).toThrow(/No tasks/);
  });

  it('refuses files over the size limit', () => {
    const rows = Array.from({ length: MAX_IMPORT_TASKS + 1 }, (_, i) => `Task ${i}`);
    expect(() => parseImportFile(['Title', ...rows].join('\n'), TODAY)).toThrow(/limit/);
  });
});

describe('importing the same file twice', () => {
  it('skips tasks the list already has, with their subtasks', () => {
    const first = parseImportFile(sample('generic-sample.csv'), TODAY);
    const again = skipExisting(parseImportFile(sample('generic-sample.csv'), TODAY), first.tasks);
    expect(again.tasks).toHaveLength(0);
    expect(again.taskCount).toBe(0);
    expect(again.skipped).toBe(first.tasks.length);
  });

  it('matches on title (ignoring case and spacing) and due date', () => {
    const result = parseImportFile(
      ['Title,Due Date', 'Renew passport,2026-11-01', 'Renew Passport,2026-12-01', 'Call bank,'].join('\n'),
      TODAY
    );
    const existing = parseImportFile(
      ['Title,Due Date', '  renew   PASSPORT ,2026-11-01', 'call bank,'].join('\n'),
      TODAY
    ).tasks;
    const left = skipExisting(result, existing);
    // Only the passport task with a different date is new
    expect(left.tasks.map(task => [task.title, task.dueDate?.toISOString().slice(0, 10)])).toEqual([['Renew Passport', '2026-12-01']]);
    expect(left.skipped).toBe(2);
  });

  it('keeps everything when nothing matches', () => {
    const result = parseImportFile(sample('todoist-sample.csv'), TODAY);
    const left = skipExisting(result, []);
    expect(left.tasks).toHaveLength(result.tasks.length);
    expect(left.taskCount).toBe(result.taskCount);
    expect(left.skipped).toBe(0);
  });
});

describe('Markdown export', () => {
  const task = (title: string, status: Task['status'], extra: Partial<Task> = {}): Task => ({
    id: title,
    title,
    status,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...extra
  });

  it('writes GitHub task lists grouped by status, with dates, notes and subtasks', () => {
    const markdown = toMarkdown([
      task('Plan holiday', 'In Progress', {
        dueDate: new Date(Date.UTC(2026, 11, 20)),
        description: 'Somewhere warm',
        subtasks: [task('Compare flights', 'Completed', { isSubtask: true })]
      }),
      task('Renew passport', 'To Do')
    ], TODAY);
    expect(markdown).toContain('## To Do (1)');
    expect(markdown).toContain('- [ ] Renew passport');
    expect(markdown).toContain('## In Progress (1)');
    expect(markdown).toContain('- [ ] Plan holiday _(in progress, due 2026-12-20)_');
    expect(markdown).toContain('  Somewhere warm');
    expect(markdown).toContain('  - [x] Compare flights');
    expect(markdown).toContain('## Completed (0)');
    expect(markdown).toContain('_Nothing here._');
  });
});

describe('importing recurring dates', () => {
  const today = new Date(2026, 9, 25, 12); // Sunday 25 October 2026

  it('turns a Todoist "every monday" into a repeating task', () => {
    const csv = [
      'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
      'task,Team sync,,4,1,,,every monday,en,UTC',
      'task,Book club,,4,1,,,every 2nd monday,en,UTC'
    ].join('\n');
    const result = parseImportFile(csv, today);
    const [sync, club] = result.tasks;
    expect(sync.repeat).toBe('week:1');
    expect(sync.dueDate!.toISOString().slice(0, 10)).toBe('2026-10-26');
    // A pattern Taskr can't repeat stays in the description, as before
    expect(club.repeat).toBeUndefined();
    expect(club.description).toContain('Todoist date: every 2nd monday');
    expect(result.unreadDates).toBe(1);
  });
});
