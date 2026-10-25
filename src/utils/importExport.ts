import { Task, TaskStatus } from '../types/Task';
import { TaskList, listOf, withPersonal } from './taskLists';

// Import from a Todoist CSV export or any CSV with a title column, and
// export to Markdown. Kept free of React and storage so it can be tested alone.

export type ImportSource = 'Todoist' | 'CSV';

export interface ImportResult {
  source: ImportSource;
  tasks: Task[]; // top-level tasks, each with its subtasks nested
  taskCount: number; // top-level tasks and subtasks together
  subtaskCount: number;
  // Dates that couldn't be read (e.g. "every Monday"); kept in the description instead
  unreadDates: number;
  // Tasks left out because the list already has them (see skipExisting)
  skipped?: number;
}

// Very large files are almost certainly the wrong file
export const MAX_IMPORT_TASKS = 1000;

/* ---------- CSV ---------- */

// RFC 4180 style: quoted fields may hold commas, quotes ("") and line breaks
export const parseCsv = (text: string): string[][] => {
  const input = text.replace(/^﻿/, '');
  const firstLine = input.slice(0, input.search(/\r?\n|$/));
  const delimiter = [',', ';', '\t'].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop blank lines
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
};

/* ---------- Dates ---------- */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Due dates are stored as midnight UTC (see CalendarView)
const utcDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCMonth() === month && date.getUTCDate() === day ? date : undefined;
};

// Reads ISO dates, "today", "tomorrow" and month-name dates such as "Oct 25",
// "25 October 2026" or "Oct 25, 2026". Anything else (recurring dates,
// ambiguous 03/04/2026) returns undefined so the caller can keep the text.
export const parseDueDate = (raw: string, today = new Date()): Date | undefined => {
  const text = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!text) return undefined;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return utcDate(+iso[1], +iso[2] - 1, +iso[3]);

  if (text === 'today' || text === 'tomorrow') {
    const offset = text === 'tomorrow' ? 1 : 0;
    return utcDate(today.getFullYear(), today.getMonth(), today.getDate() + offset)
      ?? new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  }

  const monthIndex = (word: string) => MONTHS.indexOf(word.slice(0, 3));
  const monthFirst = text.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/);
  const dayFirst = text.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{4}))?$/);
  const parts = monthFirst
    ? { month: monthIndex(monthFirst[1]), day: +monthFirst[2], year: monthFirst[3] }
    : dayFirst
      ? { month: monthIndex(dayFirst[2]), day: +dayFirst[1], year: dayFirst[3] }
      : undefined;
  if (!parts || parts.month < 0) return undefined;

  if (parts.year) return utcDate(+parts.year, parts.month, parts.day);
  // No year: the next time that date comes round
  const thisYear = utcDate(today.getFullYear(), parts.month, parts.day);
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return thisYear && thisYear.getTime() >= startOfToday
    ? thisYear
    : utcDate(today.getFullYear() + 1, parts.month, parts.day);
};

/* ---------- Building tasks ---------- */

const parseStatus = (raw: string | undefined): TaskStatus => {
  const text = (raw ?? '').trim().toLowerCase();
  if (['completed', 'complete', 'done', 'true', 'yes', 'y', 'x', '1', 'closed', 'finished'].includes(text)) {
    return 'Completed';
  }
  if (['in progress', 'in-progress', 'doing', 'started', 'active', 'wip'].includes(text)) {
    return 'In Progress';
  }
  return 'To Do';
};

const newTask = (title: string, description: string, status: TaskStatus, dueDate?: Date): Task => {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    description: description || undefined,
    status,
    dueDate,
    createdAt: now,
    updatedAt: now,
    isSubtask: false,
    subtasks: []
  };
};

const addSubtask = (parent: Task, subtask: Task) => {
  subtask.isSubtask = true;
  subtask.parentId = parent.id;
  parent.subtasks = [...(parent.subtasks || []), subtask];
};

const appendLine = (text: string | undefined, line: string) => (text ? `${text}\n${line}` : line);

const finish = (source: ImportSource, tasks: Task[], unreadDates: number): ImportResult => {
  const subtaskCount = tasks.reduce((sum, task) => sum + (task.subtasks?.length ?? 0), 0);
  return { source, tasks, taskCount: tasks.length + subtaskCount, subtaskCount, unreadDates };
};

