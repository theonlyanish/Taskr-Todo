import React from 'react';
import { Task } from '../types/Task';

interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskToggle: (taskId: string) => void;
  selectedTaskId?: string;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onTaskSelect, 
  onTaskToggle,
  selectedTaskId 
}) => {
  return (
    <div className="tasks-list">
      {tasks.map(task => (
        <div 
          key={task.id}
          className={`task-item ${task.id === selectedTaskId ? 'selected' : ''}`}
          onClick={() => onTaskSelect(task)}
        >
          <div 
            className={`task-checkbox ${task.status === 'Completed' ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onTaskToggle(task.id);
            }}
          />
          <div className="task-content">
            <div className={`task-title ${task.status === 'Completed' ? 'completed' : ''}`}>
              {task.title}
            </div>
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
