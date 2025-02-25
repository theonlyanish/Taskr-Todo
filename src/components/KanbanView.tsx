import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types/Task';
import { isEqual } from 'lodash';

interface KanbanViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  selectedTaskId?: string;
}

interface ColumnDefinition {
  id: TaskStatus;
  title: string;
}

const COLUMNS: ColumnDefinition[] = [
  { id: 'To Do', title: 'To Do' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'Completed', title: 'Completed' }
];

// New component for rendering subtasks in Kanban view
const SubtaskItem: React.FC<{ 
  subtask: Task; 
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
}> = ({ subtask, onTaskSelect, selectedTaskId }) => {
  return (
    <div 
      className={`kanban-subtask-item ${subtask.id === selectedTaskId ? 'selected' : ''} ${subtask.status === 'Completed' ? 'completed' : ''}`}
      data-status={subtask.status}
      onClick={(e) => {
        e.stopPropagation();
        onTaskSelect(subtask);
      }}
    >
      <div className="kanban-subtask-title">{subtask.title}</div>
    </div>
  );
};

const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  onTaskSelect,
  onTaskUpdate,
  selectedTaskId
}) => {
  // Add local state to track tasks for optimistic UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  
  // Update local tasks when props change, but avoid infinite loops
  useEffect(() => {
    // Only update if the tasks have actually changed (deep comparison)
    // We need to be careful with the dependency array to avoid infinite loops
    const tasksChanged = !isEqual(tasks, localTasks);
    if (tasksChanged) {
      setLocalTasks(tasks);
    }
  }, [tasks]); // Only depend on tasks, not localTasks to avoid loops

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const dropZone = target.closest('.kanban-task-list');
    if (dropZone) {
      dropZone.classList.add('dragging-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const dropZone = target.closest('.kanban-task-list');
    if (dropZone) {
      dropZone.classList.remove('dragging-over');
    }
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const dropZone = target.closest('.kanban-task-list');
    if (dropZone) {
      dropZone.classList.remove('dragging-over');
    }

    const taskId = e.dataTransfer.getData('text/plain');
    const task = localTasks.find(t => t.id === taskId);
    
    if (task && task.status !== newStatus) {
      console.log(`Moving task ${task.title} to ${newStatus}`);
      
      // Optimistic UI update - immediately update the local state
      const updatedLocalTasks = localTasks.map(t => {
        // Update the task being dragged
        if (t.id === taskId) {
          // If this is a parent task being completed, also update its subtasks
          if (newStatus === 'Completed' && t.subtasks && t.subtasks.length > 0) {
            return {
              ...t,
              status: newStatus,
              subtasks: t.subtasks.map(subtask => ({
                ...subtask,
                status: 'Completed' as TaskStatus
              }))
            };
          }
          
          // Regular task update
          return { ...t, status: newStatus };
        }
        
        return t;
      });
      
      // Update local state immediately for responsive UI
      setLocalTasks(updatedLocalTasks);
      
      // Call the parent component's update function to persist changes
      // This happens asynchronously, so the UI is already updated
      setTimeout(() => {
        onTaskUpdate(taskId, { status: newStatus });
      }, 0);
    }
  };

  // Helper function to find a task by ID (including in subtasks)
  const findTaskById = (taskList: Task[], id: string): Task | undefined => {
    for (const task of taskList) {
      if (task.id === id) {
        return task;
      }
      if (task.subtasks && task.subtasks.length > 0) {
        const found = findTaskById(task.subtasks, id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };

  // Modified onTaskSelect to use localTasks
  const handleTaskSelect = (task: Task) => {
    // Find the most up-to-date version of the task from localTasks
    const currentTask = findTaskById(localTasks, task.id);
    if (currentTask) {
      onTaskSelect(currentTask);
    } else {
      onTaskSelect(task);
    }
  };

  // Organize tasks by status - filter out subtasks from main list
  // Use localTasks instead of tasks for immediate UI updates
  const tasksByStatus = COLUMNS.reduce((acc, column) => ({
    ...acc,
    [column.id]: localTasks.filter(task => task.status === column.id && !task.isSubtask)
  }), {} as Record<TaskStatus, Task[]>);

  return (
    <div className="kanban-container">
      <div className="kanban-columns">
        {COLUMNS.map((column) => (
          <div key={column.id} className="kanban-column">
            <h2 className="kanban-column-title">{column.title}</h2>
            <div
              className="kanban-task-list"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {tasksByStatus[column.id].length === 0 && (
                <div className="kanban-no-tasks">No tasks in this column</div>
              )}
              {tasksByStatus[column.id].map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className={`kanban-task-card ${
                    task.id === selectedTaskId ? 'selected' : ''
                  } ${task.status === 'Completed' ? 'completed' : ''}`}
                  onClick={() => handleTaskSelect(task)}
                >
                  <div className="kanban-task-title">{task.title}</div>
                  {task.dueDate && (
                    <div className="kanban-task-due-date">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  {/* Display subtasks if they exist */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="kanban-subtasks-container">
                      <div className="kanban-subtasks-header">Subtasks:</div>
                      {task.subtasks.map(subtask => (
                        <SubtaskItem 
                          key={subtask.id}
                          subtask={subtask}
                          onTaskSelect={handleTaskSelect}
                          selectedTaskId={selectedTaskId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanView; 