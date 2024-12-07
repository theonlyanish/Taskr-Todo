import React from 'react';
import { Task } from '../types/Task';

interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskComplete: (taskId: string) => void;
  selectedTaskId?: string;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onTaskSelect, 
  onTaskComplete,
  selectedTaskId 
}) => {
  return (
    <div className="tasks-list">
      {tasks.map(task => (
        <div 
          key={task.id}
          className={`task-item ${task.id === selectedTaskId ? 'selected' : ''}`}
        >
          <div 
            className={`task-checkbox ${task.status === 'Completed' ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onTaskComplete(task.id);
            }}
          />
          <div 
            className="task-content"
            onClick={() => onTaskSelect(task)}
          >
            <div className="task-title">{task.title}</div>
            <div className="task-meta">
              {task.dueDate && (
                <span className="task-date">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
