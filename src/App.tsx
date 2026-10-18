import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { ThemeToggle } from './components/ThemeToggle';
import { Auth, AuthMode } from './components/Auth';
import { SyncIndicator } from './components/SyncIndicator';
import KanbanView from './components/KanbanView';
import { CalendarView } from './components/CalendarView';
import { ViewSwitcher, ViewType } from './components/ViewSwitcher';
import { useTheme } from './utils/theme';
import { CalendarLayout, Preferences, saveCalendarLayout, savedCalendarLayout, savedView, saveView } from './utils/preferences';
import { useAccountPreferences } from './utils/useAccountPreferences';
import { UndoToast } from './components/UndoToast';
import { FocusTimer } from './components/FocusTimer';
import { useFocusTimer } from './utils/focusTimer';
import { TaskPosition } from './utils/taskOrder';
import { setSubtasksExpanded } from './utils/subtaskExpansion';
import { useLiveSync } from './utils/liveSync';
import { CommandPalette, PaletteItem } from './components/CommandPalette';
import { ImportDialog, ImportState } from './components/ImportDialog';
import { AccountMenu } from './components/AccountMenu';
import { DeleteAccountDialog, DeleteAccountState } from './components/DeleteAccountDialog';
import { exportFileName, parseImportFile, toMarkdown } from './utils/importExport';
import { describeDueDate, parseQuickAdd, useQuickAdd } from './utils/quickAdd';
import { SupabaseTaskService } from './services/supabaseTaskService';
import { AuthService } from './services/authService';
import { Task, TaskStatus } from './types/Task';
import { User } from '@supabase/supabase-js';
import { loadTasks } from './utils/taskOperations';
import { MantineProvider } from '@mantine/core';
import './styles.css';
import { getPresetTasks, hasSeenPresetTasks, isUntouchedPresetTask, markPresetTasksAsSeen } from './utils/presetTasks';
import { offlineStorage, OutboxChange } from './utils/offlineStorage';
import { CLOUD_ASLEEP_MESSAGE, OFFLINE_QUEUED_MESSAGE, friendlyDeleteAccountError, isSupabaseUnavailable } from './services/supabaseErrors';
import { discardOutbox, flushOutbox, outboxSize, queueChange } from './services/syncQueue';

// Matches the stacked layout breakpoint in styles.css
const STACKED_LAYOUT_QUERY = '(max-width: 900px)';

// Show ⌘ on Apple devices and Ctrl elsewhere in the shortcut hint
const IS_APPLE = /Mac|iPhone|iPad/.test(navigator.userAgent);

const VIEW_LABELS: Record<ViewType, string> = {
  normal: 'list view',
  kanban: 'Kanban board',
  calendar: 'calendar'
};

// Extra search words for each view in the command palette
const VIEW_KEYWORDS: Record<ViewType, string> = {
  normal: 'view show normal list tasks',
  kanban: 'view show board columns',
  calendar: 'view show month week dates schedule'
};

// How long a deleted task can be brought back before the delete is saved
const UNDO_WINDOW_MS = 5000;

// A delete that has been applied on screen but not yet saved
interface PendingDelete {
  task: Task;
  parentId?: string; // set when the deleted task is a subtask
  index: number; // position among its siblings, so undo puts it back in place
  commit: () => Promise<unknown>;
}

const withoutTask = (taskList: Task[], id: string): Task[] =>
  taskList
    .filter(task => task.id !== id)
    .map(task =>
      task.subtasks?.some(subtask => subtask.id === id)
        ? { ...task, subtasks: task.subtasks.filter(subtask => subtask.id !== id) }
        : task
    );

// Tasks other than the edited one whose status changed as a knock-on effect,
// e.g. subtasks completed along with their parent
const cascadedStatusChanges = (before: Task[], after: Task[], editedId: string): Task[] => {
  const flatten = (taskList: Task[]) => taskList.flatMap(task => [task, ...(task.subtasks || [])]);
  const previousStatus = new Map(flatten(before).map(task => [task.id, task.status]));
  return flatten(after).filter(
    task => task.id !== editedId && previousStatus.has(task.id) && previousStatus.get(task.id) !== task.status
  );
};

// Apply updates to a task wherever it sits, top level or as a subtask
const withTaskUpdated = (taskList: Task[], id: string, updates: Partial<Task>): Task[] =>
  taskList.map(task => {
    if (task.id === id) return { ...task, ...updates };
    if (task.subtasks?.some(subtask => subtask.id === id)) {
      return {
        ...task,
        subtasks: task.subtasks.map(subtask => (subtask.id === id ? { ...subtask, ...updates } : subtask))
      };
    }
    return task;
  });

const withTaskRestored = (taskList: Task[], { task, parentId, index }: PendingDelete): Task[] => {
  const insertAt = (items: Task[]) => [...items.slice(0, index), task, ...items.slice(index)];
  if (!parentId) return insertAt(taskList);
  return taskList.map(t => (t.id === parentId ? { ...t, subtasks: insertAt(t.subtasks || []) } : t));
};

