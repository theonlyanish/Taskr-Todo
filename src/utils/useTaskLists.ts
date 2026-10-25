import { useCallback, useEffect, useRef, useState } from 'react';
import { ListService } from '../services/listService';
import { flushOutbox } from '../services/syncQueue';
import { isSupabaseUnavailable } from '../services/supabaseErrors';
import type { OutboxChange } from './offlineStorage';
import {
  DEFAULT_LIST_ID,
  TaskList,
  loadCurrentListId,
  loadLists,
  newList,
  storeCurrentListId,
  storeLists,
  withPersonal
} from './taskLists';

interface Options {
  userId: string | undefined;
  // Queue a change that couldn't reach the server (offline); false for other failures
  queueIfOffline: (error: unknown, userId: string | undefined, change: OutboxChange) => Promise<boolean>;
  // Tell other tabs and devices something changed (utils/liveSync)
  announceChange: () => void;
}

// The user's lists and which one is showing. Like saved templates: a guest's
// are kept on this device; an account's in the task_lists table with a copy
// here for offline. A guest's lists are added to the account when they sign in.
export const useTaskLists = ({ userId, queueIfOffline, announceChange }: Options) => {
  const [ownLists, setOwnLists] = useState<TaskList[]>(() => loadLists(userId));
  const [currentId, setCurrentId] = useState(() => loadCurrentListId(userId));
  const lists = withPersonal(ownLists);
  // A list deleted on another device, or not synced here yet, shows Personal
  const currentListId = lists.some(list => list.id === currentId) ? currentId : DEFAULT_LIST_ID;
  const currentList = lists.find(list => list.id === currentListId)!;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const keep = (next: TaskList[]) => {
    setOwnLists(next);
    storeLists(next, userIdRef.current);
  };

  const switchTo = (listId: string) => {
    setCurrentId(listId);
    storeCurrentListId(listId, userIdRef.current);
  };

  // Lists saved on this device (another tab changed them)
  const reloadFromDevice = useCallback(() => setOwnLists(loadLists(userIdRef.current)), []);

  // The account's lists from the server, after sending any changed offline.
  // Offline, or until the task_lists migration has run, this device's copy is used.
  const refresh = useCallback(async (accountId: string) => {
    try {
      const { remaining } = await flushOutbox(accountId);
      if (remaining > 0) return;
      const fromServer = await ListService.list();
      const guestLists = loadLists();
      if (fromServer === null) {
        // No table yet: a guest's lists join the account's copy on this device
        if (guestLists.length > 0 && userIdRef.current === accountId) {
          const own = loadLists(accountId);
          const next = [...own, ...guestLists.filter(guest => !own.some(list => list.id === guest.id))];
          storeLists(next, accountId);
          storeLists([]);
          setOwnLists(next);
        }
        return;
      }
      const toUpload = guestLists.filter(guest => !fromServer.some(saved => saved.id === guest.id));
      for (const list of toUpload) await ListService.save(list, accountId);
      if (guestLists.length > 0) storeLists([]);
      if (userIdRef.current !== accountId) return;
      const next = [...fromServer, ...toUpload];
      storeLists(next, accountId);
      setOwnLists(next);
    } catch (error) {
      if (!isSupabaseUnavailable(error)) console.error('Loading lists failed:', error);
    }
  }, []);

  // Signed in or out: that account's lists (or the guest's), and the list it had open
  useEffect(() => {
    setOwnLists(loadLists(userId));
    setCurrentId(loadCurrentListId(userId));
    if (userId) refresh(userId);
  }, [userId, refresh]);

  // Saves a list here and, when signed in, to the account (queued if offline)
  const send = async (change: OutboxChange) => {
    const accountId = userIdRef.current;
    if (accountId) {
      try {
        if (change.type === 'list-save') await ListService.save(change.list, accountId);
        if (change.type === 'list-delete') await ListService.remove(change.listId, accountId);
      } catch (error) {
        if (!(await queueIfOffline(error, accountId, change))) console.error('Saving lists failed:', error);
      }
    }
    announceChange();
  };

  const createList = (name: string, color?: string): TaskList => {
    const list = { ...newList(name, ownLists), ...(color ? { color } : {}) };
    keep([...ownLists, list]);
    switchTo(list.id);
    send({ type: 'list-save', list });
    return list;
  };

  const updateList = (listId: string, changes: Partial<Pick<TaskList, 'name' | 'color'>>) => {
    const existing = ownLists.find(list => list.id === listId);
    if (!existing) return;
    const updated = { ...existing, ...changes };
    keep(ownLists.map(list => (list.id === listId ? updated : list)));
    send({ type: 'list-save', list: updated });
  };

  // Only the list: the caller moves or deletes its tasks first
  const deleteList = (listId: string) => {
    if (listId === DEFAULT_LIST_ID) return;
    keep(ownLists.filter(list => list.id !== listId));
    if (currentListId === listId) switchTo(DEFAULT_LIST_ID);
    send({ type: 'list-delete', listId });
  };

  return {
    lists,
    currentList,
    currentListId,
    switchTo,
    createList,
    updateList,
    deleteList,
    reloadFromDevice,
    refresh
  };
};
