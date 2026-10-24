import React from 'react';
import { Task } from '../types/Task';
import { TaskList, TaskListProps } from './TaskList';

interface TaskSectionProps extends Omit<TaskListProps, 'tasks' | 'emptyText'> {
  title: string;
  // This section's tasks (subtasks are shown inside their parent)
  tasks: Task[];
  className?: string;
  emptyText: string;
  // Completed only: fold the section away, and clear it (with undo)
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onClear?: () => void;
}

// A heading with how many tasks are in the section, then the tasks
export const TaskSection: React.FC<TaskSectionProps> = ({
  title,
  tasks,
  className = '',
  emptyText,
  collapsed = false,
  onToggleCollapsed,
  onClear,
  ...listProps
}) => {
  const count = tasks.filter(task => !task.isSubtask).length;
  const listId = `section-${title.toLowerCase().replace(/\s+/g, '-')}`;
  // Read as one phrase ("Completed, 3 tasks"); the count is shown as a badge
  const label = (
    <>
      <span aria-hidden="true">
        {title}
        <span className="section-count">{count}</span>
      </span>
      <span className="sr-only">{`${title}, ${count} task${count === 1 ? '' : 's'}`}</span>
    </>
  );

  return (
    <div className={`task-section ${className}`}>
      <div className="section-header">
        <h2>
          {onToggleCollapsed ? (
            <button
              type="button"
              className="section-toggle"
              aria-expanded={!collapsed}
              aria-controls={listId}
              onClick={onToggleCollapsed}
            >
              <svg className="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
              {label}
            </button>
          ) : (
            label
          )}
        </h2>
        {onClear && count > 0 && (
          <button type="button" className="clear-completed-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div id={listId} hidden={collapsed}>
        {!collapsed && <TaskList tasks={tasks} emptyText={emptyText} {...listProps} />}
      </div>
    </div>
  );
};
