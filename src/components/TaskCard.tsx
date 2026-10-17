import React, { useEffect, useRef } from 'react';
import { Task } from '../types/Task';

// Ticking a task moves it to another section, which remounts its row. This
// remembers whose checkbox had focus so the new row can take focus back.
let checkboxToRefocus: string | null = null;

interface TaskCardProps {
  task: Task;
  onTaskSelect: (task: Task) => void;
  onTaskToggle: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  selectedTaskId?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onTaskSelect,
  onTaskToggle,
  onAddSubtask,
  selectedTaskId
}) => {
  const isCompleted = task.status === 'Completed';
  const checkboxRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (checkboxToRefocus === task.id) {
      checkboxToRefocus = null;
      checkboxRef.current?.focus();
    }
  }, [task.id]);

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
      className={`task-item ${task.id === selectedTaskId ? 'selected' : ''} ${task.isSubtask ? 'subtask' : ''}`}
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
        className="task-content"
        aria-current={task.id === selectedTaskId ? 'true' : undefined}
        onClick={() => onTaskSelect(task)}
      >
        <span className={`task-title ${isCompleted ? 'completed' : ''}`}>
          {task.title}
        </span>
        {task.dueDate && (
          <span className="task-meta">
            <span className="due-date">
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </span>
          </span>
        )}
      </button>
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
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="subtasks-container">
          {task.subtasks.map(subtask => (
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