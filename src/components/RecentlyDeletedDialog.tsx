import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DeletedTask, KEEP_DELETED_DAYS, SupabaseTaskService } from '../services/supabaseTaskService';
import { isSupabaseUnavailable } from '../services/supabaseErrors';
import { timeAgo } from '../utils/deviceName';

interface RecentlyDeletedDialogProps {
  isOnline: boolean;
  // The title of a task still in the list, for "Subtask of …"
  titleOf: (taskId: string) => string | undefined;
  // Something was restored or removed for good: refresh tasks, tell other devices
  onChanged: (restored: boolean) => void;
  onClose: () => void;
}

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; entries: DeletedTask[] }
  | { status: 'unavailable'; reason: 'setup' | 'offline' };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const daysLeft = (deletedAt: Date) => {
  const days = KEEP_DELETED_DAYS - Math.floor((Date.now() - deletedAt.getTime()) / 86_400_000);
  return days <= 1 ? 'Removed within a day' : `${days} days left`;
};

const FAILED = 'Something went wrong, so nothing changed. Try again.';
const OFFLINE = 'Couldn’t reach Taskr’s servers, so nothing changed. Check your connection and try again.';

// Tasks deleted in the last 30 days, which can be brought back or removed for good
export const RecentlyDeletedDialog: React.FC<RecentlyDeletedDialogProps> = ({ isOnline, titleOf, onChanged, onClose }) => {
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);
  // A task waiting for "Delete forever" to be confirmed, or 'all' for Empty bin
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const entries = await SupabaseTaskService.getDeletedTasks();
      setList(entries ? { status: 'ready', entries } : { status: 'unavailable', reason: 'setup' });
    } catch (error) {
      setList({ status: 'unavailable', reason: isSupabaseUnavailable(error) ? 'offline' : 'setup' });
      if (!isSupabaseUnavailable(error)) console.error('Loading recently deleted tasks failed:', error);
    }
  }, []);

  useEffect(() => {
    load();
    closeRef.current?.focus();
  }, [load]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (confirming) setConfirming(null);
    else if (!busyId) onClose();
  };

  // Runs one change, then reloads the list
  const run = async (id: string, action: () => Promise<void>, done: string, restored: boolean) => {
    setBusyId(id);
    setConfirming(null);
    setMessage(null);
    try {
      await action();
      setMessage({ text: done });
      onChanged(restored);
      await load();
    } catch (error) {
      setMessage({ text: isSupabaseUnavailable(error) ? OFFLINE : FAILED, error: true });
      if (!isSupabaseUnavailable(error)) console.error('Recently deleted change failed:', error);
    } finally {
      setBusyId(null);
    }
  };

  const entries = list.status === 'ready' ? list.entries : [];
  const disabled = !isOnline || !!busyId;

  return (
    <div className="modal-overlay" onClick={() => !busyId && onClose()}>
      <div
        className="modal-content bin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bin-title"
        aria-busy={list.status === 'loading' || !!busyId}
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="bin-title">Recently deleted</h3>
        <p className="bin-intro">
          Deleted tasks stay here for {KEEP_DELETED_DAYS} days, on all your devices, then they’re removed for good.
        </p>

        {list.status === 'loading' && <p className="bin-note">Loading…</p>}
        {list.status === 'unavailable' && (
          <p className="bin-note">
            {list.reason === 'offline'
              ? 'This needs a connection. Try again once you’re back online.'
              : 'Recently deleted isn’t available right now. Until it is, deleted tasks are removed straight away.'}
          </p>
        )}
        {list.status === 'ready' && entries.length === 0 && (
          <p className="bin-empty">Nothing here. Tasks you delete will appear here for {KEEP_DELETED_DAYS} days.</p>
        )}

        {entries.length > 0 && (
          <ul className="bin-list">
            {entries.map(entry => {
              const { task } = entry;
              const parentTitle = task.parentId ? titleOf(task.parentId) : undefined;
              const details = [
                task.isSubtask ? (parentTitle ? `Subtask of “${parentTitle}”` : 'Subtask') : null,
                entry.subtaskCount > 0 ? `with ${plural(entry.subtaskCount, 'subtask')}` : null,
                `Deleted ${timeAgo(entry.deletedAt)}`,
                daysLeft(entry.deletedAt)
              ].filter(Boolean).join(' · ');

              return (
                <li key={task.id} className="bin-row">
                  {confirming === task.id ? (
                    <div className="bin-confirm" role="group" aria-label={`Delete “${task.title}” for good?`}>
                      <span>Delete “{task.title}” for good? This can’t be undone.</span>
                      <button
                        type="button"
                        className="bin-confirm-delete"
                        onClick={() => run(task.id, () => SupabaseTaskService.deleteForever(task.id), `“${task.title}” was deleted for good.`, false)}
                      >
                        Delete
                      </button>
                      <button type="button" className="bin-confirm-cancel" onClick={() => setConfirming(null)} autoFocus>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bin-details">
                        <span className="bin-title">{task.title}</span>
                        <span className="bin-meta">{details}</span>
                      </div>
                      <button
                        type="button"
                        className="bin-restore"
                        disabled={disabled}
                        onClick={() => run(task.id, () => SupabaseTaskService.restoreTask(entry), task.isSubtask ? `“${task.title}” is back.` : `“${task.title}” is back in ${task.status}.`, true)}
                      >
                        {busyId === task.id ? 'Restoring…' : 'Restore'}
                      </button>
                      <button
                        type="button"
                        className="bin-delete"
                        disabled={disabled}
                        onClick={() => setConfirming(task.id)}
                        aria-label={`Delete “${task.title}” for good`}
                        title="Delete for good"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {message && (
          <p className={`bin-message ${message.error ? 'is-error' : ''}`} role={message.error ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
        {!isOnline && <p className="bin-note" role="status">You’re offline. Connect to restore or remove tasks.</p>}

        <div className="bin-actions">
          {entries.length > 0 && (confirming === 'all' ? (
            <div className="bin-confirm" role="group" aria-label="Empty Recently deleted?">
              <span>Delete all {plural(entries.length, 'task')} here for good?</span>
              <button
                type="button"
                className="bin-confirm-delete"
                onClick={() => run('all', () => SupabaseTaskService.emptyRecentlyDeleted(), 'Recently deleted is empty.', false)}
              >
                Empty
              </button>
              <button type="button" className="bin-confirm-cancel" onClick={() => setConfirming(null)} autoFocus>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="bin-empty-btn" disabled={disabled} onClick={() => setConfirming('all')}>
              {busyId === 'all' ? 'Emptying…' : 'Empty bin'}
            </button>
          ))}
          <button ref={closeRef} type="button" className="cancel-btn bin-close" onClick={onClose} disabled={!!busyId}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
