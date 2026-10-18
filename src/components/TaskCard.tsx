import React, { useEffect, useRef } from 'react';
import { Task } from '../types/Task';
import { useStatusMorph } from '../utils/statusMorph';
import { DueDate } from './DueDate';
import { sortByOrder } from '../utils/taskOrder';
import { setSubtasksExpanded, useSubtasksExpanded } from '../utils/subtaskExpansion';
import { SubtaskProgress } from './SubtaskProgress';

// Ticking a task moves it to another section, which remounts its row. This
// remembers whose checkbox had focus so the new row can take focus back.
let checkboxToRefocus: string | null = null;
// Moving a row with Alt+arrow re-orders the list; this keeps focus on it
let rowToRefocus: string | null = null;

export interface TaskCardProps {
  task: Task;
  onTaskSelect: (task: Task) => void;
  onTaskToggle: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  selectedTaskId?: string;
  // Drag-to-reorder wiring from TaskList, for top-level rows
  sortable?: {
    ref: (node: HTMLElement | null) => void;
    listeners?: Record<string, Function>;
    style: React.CSSProperties;
    isDragging: boolean;
  };
  // Alt+Up / Alt+Down: move one place up or down in the section
  onKeyboardMove?: (step: -1 | 1) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onTaskSelect,
  onTaskToggle,
  onAddSubtask,
  selectedTaskId,
  sortable,
  onKeyboardMove
}) => {
  const isCompleted = task.status === 'Completed';
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLButtonElement>(null);
  const subtasks = task.subtasks ?? [];
  // Hidden behind the progress chip until opened
  const subtasksOpen = useSubtasksExpanded(task.id);
  const subtasksId = `subtasks-${task.id}`;
  // Sweeps the colour strip from the old status colour after a status change
  const morph = useStatusMorph(task.id, task.status);

  useEffect(() => {
    if (checkboxToRefocus === task.id) {
      checkboxToRefocus = null;
      checkboxRef.current?.focus();
    }
  }, [task.id]);

  // After every render: the row may have just been moved with the keyboard
  useEffect(() => {
    if (rowToRefocus === task.id) {
      rowToRefocus = null;
      contentRef.current?.focus({ preventScroll: true });
      contentRef.current?.scrollIntoView({ block: 'nearest' });
    }
  });

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!onKeyboardMove || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    rowToRefocus = task.id;
    onKeyboardMove(e.key === 'ArrowUp' ? -1 : 1);
  };

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (document.activeElement === e.currentTarget) {
      checkboxToRefocus = task.id;
    }
    onTaskToggle(task.id);
  };

  return (
    <div
      ref={sortable?.ref}
      {...sortable?.listeners}
      className={`task-item ${task.id === selectedTaskId ? 'selected' : ''} ${task.isSubtask ? 'subtask' : ''} ${sortable?.isDragging ? 'drag-active' : ''} ${morph.className}`}
      style={{ ...morph.style, ...sortable?.style }}
      onAnimationEnd={morph.onAnimationEnd}
      data-status={task.status}
      data-task-id={task.id}
    >
      <button
        ref={checkboxRef}
        type="button"
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={`Complete “${task.title}”`}
        className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
        onClick={handleCheckboxClick}
      />
      <button
        type="button"
        ref={contentRef}
        className="task-content"
        aria-current={task.id === selectedTaskId ? 'true' : undefined}
        aria-keyshortcuts={onKeyboardMove ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
        onClick={() => onTaskSelect(task)}
        onKeyDown={handleContentKeyDown}
      >
        <span className={`task-title ${isCompleted ? 'completed' : ''}`}>
          {task.title}
        </span>
        {task.dueDate && (
          <span className="task-meta">
            <DueDate dueDate={task.dueDate} completed={isCompleted} className="due-date" />
          </span>
        )}
      </button>
      {subtasks.length > 0 && (
        <SubtaskProgress
          subtasks={subtasks}
          expanded={subtasksOpen}
          onToggle={() => setSubtasksExpanded(task.id, !subtasksOpen)}
          controlsId={subtasksId}
        />
      )}
      {!task.isSubtask && (
        <button
          className="add-subtask-btn"
          onClick={(e) => {
            e.stopPropagation();
            onAddSubtask(task.id);
          }}
          title="Add subtask"
        >
          <span className="add-icon">+</span>
          <span className="btn-text">Add subtask</span>
        </button>
      )}
      {subtasks.length > 0 && (
        <div id={subtasksId} className="subtasks-container" hidden={!subtasksOpen}>
          {sortByOrder(subtasks).map(subtask => (
            <TaskCard
              key={subtask.id}
              task={subtask}
              onTaskSelect={onTaskSelect}
              onTaskToggle={onTaskToggle}
              onAddSubtask={onAddSubtask}
              selectedTaskId={selectedTaskId}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 