import React from 'react';
import { Task } from '../types/Task';
import { TaskCard } from './TaskCard';

// Define the interface for TaskListProps
interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskToggle: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  selectedTaskId?: string;
}

// TaskList component definition
export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onTaskSelect, 
  onTaskToggle,
  onAddSubtask,
  selectedTaskId
}) => {
  // Filter out subtasks from the main list - they'll be rendered within their parent tasks
  const mainTasks = tasks.filter(task => !task.isSubtask);

  return (
    <div className="task-list">
      {mainTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onTaskSelect={onTaskSelect}
          onTaskToggle={onTaskToggle}
          onAddSubtask={onAddSubtask}
          selectedTaskId={selectedTaskId}
        />
      ))}
      {mainTasks.length === 0 && (
        <div className="no-tasks">No tasks in this section</div>
      )}
    </div>
  );
};