// Todoist "Export as CSV" (template) files: TYPE is task, section or note;
// INDENT 1 is a task and 2+ a subtask. Taskr has one level of subtasks, so
// deeper ones attach to the nearest top-level task.
const fromTodoist = (header: string[], rows: string[][], today: Date): ImportResult => {
  const column = (name: string) => header.indexOf(name);
  const [typeCol, contentCol, descriptionCol, indentCol, dateCol] =
    ['TYPE', 'CONTENT', 'DESCRIPTION', 'INDENT', 'DATE'].map(column);

  const tasks: Task[] = [];
  let currentParent: Task | undefined;
  let lastTask: Task | undefined;
  let section = '';
  let unreadDates = 0;

  for (const row of rows) {
    const type = (row[typeCol] ?? '').trim().toLowerCase();
    const content = (row[contentCol] ?? '').trim();

    if (type === 'section') {
      section = content;
      continue;
    }
    if (type === 'note') {
      if (lastTask && content) lastTask.description = appendLine(lastTask.description, content);
      continue;
    }
    if (type !== 'task' || !content) continue;

    let description = (row[descriptionCol] ?? '').trim();
    const rawDate = (row[dateCol] ?? '').trim();
    const dueDate = rawDate ? parseDueDate(rawDate, today) : undefined;
    if (rawDate && !dueDate) {
      unreadDates++;
      description = appendLine(description, `Todoist date: ${rawDate}`);
    }
    const indent = parseInt(row[indentCol] ?? '1', 10) || 1;
    const isSubtask = indent > 1 && !!currentParent;
    // Taskr has no sections; note it on top-level tasks (subtasks share their parent's)
    if (section && !isSubtask) description = appendLine(description, `Section: ${section}`);

    const task = newTask(content, description, 'To Do', dueDate);
    if (isSubtask && currentParent) {
      addSubtask(currentParent, task);
    } else {
      tasks.push(task);
      currentParent = task;
    }
    lastTask = task;
  }
  return finish('Todoist', tasks, unreadDates);
};

const HEADER_NAMES = {
  title: ['title', 'task', 'name', 'content', 'summary', 'subject', 'task name'],
  description: ['description', 'notes', 'note', 'details', 'body'],
  status: ['status', 'state', 'completed', 'done', 'complete'],
  due: ['due date', 'due', 'date', 'deadline', 'due_date', 'duedate'],
  parent: ['parent', 'parent task', 'parent title', 'parent_task']
};

// Any CSV with a title-like column. An optional "parent" column holding the
// title of another row makes that row a subtask of it.
const fromGenericCsv = (header: string[], rows: string[][], today: Date): ImportResult => {
  const normalised = header.map(name => name.trim().toLowerCase());
  const find = (names: string[]) => normalised.findIndex(name => names.includes(name));
  const titleCol = find(HEADER_NAMES.title);
  if (titleCol < 0) {
    throw new Error('No title column found. Name one of the columns “Title”, “Task” or “Name”.');
  }
  const descriptionCol = find(HEADER_NAMES.description);
  const statusCol = find(HEADER_NAMES.status);
  const dueCol = find(HEADER_NAMES.due);
  const parentCol = find(HEADER_NAMES.parent);

  const tasks: Task[] = [];
  const byTitle = new Map<string, Task>();
  const pendingSubtasks: { task: Task; parentTitle: string }[] = [];
  let unreadDates = 0;

  for (const row of rows) {
    const title = (row[titleCol] ?? '').trim();
    if (!title) continue;

    let description = descriptionCol >= 0 ? (row[descriptionCol] ?? '').trim() : '';
    const rawDate = dueCol >= 0 ? (row[dueCol] ?? '').trim() : '';
    const dueDate = rawDate ? parseDueDate(rawDate, today) : undefined;
    if (rawDate && !dueDate) {
      unreadDates++;
      description = appendLine(description, `Due: ${rawDate}`);
    }

    const task = newTask(title, description, parseStatus(statusCol >= 0 ? row[statusCol] : ''), dueDate);
    const parentTitle = parentCol >= 0 ? (row[parentCol] ?? '').trim() : '';
    if (parentTitle) {
      pendingSubtasks.push({ task, parentTitle });
    } else {
      tasks.push(task);
      if (!byTitle.has(title.toLowerCase())) byTitle.set(title.toLowerCase(), task);
    }
  }

  // Parents may come after their subtasks in the file, so link them at the end.
  // A subtask whose parent isn't in the file becomes a normal task.
  for (const { task, parentTitle } of pendingSubtasks) {
    const parent = byTitle.get(parentTitle.toLowerCase());
    if (parent) addSubtask(parent, task);
    else tasks.push(task);
  }
  return finish('CSV', tasks, unreadDates);
};

