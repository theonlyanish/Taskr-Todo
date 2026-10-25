import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus } from '../types/Task';
import { describeDueDate, parseQuickAdd, useQuickAdd } from '../utils/quickAdd';
import { FOCUS_LENGTHS } from '../utils/focusTimer';
import { DEFAULT_LIST_ID, TaskList, listOf, storedListId } from '../utils/taskLists';
import { REPEAT_CHOICES, anchorRepeat, describeRepeat, parseRepeatValue } from '../utils/repeat';

// A stored repeat without its day-of-the-month anchor ("month:1@31" is "month:1"),
// to match the Repeat field's choices
const repeatChoiceOf = (value: string | null | undefined) => (value ?? '').replace(/@\d+$/, '');

// Today as a due date (midnight UTC of the local day)
const todayAsDueDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

// A due date as the date field's value ("2026-10-30"), or ''
const dueDateValue = (date: Date | undefined) => (date ? new Date(date).toISOString().split('T')[0] : '');

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
  // Save this task as a template
  onSaveTemplate?: (task: Task) => Promise<'saved' | 'exists'>;
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
  // How it repeats ('' for not at all); top-level tasks only
  const [repeatChoice, setRepeatChoice] = useState('');
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
      setRepeatChoice(repeatChoiceOf(selectedTask.repeat));
    } else {
      setTitle('');
      setDescription('');
      setStatus('To Do');
      setDueDate(initialDueDate ? new Date(initialDueDate).toISOString().split('T')[0] : '');
      setListId(currentListId);
      setRepeatChoice('');
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
      ...(showListField ? { listId: storedListId(listId) } : {}),
      repeat: undefined as string | null | undefined
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

    // A repeat needs a due date to count from: today if none is set. The Repeat
    // field wins over one read from the title ("every friday").
    if (!isSubtaskForm) {
      const unchanged =
        !!selectedTask?.repeat &&
        repeatChoice === repeatChoiceOf(selectedTask.repeat) &&
        dueDate === dueDateValue(selectedTask.dueDate);
      if (repeatChoice) {
        formData.dueDate ??= todayAsDueDate();
        formData.repeat = unchanged ? selectedTask!.repeat : anchorRepeat(repeatChoice, formData.dueDate);
      } else {
        formData.repeat = quickAdd?.repeat ?? null;
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
      setRepeatChoice('');
      setKeptAsText(null);
    }
  };

  // The Repeat field's choices, plus the task's own repeat when it isn't one
  // of them ("every 3 days" from quick add)
  const ownRepeat = parseRepeatValue(repeatChoice);
  const repeatOptions =
    ownRepeat && !REPEAT_CHOICES.some(choice => choice.value === repeatChoice)
      ? [...REPEAT_CHOICES, { value: repeatChoice, label: describeRepeat(ownRepeat) }]
      : REPEAT_CHOICES;
  const quickAddRepeat = quickAdd?.repeat ? parseRepeatValue(quickAdd.repeat) : null;

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
      // What the form is doing, for code that waits for it (App's focusNewTaskTitle)
      data-mode={isEditing ? 'edit' : parentId ? 'subtask' : 'new'}
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
                {quickAddRepeat && <> · Repeats {describeRepeat(quickAddRepeat, quickAdd.dueDate).replace(/^E/, 'e')}</>}
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

        {!isSubtaskForm && (
          <div className="form-group">
            <label htmlFor="task-repeat">Repeat</label>
            <select
              id="task-repeat"
              value={repeatChoice}
              onChange={(e) => setRepeatChoice(e.target.value)}
              className="form-input"
              aria-describedby={repeatChoice ? 'task-repeat-note' : undefined}
            >
              {repeatOptions.map(choice => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
            {repeatChoice && (
              <p id="task-repeat-note" className="task-repeat-note">
                {dueDate ? 'When it’s done, the next one is added' : 'Due today, then the next one is added when it’s done'}
              </p>
            )}
          </div>
        )}
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
