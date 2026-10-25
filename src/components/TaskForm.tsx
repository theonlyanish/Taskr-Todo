import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus } from '../types/Task';
import { describeDueDate, parseQuickAdd, useQuickAdd } from '../utils/quickAdd';
import { FOCUS_LENGTHS } from '../utils/focusTimer';
import { DEFAULT_LIST_ID, TaskList, listOf, storedListId } from '../utils/taskLists';

// Define the interface for TaskFormProps
export interface TaskFormProps {
  selectedTask: Task | null;
  onSubmit: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  initialDueDate?: Date | null;
  parentId?: string | null;
  // The task the focus timer is running for, if any
  focusTaskId?: string | null;
  onStartFocus?: (task: Task, minutes: number) => void;
  // Templates: save this task as one, or open the picker to start from one
  onSaveTemplate?: (task: Task) => Promise<'saved' | 'exists'>;
  onOpenTemplates?: () => void;
  // The user's lists, and the one showing (where new tasks go by default)
  lists?: TaskList[];
  currentListId?: string;
  // Closes the task being edited (or the new subtask), back to adding a task
  onClose?: () => void;
}

// Whether "Add details" was left open, remembered on this device
const DETAILS_KEY = 'addDetailsOpen';
const detailsWereOpen = () => {
  try {
    return localStorage.getItem(DETAILS_KEY) === '1';
  } catch {
    return false;
  }
};

