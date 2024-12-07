import React from 'react';
import { Task } from '../types/Task';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onUpdateTask, 
  onDeleteTask 
}) => {
  return (
    <div className="task-list">
      {tasks.length === 0 ? (
        <p className="no-tasks">No tasks available</p>
      ) : (
        tasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
          />
        ))
      )}
    </div>
  );
};
