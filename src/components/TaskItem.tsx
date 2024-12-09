import React, { useState } from 'react';
import { Task, TaskStatus } from '../types/Task';

// Define the interface for TaskItemProps
interface TaskItemProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  const handleStatusChange = (newStatus: TaskStatus) => {
    const updatedTask = { ...task, status: newStatus };
    onUpdate(updatedTask);
  };

  const handleSaveEdit = () => {
    onUpdate(editedTask);
    setIsEditing(false);
  };

  // Function to handle cancellation of edit mode
  const handleCancelEdit = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  // If the task item is in edit mode, render the edit form
  if (isEditing) {
    return (
      <div className="task-item editing">
        <input
          type="text"
          value={editedTask.title}
          onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
          className="edit-input"
        />
        <textarea
          value={editedTask.description || ''}
          onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
          className="edit-input"
        />
        <select
          value={editedTask.status}
          onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value as TaskStatus })}
          className="edit-input"
        >
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <input
          type="date"
          value={editedTask.dueDate ? new Date(editedTask.dueDate).toISOString().split('T')[0] : ''}
          onChange={(e) => setEditedTask({ 
            ...editedTask, 
            dueDate: e.target.value ? new Date(e.target.value) : undefined 
          })}
          className="edit-input"
        />
        <div className="edit-actions">
          <button onClick={handleSaveEdit} className="save-btn">Save</button>
          <button onClick={handleCancelEdit} className="cancel-btn">Cancel</button>
        </div>
      </div>
    );
  }

  // If not in edit mode, render the task item in its normal state
  return (
    <div className={`task-item ${task.status.toLowerCase().replace(' ', '-')}`}>
      <div className="task-header">
        <h3>{task.title}</h3>
        <div className="task-actions">
          <button onClick={() => setIsEditing(true)} className="edit-btn">
            Edit
          </button>
          <button onClick={() => onDelete(task.id)} className="delete-btn">
            Delete
          </button>
        </div>
      </div>
      
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      
      <div className="task-meta">
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          className={`status-select ${task.status.toLowerCase().replace(' ', '-')}`}
        >
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        
        {task.dueDate && (
          <span className="due-date">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};