export const TaskForm: React.FC<TaskFormProps> = ({
  selectedTask,
  onSubmit,
  onUpdate,
  onDelete,
  initialDueDate,
  parentId,
  focusTaskId,
  onStartFocus,
  onSaveTemplate,
  onOpenTemplates,
  lists = [],
  currentListId = DEFAULT_LIST_ID,
  onClose
}) => {
  // Adding a task: a title line, with the other fields behind "Add details".
  // Editing one shows every field.
  const [detailsOpen, setDetailsOpen] = useState(detailsWereOpen);
  const toggleDetails = () => {
    setDetailsOpen(open => {
      try {
        localStorage.setItem(DETAILS_KEY, open ? '0' : '1');
      } catch {
        // Not remembered; applies for this visit
      }
      return !open;
    });
  };
  const isEditing = !!selectedTask;
  const showDetails = isEditing || detailsOpen;
  // "Saved as a template" after saving, until another task is opened
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  useEffect(() => setTemplateNotice(null), [selectedTask?.id]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [dueDate, setDueDate] = useState<string>('');
  // Which list the task goes in; only asked once there's more than one, and
  // only for top-level tasks (subtasks follow their parent)
  const [listId, setListId] = useState(currentListId);
  const isSubtaskForm = !!parentId || !!selectedTask?.isSubtask;
  const showListField = lists.length > 1 && !isSubtaskForm;
  const titleInputRef = useRef<HTMLInputElement>(null);
  const quickAddReady = useQuickAdd();
  // A date phrase the user chose to keep as plain text ("Keep as text")
  const [keptAsText, setKeptAsText] = useState<string | null>(null);

  // New tasks only: read a date out of the title ("pay rent fri") unless a due
  // date has been picked by hand. Existing titles are never rewritten.
  const quickAddMatch = quickAddReady && !selectedTask && !dueDate ? parseQuickAdd(title) : null;
  const quickAdd = quickAddMatch && quickAddMatch.matchedText !== keptAsText ? quickAddMatch : null;

  // Focus the input when the component mounts. preventScroll keeps phones,
  // where the form sits below the task list, from jumping past the tasks.
  useEffect(() => {
    titleInputRef.current?.focus({ preventScroll: true });
  }, []);

  // useEffect hook to populate form fields with selectedTask data
  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title);
      setDescription(selectedTask.description || '');
      setStatus(selectedTask.status);
      setDueDate(selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : '');
      setListId(listOf(selectedTask, new Set(lists.map(list => list.id))));
    } else {
      setTitle('');
      setDescription('');
      setStatus('To Do');
      setDueDate(initialDueDate ? new Date(initialDueDate).toISOString().split('T')[0] : '');
      setListId(currentListId);
      // Focus the title input when creating a new task
      titleInputRef.current?.focus({ preventScroll: true });
    }
    // Lists only matter for which one is picked; a new list doesn't reset the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask, initialDueDate, currentListId]);

  // Function to handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = {
      title,
      description,
      status,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      parentId: parentId || undefined,
      ...(showListField ? { listId: storedListId(listId) } : {})
    };

    // Use the date read from the title; Taskr has no due times, so keep any
    // time in the description rather than dropping it
    if (quickAdd) {
      formData.title = quickAdd.title;
      formData.dueDate = quickAdd.dueDate;
      if (quickAdd.timeText) {
        formData.description = [description, `Time: ${quickAdd.timeText}`].filter(Boolean).join('\n');
      }
    }

    if (selectedTask && selectedTask.id && onUpdate) {
      // If we have a selected task with a valid ID, use onUpdate
      onUpdate(selectedTask.id, formData);
    } else {
      // If no selected task or empty ID, use onSubmit for new task
      onSubmit(formData);
    }
    
    // Clear form if no task was selected
    if (!selectedTask) {
      setTitle('');
      setDescription('');
      setStatus('To Do');
      setDueDate('');
      setKeptAsText(null);
    }
  };

  // Generate a unique key for the form to force re-render when switching between new task and edit mode
  const formKey = selectedTask ? `edit-${selectedTask.id}` : parentId ? `new-subtask-${parentId}` : 'new-task';

  // Determine the form title based on whether we're creating a subtask or editing a task
  const formTitle = parentId ? 'Add subtask' : selectedTask?.id ? 'Edit task' : 'Add task';

  // JSX for the form
  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      className={`task-form ${isEditing ? '' : 'task-form-compact'}`}
      // Esc leaves the field, so the single-key shortcuts (j, k, x…) work again
      onKeyDown={event => {
        const field = event.target as HTMLElement;
        if (event.key === 'Escape' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(field.tagName)) field.blur();
      }}
    >
      <div className="task-form-header">
        <h2>{formTitle}</h2>
        {(isEditing || parentId) && onClose && (
          <button
            type="button"
            className="task-form-close"
            onClick={onClose}
            aria-label={isEditing ? 'Close task' : 'Cancel subtask'}
            title={isEditing ? 'Close' : 'Cancel'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      {selectedTask && onStartFocus && selectedTask.status !== 'Completed' && (
        <div className="focus-start" role="group" aria-label="Focus timer">
          <svg className="focus-start-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
          </svg>
          {focusTaskId === selectedTask.id ? (
            <span className="focus-start-label">Focusing on this task</span>
          ) : (
            <>
              <span className="focus-start-label">Focus</span>
              {FOCUS_LENGTHS.map(minutes => (
                <button
                  key={minutes}
                  type="button"
                  className="focus-start-btn"
                  onClick={() => onStartFocus(selectedTask, minutes)}
                  aria-label={`Focus on this task for ${minutes} minutes`}
                >
                  {minutes} min
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <div className="form-group task-title-group">
        <label htmlFor="task-title" className={isEditing ? undefined : 'sr-only'}>Title</label>
        <div className="task-title-row">
          <input
            ref={titleInputRef}
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={
              selectedTask ? 'Enter task title'
                : parentId ? 'Subtask title, e.g. “Book hotel tomorrow”'
                  : 'Task title, e.g. “Pay rent friday”'
            }
            className="form-input"
            aria-describedby={quickAdd ? 'quick-add-hint' : undefined}
          />
          {!isEditing && (
            <button type="submit" className="add-task-btn add-task-inline">
              Add
            </button>
          )}
        </div>
        {/* Always rendered so screen readers hear the date when it appears */}
        <div id="quick-add-hint" className="quick-add-hint" aria-live="polite">
          {quickAdd && (
            <>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              <span>
                Due <strong>{describeDueDate(quickAdd.dueDate)}</strong>
                {quickAdd.timeText && <> · {quickAdd.timeText} goes in the description</>}
              </span>
              <button type="button" className="quick-add-keep" onClick={() => setKeptAsText(quickAdd.matchedText)}>
                Keep “{quickAdd.matchedText}” as text
              </button>
            </>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="task-form-extras">
          <button
            type="button"
            className="task-form-extra"
            aria-expanded={detailsOpen}
            aria-controls="task-form-details"
            onClick={toggleDetails}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7" /></svg>
            {detailsOpen ? 'Fewer details' : 'Add details'}
            <svg className="task-form-extra-caret" viewBox="0 0 24 24" aria-hidden="true">
              <path d={detailsOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
            </svg>
          </button>
          {!parentId && onOpenTemplates && (
            <button type="button" className="task-form-extra" onClick={onOpenTemplates}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="3.5" width="16" height="17" rx="2" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
              From a template
            </button>
          )}
        </div>
      )}

      <div id="task-form-details" hidden={!showDetails}>
        <div className="form-group">
          <label htmlFor="task-description">Description</label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter task description (optional)"
            className="form-input description-input"
            rows={isEditing ? 4 : 3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="task-status">Status</label>
          <select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            required
            className="form-input status-select"
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {showListField && (
          <div className="form-group">
            <label htmlFor="task-list">List</label>
            <select
              id="task-list"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className="form-input"
            >
              {lists.map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="task-due-date">Due date</label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      <div className="form-actions">
        {isEditing && (
          <button type="submit" className="add-task-btn">
            Save changes
          </button>
        )}
        {selectedTask && !selectedTask.isSubtask && onSaveTemplate && (
          <button
            type="button"
            className="template-save-btn"
            onClick={async () => {
              const result = await onSaveTemplate(selectedTask);
              setTemplateNotice(result === 'saved' ? 'Saved as a template' : 'Already saved as a template');
            }}
          >
            Save as template
          </button>
        )}
        {selectedTask && onDelete && (
          <button 
            type="button"
            className="delete-task-btn"
            onClick={() => onDelete(selectedTask.id)}
          >
            <svg className="delete-task-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
            Delete
          </button>
        )}
      </div>
      <p className="template-notice" role="status">{templateNotice}</p>
    </form>
  );
};
