import React from 'react';
import { Task, TaskStatus } from '../types/Task';

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

const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  onTaskSelect,
  onTaskUpdate,
  selectedTaskId
}) => {
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
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== newStatus) {
      onTaskUpdate(taskId, { status: newStatus });
    }
  };

  // Organize tasks by status
  const tasksByStatus = COLUMNS.reduce((acc, column) => ({
    ...acc,
    [column.id]: tasks.filter(task => task.status === column.id)
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
              {tasksByStatus[column.id].map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className={`kanban-task-card ${
                    task.id === selectedTaskId ? 'selected' : ''
                  }`}
                  onClick={() => onTaskSelect(task)}
                >
                  <div className="kanban-task-title">{task.title}</div>
                  {task.dueDate && (
                    <div className="kanban-task-due-date">
                      {new Date(task.dueDate).toLocaleDateString()}
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