import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types/Task';

interface TaskFormProps {
  selectedTask: Task | null;
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ selectedTask, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title);
      setDescription(selectedTask.description || '');
      setStatus(selectedTask.status);
      setDueDate(selectedTask.dueDate ? 
        new Date(selectedTask.dueDate).toISOString().split('T')[0] : '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('To Do');
      setDueDate('');
    }
  }, [selectedTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || undefined,
      status,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <div className="form-group">
        <label>Task:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Enter task title"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter task description (optional)"
          className="form-input description-input"
          rows={4}
        />
      </div>

      <div className="form-group">
        <label>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          required
          className="form-input status-select"
        >
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      <div className="form-group">
        <label>Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="form-input"
          placeholder="dd-mm-yyyy"
        />
      </div>


      <div className="form-actions">
        <button type="submit" className="add-task-btn">
          {selectedTask ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  );
};
