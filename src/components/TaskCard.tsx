import React from 'react';
import { Task } from '../types/Task';

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
  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskToggle(task.id);
  };

  return (
    <div className={`task-item ${task.id === selectedTaskId ? 'selected' : ''} ${task.isSubtask ? 'subtask' : ''}`}>
      <div
        className={`task-checkbox ${task.status === 'Completed' ? 'checked' : ''}`}
        onClick={handleCheckboxClick}
      />
      <div className="task-content" onClick={() => onTaskSelect(task)}>
        <div className={`task-title ${task.status === 'Completed' ? 'completed' : ''}`}>
          {task.title}
        </div>
        {task.dueDate && (
          <div className="task-meta">
            <span className="due-date">
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
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