export const parseImportFile = (text: string, today = new Date()): ImportResult => {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('The file is empty.');

  const upper = header.map(name => name.trim().toUpperCase());
  const result = upper.includes('TYPE') && upper.includes('CONTENT')
    ? fromTodoist(upper, rows, today)
    : fromGenericCsv(header, rows, today);

  if (result.taskCount === 0) throw new Error('No tasks were found in the file.');
  if (result.taskCount > MAX_IMPORT_TASKS) {
    throw new Error(`The file has ${result.taskCount} tasks; the limit is ${MAX_IMPORT_TASKS} per import.`);
  }
  return result;
};

/* ---------- Duplicates ---------- */

// Same title (ignoring case and spacing) and same due date: the same task
const duplicateKey = (task: Task) =>
  `${task.title.trim().toLowerCase().replace(/\s+/g, ' ')}|${task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''}`;

// Leaves out tasks the list already has, with their subtasks, so importing
// the same file twice doesn't double everything up
export const skipExisting = (result: ImportResult, existing: Task[]): ImportResult => {
  const have = new Set(existing.filter(task => !task.isSubtask).map(duplicateKey));
  const tasks = result.tasks.filter(task => !have.has(duplicateKey(task)));
  const subtaskCount = tasks.reduce((sum, task) => sum + (task.subtasks?.length ?? 0), 0);
  return {
    ...result,
    tasks,
    taskCount: tasks.length + subtaskCount,
    subtaskCount,
    skipped: result.tasks.length - tasks.length
  };
};

/* ---------- Markdown export ---------- */

const formatDate = (date: Date | undefined) =>
  date ? new Date(date).toISOString().slice(0, 10) : undefined;

const markdownItem = (task: Task, indent: string): string[] => {
  const done = task.status === 'Completed';
  const notes = [
    task.status === 'In Progress' ? 'in progress' : undefined,
    formatDate(task.dueDate) ? `due ${formatDate(task.dueDate)}` : undefined
  ].filter(Boolean);
  const lines = [`${indent}- [${done ? 'x' : ' '}] ${task.title}${notes.length ? ` _(${notes.join(', ')})_` : ''}`];
  // Description lines sit inside the list item
  for (const line of (task.description ?? '').split('\n')) {
    if (line.trim()) lines.push(`${indent}  ${line.trim()}`);
  }
  for (const subtask of task.subtasks ?? []) {
    lines.push(...markdownItem(subtask, `${indent}  `));
  }
  return lines;
};

const statusSections = (topLevel: Task[], heading: string): string[] => {
  const lines: string[] = [];
  for (const status of ['To Do', 'In Progress', 'Completed'] as TaskStatus[]) {
    const inSection = topLevel.filter(task => task.status === status);
    lines.push('', `${heading} ${status} (${inSection.length})`, '');
    if (inSection.length === 0) lines.push('_Nothing here._');
    for (const task of inSection) lines.push(...markdownItem(task, ''));
  }
  return lines;
};

// GitHub-style task lists, grouped by status, and first by list when there's
// more than one (lists with no tasks are left out)
export const toMarkdown = (tasks: Task[], exportedAt = new Date(), lists: TaskList[] = []): string => {
  const topLevel = tasks.filter(task => !task.isSubtask);
  const lines = [
    '# Taskr tasks',
    '',
    `Exported ${exportedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
  ];
  const allLists = withPersonal(lists);
  if (allLists.length === 1) {
    lines.push(...statusSections(topLevel, '##'));
  } else {
    const knownIds = new Set(allLists.map(list => list.id));
    for (const list of allLists) {
      const inList = topLevel.filter(task => listOf(task, knownIds) === list.id);
      if (inList.length === 0) continue;
      lines.push('', `## ${list.name}`, ...statusSections(inList, '###'));
    }
  }
  return `${lines.join('\n')}\n`;
};

export const exportFileName = (date = new Date()) =>
  `taskr-tasks-${date.toISOString().slice(0, 10)}.md`;
