import { Task } from '../types/Task';
import type { OutboxEntry } from '../utils/offlineStorage';

// The outbox lives in IndexedDB and changes go to Supabase; both are replaced
// with in-memory stand-ins so the replay rules can be checked on their own.
// (Plain functions for the store: Create React App resets jest.fn mocks
// before every test.)
const mockStore: OutboxEntry[] = [];
let mockNextSeq = 1;
jest.mock('../utils/offlineStorage', () => ({
  offlineStorage: {
    addToOutbox: async (entry: OutboxEntry) => {
      mockStore.push({ ...entry, seq: mockNextSeq++ });
    },
    getOutbox: async (userId: string) => mockStore.filter(entry => entry.userId === userId),
    removeFromOutbox: async (seq: number) => {
      const index = mockStore.findIndex(entry => entry.seq === seq);
      if (index >= 0) mockStore.splice(index, 1);
    }
  }
}));
jest.mock('./supabaseTaskService', () => ({
  SupabaseTaskService: {
    insertTaskOrThrow: jest.fn(),
    updateTaskOrThrow: jest.fn(),
    deleteTaskOrThrow: jest.fn()
  }
}));
jest.mock('./templateService', () => ({
  TemplateService: { add: jest.fn(), remove: jest.fn() }
}));

/* eslint-disable import/first */
import { discardOutbox, flushOutbox, outboxSize, queueChange } from './syncQueue';
import { SupabaseTaskService } from './supabaseTaskService';
import { TemplateService } from './templateService';
/* eslint-enable import/first */

const service = SupabaseTaskService as jest.Mocked<typeof SupabaseTaskService>;
const templates = TemplateService as jest.Mocked<typeof TemplateService>;
const USER = 'user-1';
const task = (title: string): Task => ({
  id: title,
  title,
  status: 'To Do',
  createdAt: new Date(),
  updatedAt: new Date()
});
const offline = () => new TypeError('Failed to fetch');

beforeEach(() => {
  mockStore.length = 0;
  jest.clearAllMocks();
});

describe('the offline outbox', () => {
  it('sends queued changes oldest first, then empties', async () => {
    const sent: string[] = [];
    service.insertTaskOrThrow.mockImplementation(async t => {
      sent.push(`add ${t.title}`);
      return t as Task;
    });
    service.updateTaskOrThrow.mockImplementation(async id => {
      sent.push(`update ${id}`);
      return task(id);
    });
    service.deleteTaskOrThrow.mockImplementation(async id => {
      sent.push(`delete ${id}`);
    });
    await queueChange(USER, { type: 'add', task: task('A') });
    await queueChange(USER, { type: 'update', task: task('A') });
    await queueChange(USER, { type: 'delete', taskId: 'B' });

    expect(await flushOutbox(USER)).toEqual({ sent: 3, dropped: 0, remaining: 0 });
    expect(sent).toEqual(['add A', 'update A', 'delete B']);
    expect(await outboxSize(USER)).toBe(0);
  });

  it('stops at the first change that can’t get through, keeping it and everything after', async () => {
    service.insertTaskOrThrow.mockResolvedValueOnce(task('A')).mockRejectedValueOnce(offline());
    await queueChange(USER, { type: 'add', task: task('A') });
    await queueChange(USER, { type: 'add', task: task('B') });
    await queueChange(USER, { type: 'add', task: task('C') });

    expect(await flushOutbox(USER)).toEqual({ sent: 1, dropped: 0, remaining: 2 });
    // C was never tried, so an edit can't overtake the change before it
    expect(service.insertTaskOrThrow).toHaveBeenCalledTimes(2);
    expect(await outboxSize(USER)).toBe(2);
  });

  it('counts a retry that already reached the server as sent', async () => {
    service.insertTaskOrThrow.mockRejectedValueOnce({ code: '23505', message: 'duplicate key' });
    service.updateTaskOrThrow.mockRejectedValueOnce({ code: 'PGRST116', message: 'no rows' });
    await queueChange(USER, { type: 'add', task: task('A') });
    await queueChange(USER, { type: 'update', task: task('Gone') });

    expect(await flushOutbox(USER)).toEqual({ sent: 2, dropped: 0, remaining: 0 });
  });

  it('drops a change the server rejects, instead of blocking the rest', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    service.insertTaskOrThrow.mockRejectedValueOnce({ code: '42501', message: 'permission denied' }).mockResolvedValueOnce(task('B'));
    await queueChange(USER, { type: 'add', task: task('A') });
    await queueChange(USER, { type: 'add', task: task('B') });

    expect(await flushOutbox(USER)).toEqual({ sent: 1, dropped: 1, remaining: 0 });
    warn.mockRestore();
  });

  it('runs one flush at a time: a second request shares the first', async () => {
    let release!: () => void;
    service.deleteTaskOrThrow.mockImplementation(() => new Promise<void>(resolve => (release = resolve)));
    await queueChange(USER, { type: 'delete', taskId: 'A' });

    const first = flushOutbox(USER);
    const second = flushOutbox(USER);
    expect(second).toBe(first);
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    release();
    await first;
    expect(service.deleteTaskOrThrow).toHaveBeenCalledTimes(1);
  });

  it('carries template changes too', async () => {
    const template = { id: 't1', title: 'Trip', subtasks: [], createdAt: '2026-10-18T00:00:00.000Z' };
    await queueChange(USER, { type: 'template-add', template });
    await queueChange(USER, { type: 'template-delete', templateId: 't1' });

    expect(await flushOutbox(USER)).toEqual({ sent: 2, dropped: 0, remaining: 0 });
    expect(templates.add).toHaveBeenCalledWith(template, USER);
    expect(templates.remove).toHaveBeenCalledWith('t1', USER);
  });

  it('keeps each account’s changes apart, and can drop one account’s unsent changes', async () => {
    await queueChange(USER, { type: 'delete', taskId: 'A' });
    await queueChange('someone-else', { type: 'delete', taskId: 'B' });
    await discardOutbox(USER);
    expect(await outboxSize(USER)).toBe(0);
    expect(await outboxSize('someone-else')).toBe(1);
  });
});
