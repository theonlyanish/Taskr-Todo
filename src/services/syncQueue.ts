import { offlineStorage, OutboxChange } from '../utils/offlineStorage';
import { SupabaseTaskService } from './supabaseTaskService';
import { isSupabaseUnavailable } from './supabaseErrors';

// Signed-in changes that couldn't reach Supabase (offline, or the project
// asleep) are kept in an outbox on this device and replayed in order later:
// on reconnect, on load, on sign-in and from the sync button.

export const queueChange = (userId: string, change: OutboxChange) =>
  offlineStorage.addToOutbox({ userId, queuedAt: Date.now(), change });

export const outboxSize = async (userId: string) => (await offlineStorage.getOutbox(userId)).length;

export interface FlushResult {
  sent: number;
  remaining: number; // still waiting because the server is unreachable
  dropped: number; // rejected by the server, so retrying wouldn't help
}

// A retry of a change that already reached the server, or no longer applies
const alreadyDone = (change: OutboxChange, error: unknown) => {
  const code = (error as { code?: string }).code;
  if (change.type === 'add' && code === '23505') return true; // duplicate key: inserted earlier
  if (change.type === 'update' && code === 'PGRST116') return true; // no such row: deleted since
  return false;
};

const apply = (change: OutboxChange, userId: string): Promise<unknown> => {
  switch (change.type) {
    case 'add':
      return SupabaseTaskService.insertTaskOrThrow(change.task, userId);
    case 'update':
      return SupabaseTaskService.updateTaskOrThrow(change.task.id, change.task, userId);
    case 'delete':
      return SupabaseTaskService.deleteTaskOrThrow(change.taskId, userId);
  }
};

let flushing: Promise<FlushResult> | null = null;

// Sends queued changes oldest first. Stops at the first network failure so
// the order is kept; one flush runs at a time.
export const flushOutbox = (userId: string): Promise<FlushResult> => {
  flushing ??= (async () => {
    const entries = await offlineStorage.getOutbox(userId);
    let sent = 0;
    let dropped = 0;

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      try {
        await apply(entry.change, userId);
        sent++;
      } catch (error) {
        if (isSupabaseUnavailable(error)) {
          return { sent, dropped, remaining: entries.length - index };
        }
        if (alreadyDone(entry.change, error)) {
          sent++;
        } else {
          dropped++;
          console.warn('The server rejected a queued change, so it was dropped:', entry.change, error);
        }
      }
      await offlineStorage.removeFromOutbox(entry.seq!);
    }
    return { sent, dropped, remaining: 0 };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
};
