import React from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskService } from './services/taskService';
import { Task } from './types/Task';

export const App: React.FC = () => {
  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask = TaskService.saveTask(taskData);
    console.log('New task created:', newTask);
  };

  return (
    <div className="container">
      <h1>Task Manager</h1>
      <TaskForm onSubmit={handleCreateTask} />
    </div>
  );
};
