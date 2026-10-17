import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus } from '../types/Task';
import { describeDueDate, parseQuickAdd, useQuickAdd } from '../utils/quickAdd';

// Define the interface for TaskFormProps
export interface TaskFormProps {
  selectedTask: Task | null;
  onSubmit: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  initialDueDate?: Date | null;
  parentId?: string | null;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  selectedTask,
  onSubmit,
  onUpdate,
  onDelete,
  initialDueDate,
  parentId
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [dueDate, setDueDate] = useState<string>('');
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
    } else {
      setTitle('');
      setDescription('');
      setStatus('To Do');
      setDueDate(initialDueDate ? new Date(initialDueDate).toISOString().split('T')[0] : '');
      // Focus the title input when creating a new task
      titleInputRef.current?.focus({ preventScroll: true });
    }
  }, [selectedTask, initialDueDate]);

  // Function to handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = {
      title,
      description,
      status,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      parentId: parentId || undefined
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
  const formTitle = parentId ? 'Add Subtask' : selectedTask?.id ? 'Edit Task' : '';

  // JSX for the form
  return (
    <form key={formKey} onSubmit={handleSubmit} className="task-form">
      {formTitle && <h2>{formTitle}</h2>}
      <div className="form-group">
        <label>Task:</label>
        <input
          ref={titleInputRef}
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

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter task description (optional)"
          className="form-input description-input"
          rows={4}
        />
      </div>

      <div className="form-group">
        <label>Status</label>
        <select
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

      <div className="form-group">
        <label>Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="form-input"
          placeholder="dd-mm-yyyy"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="add-task-btn">
          {selectedTask ? 'Save changes' : 'Add task'}
        </button>
        {selectedTask && onDelete && (
          <button 
            type="button"
            className="delete-task-btn"
            onClick={() => onDelete(selectedTask.id)}
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </form>
  );
};