function App() {
  const [tasks, setTasks] = useState<Task[]>([] as Task[]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  // Starts in the device's light or dark mode until the user picks one
  const { isDark: isDarkMode, theme, setTheme, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Why the sign-in dialog was opened, shown in place of its default line
  const [authMessage, setAuthMessage] = useState<string | undefined>(undefined);
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [importState, setImportState] = useState<ImportState | null>(null);
  // The email is kept so the dialog can still name the account once it's deleted
  const [deleteAccount, setDeleteAccount] = useState<{ email: string; state: DeleteAccountState } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Opens in the view used last (on any device, when signed in)
  const [viewType, setViewType] = useState<ViewType>(() => savedView() ?? 'normal');
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>(() => savedCalendarLayout() ?? 'dayGridMonth');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newSubtaskParentId, setNewSubtaskParentId] = useState<string | null>(null);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const taskFormRef = useRef<HTMLDivElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  // Countdown for working on one task, shown in a bar and the browser tab
  const focus = useFocusTimer();
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const undoTimerRef = useRef<number | undefined>(undefined);
  // Latest tasks, for saving a guest's list when a delayed delete is committed
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Save the pending delete now (undo window over, toast dismissed, or another delete started)
  const commitPendingDelete = useCallback(() => {
    window.clearTimeout(undoTimerRef.current);
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    pending?.commit().catch(error => console.error('Error deleting task:', error));
  }, []);

  const [showPalette, setShowPalette] = useState(false);
  // Start loading the date parser for quick add; re-renders once it's ready
  useQuickAdd();

  // Ctrl+K (Cmd+K on a Mac) opens and closes the command palette from anywhere
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowPalette(open => !open);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Don't lose a delete if the tab is closed during the undo window
  useEffect(() => {
    window.addEventListener('pagehide', commitPendingDelete);
    return () => window.removeEventListener('pagehide', commitPendingDelete);
  }, [commitPendingDelete]);

  // On narrow screens the form sits below the tasks, so bring it into view
  // whenever a task is picked or a new one is started.
  const revealTaskForm = () => {
    if (!window.matchMedia(STACKED_LAYOUT_QUERY).matches) return;
    requestAnimationFrame(() => {
      taskFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
    revealTaskForm();
  };

  // Show a friendly banner when Supabase is unreachable (e.g. the free-tier
  // project is paused) instead of leaking the raw error. Guest mode is unaffected.
  const reportCloudError = (error: unknown) => {
    if (isSupabaseUnavailable(error)) setCloudNotice(CLOUD_ASLEEP_MESSAGE);
  };

  // Latest signed-in user, for listeners registered once on mount
  const userRef = useRef(user);
  userRef.current = user;

  // Keep a copy on this device: signed-in users' tasks go in their own cache
  // (shown when offline), guests' in the guest store
  const saveOnDevice = (taskList: Task[], userId = userRef.current?.id) =>
    userId ? offlineStorage.saveAccountTasks(userId, taskList) : offlineStorage.saveTasks(taskList);

  // The account's tasks from the server, keeping the order saved on this
  // device for any task the server has no position for. Until the
  // task_position migration runs, the server can't store the order at all.
  const fetchAccountTasks = async (userId: string) => {
    const fresh = await SupabaseTaskService.getTasks();
    const cached = await offlineStorage.getAccountTasks(userId);
    if (!cached?.length) return fresh;
    const cachedPositions = new Map(
      cached.filter(task => task.position !== undefined).map(task => [task.id, task.position])
    );
    return fresh.map(task =>
      task.position === undefined && cachedPositions.has(task.id)
        ? { ...task, position: cachedPositions.get(task.id) }
        : task
    );
  };

  // A signed-in write that failed because Supabase couldn't be reached goes in
  // the outbox to be sent later. Returns false for any other kind of failure.
  const queueIfOffline = async (error: unknown, userId: string | undefined, change: OutboxChange) => {
    if (!userId || !isSupabaseUnavailable(error)) return false;
    await queueChange(userId, change);
    setCloudNotice(OFFLINE_QUEUED_MESSAGE);
    return true;
  };

  // Another tab on this device changed the tasks: show what it saved
  const reloadFromDevice = async () => {
    const signedIn = userRef.current;
    let saved = signedIn ? await offlineStorage.getAccountTasks(signedIn.id) : await loadTasks();
    if (!saved) return;
    // A delete still inside its undo window here stays hidden
    const pending = pendingDeleteRef.current;
    if (pending) saved = withoutTask(saved, pending.task.id);
    tasksRef.current = saved;
    setTasks(saved);
  };

  // Live updates from other tabs and devices (see utils/liveSync)
  const { announceChange } = useLiveSync({
    userId: user?.id,
    onTabChange: () => {
      reloadFromDevice().catch(error => console.error('Reading tasks saved by another tab failed:', error));
    },
    onDeviceChange: () => {
      const signedIn = userRef.current;
      if (!signedIn) return;
      syncWithServerRef.current(signedIn.id).catch(error => {
        console.error('Live update failed:', error);
        reportCloudError(error);
      });
    }
  });

  // Send queued changes, then load the account's tasks fresh from Supabase.
  // If anything is still queued (still offline), keep what's on screen.
  const syncWithServer = async (userId: string) => {
    const { remaining, sent } = await flushOutbox(userId);
    // Changes made here while offline have now reached the server
    if (sent > 0) announceChange();
    if (remaining > 0) {
      setCloudNotice(OFFLINE_QUEUED_MESSAGE);
      return;
    }
    let fresh = await fetchAccountTasks(userId);
    // A delete still inside its undo window hasn't been sent yet; keep it hidden
    const pending = pendingDeleteRef.current;
    if (pending) fresh = withoutTask(fresh, pending.task.id);
    tasksRef.current = fresh;
    setTasks(fresh);
    await saveOnDevice(fresh, userId);
    setCloudNotice(current => (current === OFFLINE_QUEUED_MESSAGE || current === CLOUD_ASLEEP_MESSAGE ? null : current));
  };
  // For the "online" listener, which is registered once on mount
  const syncWithServerRef = useRef(syncWithServer);
  syncWithServerRef.current = syncWithServer;


  useEffect(() => saveView(viewType), [viewType]);
  useEffect(() => saveCalendarLayout(calendarLayout), [calendarLayout]);

  // Theme, view and calendar layout follow a signed-in user between devices
  const applyAccountPreferences = (preferences: Preferences) => {
    if (preferences.theme) setTheme(preferences.theme);
    if (preferences.view) setViewType(preferences.view);
    if (preferences.calendarLayout) setCalendarLayout(preferences.calendarLayout);
  };
  useAccountPreferences(
    user?.id,
    { theme: theme ?? undefined, view: viewType, calendarLayout },
    applyAccountPreferences
  );

  // Load tasks and check auth state on mount
  useEffect(() => {
    const loadInitialData = async () => {
      let currentUser: User | null = null;

      try {
        currentUser = await AuthService.getCurrentUser();
        setUser(currentUser);

        let loadedTasks: Task[] = [];
        
        if (currentUser) {
          // Send anything queued while offline first, so the server copy is current
          const { remaining } = await flushOutbox(currentUser.id);
          if (remaining > 0) {
            // Still unreachable: show this account's tasks as last saved here.
            // status 0 marks it as "backend unreachable" for isSupabaseUnavailable.
            throw Object.assign(new Error('Changes are still waiting to sync'), { status: 0 });
          }
          // If user is logged in, load tasks from Supabase
          loadedTasks = await fetchAccountTasks(currentUser.id);
          await saveOnDevice(loadedTasks, currentUser.id);
        } else {
          // If not logged in, try to load from local storage
          loadedTasks = await loadTasks();
        }

        // Only load preset tasks if there are no existing tasks and they haven't been seen
        if (loadedTasks.length === 0 && !hasSeenPresetTasks()) {
          // Mark straight away so a second run of this effect (React StrictMode
          // in development) can't seed the welcome tasks twice
          markPresetTasksAsSeen();
          const seededAt = Date.now();
          const presetTasks = getPresetTasks().map((task, index) => {
            const taskId = crypto.randomUUID();
            // A millisecond apart so sorting by creation time keeps the tour in order
            const createdAt = new Date(seededAt + index);
            return {
              ...task,
              id: taskId,
              createdAt,
              updatedAt: createdAt,
              subtasks: task.subtasks?.map(subtask => ({
                ...subtask,
                id: crypto.randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date(),
                isSubtask: true,
                parentId: taskId
              })) || []
            };
          });
          
          // Save all welcome tasks on this device in one go. (Guests used to get
          // addTask(task, []) for each one afterwards, which rewrote storage with
          // just that task, so only the last welcome task survived a reload.)
          await saveOnDevice(presetTasks, currentUser?.id);

          if (currentUser) {
            // If user is logged in, save to Supabase
            for (const task of presetTasks) {
              await SupabaseTaskService.saveTask(task);
            }
          }

          setTasks(presetTasks);
        } else if (loadedTasks.length > 0) {
          // Only set tasks if we actually have tasks to set
          setTasks(loadedTasks);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
        // Fall back to what's saved on this device: the signed-in user's own
        // cache (with any queued edits applied), or the guest's tasks
        const savedTasks = currentUser
          ? await offlineStorage.getAccountTasks(currentUser.id)
          : await loadTasks();
        if (savedTasks && savedTasks.length > 0) {
          setTasks(savedTasks);
        }
        if (currentUser && isSupabaseUnavailable(error) && (await outboxSize(currentUser.id)) > 0) {
          setCloudNotice(OFFLINE_QUEUED_MESSAGE);
        } else {
          reportCloudError(error);
        }
      }
    };

    loadInitialData();

    // Subscribe to auth changes
    const { data: { subscription } } = AuthService.subscribeToAuthChanges((user, event) => {
      setUser(user);
      // Arrived from a password reset email: ask for the new password
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMessage(undefined);
        setAuthMode('updatePassword');
        setShowAuthModal(true);
      }
    });

    // Set up online/offline listeners
    // Back online: send changes queued while offline, then refresh
    const handleOnline = () => {
      setIsOnline(true);
      const signedIn = userRef.current;
      if (signedIn) {
        syncWithServerRef.current(signedIn.id).catch(error => {
          console.error('Sync after reconnecting failed:', error);
          reportCloudError(error);
        });
      }
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAddNewTask = () => {
    setSelectedTask(null);
    revealTaskForm();
  };

  const handleAddSubtask = async (parentId: string) => {
    const parentTask = tasks.find(t => t.id === parentId);
    if (!parentTask) return;

    
    // Show the parent's subtasks, so the new one appears once it's added
    setSubtasksExpanded(parentId, true);

    // Clear selected task and set the parent ID for the new subtask
    setSelectedTask(null);
    setNewSubtaskParentId(parentId);
    revealTaskForm();
  };

  // subtaskParentId defaults to the task whose "Add subtask" was clicked; the
  // command palette passes null so its tasks are always top level.
  const handleTaskSubmit = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
    subtaskParentId: string | null = newSubtaskParentId
  ) => {
    const now = new Date();

    // If this is a subtask, find the parent task to inherit its status
    let status = taskData.status;
    if (subtaskParentId || taskData.parentId) {
      const parentId = subtaskParentId || taskData.parentId;
      const parentTask = findTaskById(tasks, parentId!);
      if (parentTask) {
        // Inherit parent's status unless explicitly set otherwise
        status = taskData.status === 'To Do' ? parentTask.status : taskData.status;
      }
    }
    
    const newTask: Task = {
      ...taskData,
      status,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      // If subtaskParentId exists, this is a subtask
      parentId: subtaskParentId || taskData.parentId,
      isSubtask: !!(subtaskParentId || taskData.parentId),
      subtasks: []
    };

    try {
      // Save the task to Supabase (does nothing for guests). Offline, it's
      // queued instead and still added below.
      const userId = user?.id;
      try {
        await SupabaseTaskService.saveTask(newTask);
      } catch (error) {
        if (!(await queueIfOffline(error, userId, { type: 'add', task: newTask }))) throw error;
      }

      // Start from the latest list, not the `tasks` this call began with: a
      // second task added while the save above was in flight would otherwise
      // be built on the same old list and wipe out the first one
      const latestTasks = tasksRef.current;
      let updatedTasks: Task[];
      if (subtaskParentId || taskData.parentId) {
        // This is a subtask - add it to the parent's subtasks array
        const parentId = subtaskParentId || taskData.parentId;
        updatedTasks = latestTasks.map(task => {
          if (task.id === parentId) {
            return {
              ...task,
              subtasks: [...(task.subtasks || []), newTask]
            };
          }
          return task;
        });
      } else {
        // This is a main task
        updatedTasks = [...latestTasks, newTask];
      }
      // Update the ref now too, so the next add sees this task before React re-renders
      tasksRef.current = updatedTasks;
      setTasks(updatedTasks);

      // Keep the list on this device too (guests' only copy; signed-in users'
      // offline copy). Without this a guest's new task vanished on reload.
      await saveOnDevice(updatedTasks, userId);
      announceChange();
    } catch (error) {
      console.error('Error saving task:', error);
      // Handle the error (e.g., show a notification)
    }
    
      setSelectedTask(null);
    setNewSubtaskParentId(null); // Reset the parent ID
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Find the task to check if it's a subtask
      const taskToUpdate = findTaskById(tasks, taskId);
      if (!taskToUpdate) {
        console.error('Task not found:', taskId);
        return;
      }
      
      // The task list after this update, including any status cascade
      let nextTasks: Task[];

      // Always update the UI immediately for any status change
      if (updates.status && taskToUpdate.status !== updates.status) {
        
        // Create an optimistic update for the UI
        const updatedTasks = tasks.map(t => {
          // If this is the task being updated directly
          if (t.id === taskId) {
            // If this is a parent task being completed, also update its subtasks
            if (updates.status === 'Completed' && t.subtasks && t.subtasks.length > 0) {
              return {
                ...t,
                ...updates,
                updatedAt: new Date(),
                subtasks: t.subtasks.map(subtask => ({
                  ...subtask,
                  status: 'Completed' as TaskStatus,
                  updatedAt: new Date()
                }))
              };
            }
            
            // Regular task update
            return { ...t, ...updates, updatedAt: new Date() };
          }
          
          // If this task has subtasks, check if any of them match the taskId
          if (t.subtasks && t.subtasks.length > 0) {
            const hasUpdatedSubtask = t.subtasks.some(subtask => subtask.id === taskId);
            
            if (hasUpdatedSubtask) {
              const updatedSubtasks = t.subtasks.map(subtask => {
                if (subtask.id === taskId) {
                  // This is the subtask being updated
                  return { ...subtask, ...updates, updatedAt: new Date() };
                }
                return subtask;
              });
              
              // If a subtask is being changed to "In Progress" or "Completed" and the parent is in "To Do",
              // automatically move the parent to "In Progress"
              if (
                taskToUpdate.isSubtask && 
                (updates.status === 'In Progress' || updates.status === 'Completed') && 
                t.status === 'To Do'
              ) {
                return { 
                  ...t, 
                  status: 'In Progress' as TaskStatus, 
                  subtasks: updatedSubtasks,
                  updatedAt: new Date()
                };
              }
              
              // Regular subtask update (without changing parent)
              return { ...t, subtasks: updatedSubtasks, updatedAt: new Date() };
            }
          }
          
          return t;
        });
        
        // Update UI immediately
        setTasks(updatedTasks);
        nextTasks = updatedTasks;
      } else {
        nextTasks = withTaskUpdated(tasks, taskId, { ...updates, updatedAt: new Date() });
        // Straight away too, so a dragged task doesn't jump back while it saves
        setTasks(nextTasks);
      }

      // For the actual async update, we need to get the complete task with the updates
      const completeTaskWithUpdates = {
        ...taskToUpdate,
        ...updates,
        updatedAt: new Date()
      };
      
      // If user is logged in, update in Supabase: the edited task plus any
      // knock-on status changes (subtasks completed with their parent, a parent
      // moved to In Progress), which previously never reached the server.
      // Offline, each change is queued to be sent later.
      const userId = user?.id;
      if (userId) {
        const changedTasks = [completeTaskWithUpdates, ...cascadedStatusChanges(tasks, nextTasks, taskId)];
        for (const changed of changedTasks) {
          try {
            const success = await SupabaseTaskService.updateTask(changed.id, changed);
            if (!success) console.error('Failed to update task in Supabase');
          } catch (error) {
            if (!(await queueIfOffline(error, userId, { type: 'update', task: changed }))) {
              console.error('Error updating task in Supabase:', error);
            }
          }
        }
      }
      // Save the whole updated list on this device (subtasks are nested in
      // their parent): the guest's only copy, or the signed-in offline copy
      await saveOnDevice(nextTasks, userId);
      announceChange();

      // Keep the open form in step with changes made elsewhere (e.g. dragging the
      // selected task to another day), so saving it doesn't restore stale values.
      setSelectedTask(current =>
        current?.id === taskId ? { ...current, ...updates } : current
      );

    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // A task dragged (or moved with the keyboard) to a new place in its section
  // or column, possibly into another column (status). Usually only that task
  // changes; `others` are neighbours spaced out again when there was no room.
  const handleTaskReorder = async (
    taskId: string,
    position: number,
    status?: TaskStatus,
    others: TaskPosition[] = []
  ) => {
    await handleTaskUpdate(taskId, status ? { status, position } : { position });
    if (others.length > 0) await saveTaskPositions(others);
  };

  // Several new positions at once, from the latest task list
  const saveTaskPositions = async (positions: TaskPosition[]) => {
    const byId = new Map(positions.map(item => [item.id, item.position]));
    const nextTasks = tasksRef.current.map(task =>
      byId.has(task.id) ? { ...task, position: byId.get(task.id), updatedAt: new Date() } : task
    );
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    const userId = user?.id;
    if (userId) {
      for (const task of nextTasks.filter(item => byId.has(item.id))) {
        try {
          await SupabaseTaskService.updateTask(task.id, { position: task.position });
        } catch (error) {
          if (!(await queueIfOffline(error, userId, { type: 'update', task }))) {
            console.error('Error saving task order:', error);
          }
        }
      }
    }
    await saveOnDevice(nextTasks, userId);
    announceChange();
  };

  // Helper function to find a task by ID (including in subtasks)
  const findTaskById = (taskList: Task[], id: string): Task | undefined => {
    for (const task of taskList) {
      if (task.id === id) {
        return task;
      }
      if (task.subtasks && task.subtasks.length > 0) {
        const found = findTaskById(task.subtasks, id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };

  // The task the focus timer is running for, if it still exists
  const focusTask = focus.session ? findTaskById(tasks, focus.session.taskId) : undefined;
  const renameFocus = focus.rename;
  useEffect(() => {
    if (focusTask) renameFocus(focusTask.title);
  }, [focusTask, renameFocus]);

  const startFocus = (task: Task, minutes: number) => focus.start(task.id, task.title, minutes);

  const completeFocusTask = () => {
    if (focusTask && focusTask.status !== 'Completed') handleTaskUpdate(focusTask.id, { status: 'Completed' });
    focus.stop();
  };

  // Remove the task from the screen straight away, but only save the delete
  // once the undo window has passed.
  const handleTaskDelete = (taskId: string) => {
    const taskToDelete = findTaskById(tasks, taskId);
    if (!taskToDelete) {
      console.error('Task not found:', taskId);
      return;
    }

    // Only one delete can be undone at a time, so save any earlier one first
    commitPendingDelete();

    // No point timing a task that's gone (or a subtask of one)
    const focusedId = focus.session?.taskId;
    if (focusedId && (focusedId === taskId || taskToDelete.subtasks?.some(subtask => subtask.id === focusedId))) {
      focus.stop();
    }

    const parent = tasks.find(task => task.subtasks?.some(subtask => subtask.id === taskId));
    const index = parent
      ? parent.subtasks!.findIndex(subtask => subtask.id === taskId)
      : tasks.findIndex(task => task.id === taskId);

    // Whoever is signed in now, even if the delete is only sent after the undo window
    const deletingUserId = user?.id;
    const pending: PendingDelete = {
      task: taskToDelete,
      parentId: parent?.id,
      index,
      // Signed-in deletes go to Supabase (subtasks cascade), or the outbox when
      // offline. Either way the list as it is by then is saved on this device.
      commit: async () => {
        if (deletingUserId) {
          try {
            await SupabaseTaskService.deleteTask(taskId);
          } catch (error) {
            if (!(await queueIfOffline(error, deletingUserId, { type: 'delete', taskId }))) throw error;
          }
        }
        await saveOnDevice(tasksRef.current, deletingUserId);
        announceChange();
      }
    };

    pendingDeleteRef.current = pending;
    setPendingDelete(pending);
    undoTimerRef.current = window.setTimeout(commitPendingDelete, UNDO_WINDOW_MS);

    setTasks(withoutTask(tasks, taskId));
    setSelectedTask(null);
  };

  const handleUndoDelete = () => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    window.clearTimeout(undoTimerRef.current);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    setTasks(current => withTaskRestored(current, pending));
  };

  const describeDelete = ({ task }: PendingDelete) => {
    const subtaskCount = task.subtasks?.length ?? 0;
    const label = task.isSubtask ? 'subtask' : 'task';
    const extra = subtaskCount > 0 ? ` and ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}` : '';
    return `Deleted ${label} “${task.title}”${extra}`;
  };

  const handleSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      // Send anything queued offline, then load the latest from Supabase
      await syncWithServer(user.id);
    } catch (error) {
      console.error('Sync failed:', error);
      reportCloudError(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAuthStateChange = async (isLoggedIn: boolean) => {
    setShowAuthModal(false);
    if (!isLoggedIn) {
      setTasks([]);
      setSelectedTask(null);
    } else {
      try {
        // Send anything this account left queued on this device while offline
        const signedInUser = await AuthService.getCurrentUser();
        if (signedInUser) await flushOutbox(signedInUser.id);

        // First, get the local tasks that need to be migrated
        const localTasks = await loadTasks();
        
        // Then fetch existing tasks from Supabase
        const supabaseTasks = await SupabaseTaskService.getTasks();
        
        // If there are local tasks and user just logged in, handle migration
        if (localTasks.length > 0) {
          
          // Filter out preset tasks that shouldn't be migrated
          const tasksToMigrate = localTasks.filter(localTask => {
            // Check if a similar task already exists in Supabase
            const hasExistingTask = supabaseTasks.some(supabaseTask =>
              supabaseTask.title === localTask.title &&
              supabaseTask.description === localTask.description &&
              supabaseTask.status === localTask.status
            );

            // Migrate everything except welcome tasks left as they were
            // (current or earlier wording) and tasks the account already has
            return !isUntouchedPresetTask(localTask) && !hasExistingTask;
          });

          if (tasksToMigrate.length > 0) {
            
            // Save each filtered task to Supabase
            const migrationPromises = tasksToMigrate.map(async (task) => {
              // Generate a new ID for the task to avoid conflicts
              const newTaskId = crypto.randomUUID();
              const newTask = {
                ...task,
                id: newTaskId,
                subtasks: task.subtasks?.map(subtask => ({
                  ...subtask,
                  id: crypto.randomUUID(),
                  parentId: newTaskId
                })) || []
              };
              
              return SupabaseTaskService.saveTask(newTask);
            });
            
            // Wait for all tasks to be migrated
            await Promise.all(migrationPromises);
          }
          
          // Clear local storage after handling migration
          await offlineStorage.saveTasks([]);
          
          // Fetch the final updated task list from Supabase
          const updatedTasks = await SupabaseTaskService.getTasks();
          setTasks(updatedTasks);
          if (signedInUser) await saveOnDevice(updatedTasks, signedInUser.id);

        } else {
          // If no local tasks, just use the Supabase tasks
          setTasks(supabaseTasks);
          if (signedInUser) await saveOnDevice(supabaseTasks, signedInUser.id);
        }
      } catch (error) {
        console.error('Error during task migration:', error);
        reportCloudError(error);
        // In case of error, fall back to local tasks
        const localTasks = await loadTasks();
        setTasks(localTasks);
      }
    }
  };

  const handleSignOut = async () => {
    // Save a pending delete while still signed in, or it would be lost
    commitPendingDelete();
    // Try to send anything queued offline. Once nothing is left waiting, remove
    // this account's offline copy so the next person on this device can't see it;
    // unsent changes (and their copy) stay until this user signs in again.
    const signedOutUser = user;
    if (signedOutUser) {
      try {
        const { remaining } = await flushOutbox(signedOutUser.id);
        if (remaining === 0) await offlineStorage.clearAccountTasks(signedOutUser.id);
      } catch (error) {
        console.error('Sync before signing out failed:', error);
      }
    }
    await AuthService.signOut();
    const localTasks = await loadTasks();
    setTasks(localTasks);
  };

  const openDeleteAccount = () => {
    if (user) setDeleteAccount({ email: user.email ?? 'your account', state: { status: 'confirm' } });
  };

  const handleDeleteAccount = async () => {
    const account = user;
    if (!account) return;
    setDeleteAccount(current => current && { ...current, state: { status: 'deleting' } });
    // Send a delete still inside its undo window now, rather than after the account is gone
    commitPendingDelete();
    try {
      await AuthService.deleteAccount();
    } catch (error) {
      console.error('Deleting the account failed:', error);
      setDeleteAccount(current => current && { ...current, state: { status: 'confirm', error: friendlyDeleteAccountError(error) } });
      return;
    }
    // Nothing of the account stays on this device either: its offline copy and
    // any changes still waiting to be sent
    try {
      await offlineStorage.clearAccountTasks(account.id);
      await discardOutbox(account.id);
    } catch (error) {
      console.error('Clearing the deleted account from this device failed:', error);
    }
    setSelectedTask(null);
    setTasks(await loadTasks());
    setDeleteAccount(current => current && { ...current, state: { status: 'done' } });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTask(null); // Clear selected task when selecting a new date
    revealTaskForm();
  };

  // Open a task from the command palette and bring its row or card into view
  const jumpToTask = (task: Task) => {
    // A subtask is hidden until its parent is opened
    const parent = tasks.find(t => t.subtasks?.some(subtask => subtask.id === task.id));
    if (parent) setSubtasksExpanded(parent.id, true);
    handleTaskSelect(task);
    // On narrow screens revealTaskForm already scrolls to the form instead
    if (window.matchMedia(STACKED_LAYOUT_QUERY).matches) return;
    requestAnimationFrame(() => {
      document.querySelector(`[data-task-id="${task.id}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  };

  const openAuth = (message?: string) => {
    setAuthMessage(message);
    setAuthMode('signIn');
    setShowAuthModal(true);
  };

  const closeAuth = () => {
    setShowAuthModal(false);
    setAuthMessage(undefined);
  };

  // Import and export are account features: guests are asked to sign in first
  const handleImportClick = () => {
    if (!user) {
      openAuth('Sign in to import tasks from Todoist or a CSV file into your account.');
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so choosing the same file again still fires a change
    event.target.value = '';
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setImportState({ status: 'error', fileName: file.name, message: 'That file is over 5 MB. Export a single project or list and try again.' });
      return;
    }
    try {
      const result = parseImportFile(await file.text());
      setImportState({ status: 'preview', fileName: file.name, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The file couldn’t be read.';
      setImportState({ status: 'error', fileName: file.name, message });
    }
  };

  const handleImportConfirm = async () => {
    if (importState?.status !== 'preview') return;
    const { fileName, result } = importState;
    setImportState({ status: 'saving', fileName, result });
    try {
      await SupabaseTaskService.saveTasks(result.tasks);
      setTasks(current => [...current, ...result.tasks]);
      setImportState({ status: 'done', fileName, result });
      announceChange();
    } catch (error) {
      console.error('Import failed:', error);
      reportCloudError(error);
      const savedCount = (error as { savedCount?: number }).savedCount ?? 0;
      const reason = (error instanceof Error && error.message ? error.message : 'Something went wrong').replace(/\.$/, '');
      const message = isSupabaseUnavailable(error)
        ? CLOUD_ASLEEP_MESSAGE
        : savedCount > 0
          ? `${reason}. ${savedCount} of ${result.taskCount} tasks were saved first; sync to see them before trying again.`
          : `${reason}. Nothing was imported.`;
      setImportState({ status: 'error', fileName, message, result });
    }
  };

  const handleExport = () => {
    if (!user) {
      openAuth('Sign in to export your tasks as a Markdown file.');
      return;
    }
    const blob = new Blob([toMarkdown(tasks)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  const paletteItems: PaletteItem[] = [
    {
      id: 'new-task',
      group: 'Actions',
      label: 'New task',
      keywords: 'add create',
      run: () => {
        setNewSubtaskParentId(null);
        handleAddNewTask();
        requestAnimationFrame(() => taskFormRef.current?.querySelector('input')?.focus());
      }
    },
    ...(Object.keys(VIEW_LABELS) as ViewType[]).map(view => ({
      id: `view-${view}`,
      group: 'Actions' as const,
      label: `Switch to ${VIEW_LABELS[view]}`,
      hint: view === viewType ? 'Current' : 'View',
      keywords: VIEW_KEYWORDS[view],
      run: () => setViewType(view)
    })),
    ...(selectedTask && selectedTask.status !== 'Completed' && focus.session?.taskId !== selectedTask.id
      ? [{
          id: 'focus-start',
          group: 'Actions' as const,
          label: `Focus on “${selectedTask.title}” for 25 minutes`,
          hint: 'Timer',
          keywords: 'focus timer pomodoro countdown concentrate',
          run: () => startFocus(selectedTask, 25)
        }]
      : []),
    ...(focus.session
      ? [{
          id: 'focus-stop',
          group: 'Actions' as const,
          label: 'Stop focus timer',
          hint: 'Timer',
          keywords: 'focus timer pomodoro cancel end',
          run: focus.stop
        }]
      : []),
    {
      id: 'toggle-theme',
      group: 'Actions',
      label: isDarkMode ? 'Switch to light theme' : 'Switch to dark theme',
      hint: 'Theme',
      keywords: 'theme mode dark light colour color',
      run: toggleTheme
    },
    user
      ? { id: 'sign-out', group: 'Actions', label: 'Sign out', keywords: 'log out account', run: handleSignOut }
      : {
          id: 'sign-in',
          group: 'Actions',
          label: 'Sign in to sync your tasks',
          keywords: 'log in account cloud sync sign up',
          run: () => openAuth()
        },
    {
      id: 'import',
      group: 'Actions',
      label: 'Import tasks from Todoist or CSV',
      hint: user ? undefined : 'Sign in',
      keywords: 'upload file todoist csv spreadsheet',
      run: handleImportClick
    },
    {
      id: 'export',
      group: 'Actions',
      label: 'Export tasks to Markdown',
      hint: user ? undefined : 'Sign in',
      keywords: 'download backup save file markdown md',
      run: handleExport
    },
    // Every task and subtask, so the palette doubles as search
    ...tasks
      .filter(task => !task.isSubtask)
      .flatMap(task => [task, ...(task.subtasks || [])])
      .map(task => ({
        id: `task-${task.id}`,
        group: 'Tasks' as const,
        label: task.title,
        hint: task.isSubtask ? `Subtask · ${task.status}` : task.status,
        keywords: task.description,
        run: () => jumpToTask(task)
      }))
  ];

  // Tasks created from the palette are always top level and start in To Do
  // A date in the text ("pay rent fri") becomes the due date, as in the task form
  const createTaskFromPalette = (text: string) => {
    const quickAdd = parseQuickAdd(text);
    handleTaskSubmit(
      {
        title: quickAdd?.title ?? text,
        description: quickAdd?.timeText ? `Time: ${quickAdd.timeText}` : '',
        status: 'To Do',
        dueDate: quickAdd?.dueDate
      },
      null
    );
  };

  const previewPaletteCreate = (text: string) => {
    const quickAdd = parseQuickAdd(text);
    return quickAdd
      ? { title: quickAdd.title, hint: `Due ${describeDueDate(quickAdd.dueDate)}` }
      : { title: text };
  };

  return (
    <MantineProvider>
      <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
        <header className="app-header">
          <div className="header">
            <img src="/Logo.png" alt="" />
            <h1>Taskr</h1>
          </div>
          <div className="header-controls">
            <button
              type="button"
              className="palette-trigger"
              onClick={() => setShowPalette(true)}
              aria-label="Search and commands"
              aria-keyshortcuts={IS_APPLE ? 'Meta+K' : 'Control+K'}
              title={`Search and commands (${IS_APPLE ? '⌘' : 'Ctrl'}+K)`}
            >
              <svg className="palette-trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <span className="palette-trigger-label" aria-hidden="true">Search…</span>
              <kbd className="palette-trigger-keys">{IS_APPLE ? '⌘' : 'Ctrl'} K</kbd>
            </button>
              <SyncIndicator
              isOnline={isOnline}
              isSyncing={isSyncing}
                onSync={handleSync}
              />
            <ThemeToggle
              isDark={isDarkMode}
              onToggle={toggleTheme}
            />
            {user ? (
              <AccountMenu
                email={user.email ?? 'your account'}
                onImport={handleImportClick}
                onExport={handleExport}
                onSignOut={handleSignOut}
                onDeleteAccount={openDeleteAccount}
              />
            ) : (
              <button
                onClick={() => openAuth()}
                className="sign-in-btn"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {cloudNotice && (
          <div className="cloud-notice" role="status">
            <span>{cloudNotice}</span>
            <button
              type="button"
              className="cloud-notice-dismiss"
              onClick={() => setCloudNotice(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Opened by "Import tasks" in the account menu or command palette */}
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          hidden
          onChange={handleImportFile}
        />

        <div className="view-selector-container">
          <ViewSwitcher value={viewType} onChange={setViewType} />
        </div>

        <div className={`main-content ${
          viewType === 'kanban' ? 'kanban-layout' : 
          viewType === 'calendar' ? 'calendar-layout' : ''
        }`}>
          {viewType === 'normal' && (
            <>
              <div className="tasks-column">
                <div className="tasks-header">
                  <button className="add-task-button" onClick={handleAddNewTask}>
                    <span>+</span> Add new task
                  </button>
                </div>
                
                {/* To Do Section */}
                <div className="task-section">
                  <h2>To Do</h2>
                  <TaskList 
                    tasks={tasks.filter(task => task.status === 'To Do')}
                    onTaskSelect={handleTaskSelect}
                    onTaskToggle={(taskId) => {
                      const task = findTaskById(tasks, taskId);
                      if (task) {
                        // Optimistic UI update - immediately update the local state
                        const updatedTasks = tasks.map(t => {
                          // Direct match for the task being toggled
                          if (t.id === taskId) {
                            // If this is a parent task being completed, also update its subtasks
                            if (t.subtasks && t.subtasks.length > 0) {
                              return {
                                ...t,
                                status: 'Completed' as TaskStatus,
                                subtasks: t.subtasks.map(subtask => ({
                                  ...subtask,
                                  status: 'Completed' as TaskStatus
                                }))
                              };
                            }
                            
                            // Regular task update
                            return { ...t, status: 'Completed' as TaskStatus };
                          }
                          
                          // If this is a parent task that contains the subtask being toggled
                          if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
                            // If a subtask is being completed and the parent is in "To Do",
                            // move the parent to "In Progress"
                            return {
                              ...t,
                              status: 'In Progress' as TaskStatus,
                              subtasks: t.subtasks.map(subtask => 
                                subtask.id === taskId 
                                  ? { ...subtask, status: 'Completed' as TaskStatus }
                                  : subtask
                              )
                            };
                          }
                          
                          return t;
                        });
                        
                        // Update the UI immediately
                        setTasks(updatedTasks);
                        
                        // Then update the backend
                        setTimeout(() => {
                          handleTaskUpdate(taskId, { status: 'Completed' });
                        }, 0);
                      }
                    }}
                    onAddSubtask={handleAddSubtask}
                    onReorder={handleTaskReorder}
                    selectedTaskId={selectedTask?.id}
                  />
                </div>

                {/* In Progress Section */}
                <div className="task-section in-progress-section">
                  <h2>In Progress</h2>
                  <TaskList
                    tasks={tasks.filter(task => task.status === 'In Progress')}
                    onTaskSelect={handleTaskSelect}
                    onTaskToggle={(taskId) => {
                      const task = findTaskById(tasks, taskId);
                      if (task) {
                        // Optimistic UI update - immediately update the local state
                        const updatedTasks = tasks.map(t => {
                          // Direct match for the task being toggled
                          if (t.id === taskId) {
                            // If this is a parent task being completed, also update its subtasks
                            if (t.subtasks && t.subtasks.length > 0) {
                              return {
                                ...t,
                                status: 'Completed' as TaskStatus,
                                subtasks: t.subtasks.map(subtask => ({
                                  ...subtask,
                                  status: 'Completed' as TaskStatus
                                }))
                              };
                            }
                            
                            // Regular task update
                            return { ...t, status: 'Completed' as TaskStatus };
                          }
                          
                          // If this is a parent task that contains the subtask being toggled
                          if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
                            return {
                              ...t,
                              subtasks: t.subtasks.map(subtask => 
                                subtask.id === taskId 
                                  ? { ...subtask, status: 'Completed' as TaskStatus }
                                  : subtask
                              )
                            };
                          }
                          
                          return t;
                        });
                        
                        // Update the UI immediately
                        setTasks(updatedTasks);
                        
                        // Then update the backend
                        setTimeout(() => {
                          handleTaskUpdate(taskId, { status: 'Completed' });
                        }, 0);
                      }
                    }}
                    onAddSubtask={handleAddSubtask}
                    onReorder={handleTaskReorder}
                    selectedTaskId={selectedTask?.id}
                  />
                </div>

                {/* Completed Section */}
                <div className="task-section completed-section">
                  <h2>Completed</h2>
                  <TaskList 
                    tasks={tasks.filter(task => task.status === 'Completed')}
                    onTaskSelect={handleTaskSelect}
                    onTaskToggle={(taskId) => {
                      const task = findTaskById(tasks, taskId);
                      if (task) {
                        // Optimistic UI update - immediately update the local state
                        const updatedTasks = tasks.map(t => {
                          // Direct match for the task being toggled
                          if (t.id === taskId) {
                            // If this is a parent task being uncompleted, don't change subtasks
                            return { ...t, status: 'To Do' as TaskStatus };
                          }
                          
                          // If this is a parent task that contains the subtask being toggled
                          if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
                            return {
                              ...t,
                              subtasks: t.subtasks.map(subtask => 
                                subtask.id === taskId 
                                  ? { ...subtask, status: 'To Do' as TaskStatus }
                                  : subtask
                              )
                            };
                          }
                          
                          return t;
                        });
                        
                        // Update the UI immediately
                        setTasks(updatedTasks);
                        
                        // Then update the backend
                        setTimeout(() => {
                          handleTaskUpdate(taskId, { status: 'To Do' });
                        }, 0);
                      }
                    }}
                    onAddSubtask={handleAddSubtask}
                    onReorder={handleTaskReorder}
                    selectedTaskId={selectedTask?.id}
                  />
                </div>
              </div>

              <div className="task-detail-column" ref={taskFormRef}>
                <TaskForm
                  selectedTask={selectedTask}
                  focusTaskId={focus.session?.taskId}
                  onStartFocus={startFocus}
                  onSubmit={handleTaskSubmit}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                  parentId={newSubtaskParentId}
                />
              </div>
            </>
          )}
          {viewType === 'kanban' && (
            <>
              <KanbanView
                tasks={tasks}
                onTaskSelect={handleTaskSelect}
                onTaskUpdate={handleTaskUpdate}
                onReorder={handleTaskReorder}
                selectedTaskId={selectedTask?.id}
              />
              <div className="task-detail-column" ref={taskFormRef}>
                <TaskForm
                  selectedTask={selectedTask}
                  focusTaskId={focus.session?.taskId}
                  onStartFocus={startFocus}
                  onSubmit={handleTaskSubmit}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                  parentId={newSubtaskParentId}
                />
              </div>
            </>
          )}
          {viewType === 'calendar' && (
            <>
              <CalendarView
                tasks={tasks}
                onTaskSelect={handleTaskSelect}
                onTaskUpdate={handleTaskUpdate}
                selectedTaskId={selectedTask?.id}
                onDateSelect={handleDateSelect}
                layout={calendarLayout}
                onLayoutChange={setCalendarLayout}
              />
              <div className="task-detail-column" ref={taskFormRef}>
                <TaskForm
                  selectedTask={selectedTask}
                  focusTaskId={focus.session?.taskId}
                  onStartFocus={startFocus}
                  onSubmit={handleTaskSubmit}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                  initialDueDate={selectedDate}
                  parentId={newSubtaskParentId}
                />
              </div>
            </>
          )}
        </div>

        {showAuthModal && (
          <Auth
            onAuthStateChange={handleAuthStateChange}
            onClose={closeAuth}
            message={authMessage}
            initialMode={authMode}
            guestTaskCount={user ? 0 : tasks.filter(task => !task.isSubtask && !isUntouchedPresetTask(task)).length}
          />
        )}
        <p className="footer-text">
            Taskr by{' '}
            <a
              href="https://anishkapse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-200 hover:text-[#da4167] underline-offset-2 hover:underline"
            >
              Anish Kapse
            </a>
            <span aria-hidden="true"> · </span>
            <a
              href="/how-its-built.html"
              className="transition-colors duration-200 hover:text-[#da4167] underline-offset-2 hover:underline"
            >
              How it’s built
            </a>
          </p>
        {importState && (
          <ImportDialog
            state={importState}
            onConfirm={handleImportConfirm}
            onClose={() => setImportState(null)}
          />
        )}
        {deleteAccount && (
          <DeleteAccountDialog
            email={deleteAccount.email}
            taskCount={tasks.filter(task => !task.isSubtask).length}
            isOnline={isOnline}
            state={deleteAccount.state}
            onExport={handleExport}
            onConfirm={handleDeleteAccount}
            onClose={() => setDeleteAccount(null)}
          />
        )}
        {showPalette && (
          <CommandPalette
            items={paletteItems}
            onCreateTask={createTaskFromPalette}
            previewCreate={previewPaletteCreate}
            onClose={() => setShowPalette(false)}
          />
        )}
        {/* Before the undo bar, which stacks above it (see .focus-bar ~ .undo-toast) */}
        {focus.session && focus.phase && (
          <FocusTimer
            session={focus.session}
            phase={focus.phase}
            remainingMs={focus.remainingMs}
            canComplete={!!focusTask && focusTask.status !== 'Completed'}
            onPause={focus.pause}
            onResume={focus.resume}
            onStop={focus.stop}
            onExtend={focus.extend}
            onComplete={completeFocusTask}
            onShowTask={() => focusTask && jumpToTask(focusTask)}
          />
        )}
        {pendingDelete && (
          <UndoToast
            key={pendingDelete.task.id}
            message={describeDelete(pendingDelete)}
            durationMs={UNDO_WINDOW_MS}
            onUndo={handleUndoDelete}
            onDismiss={commitPendingDelete}
          />
        )}
      </div>
    </MantineProvider>
  );
}

export default App;