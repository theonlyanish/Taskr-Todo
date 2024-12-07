import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { TaskService } from './services/taskService';
import { Task } from './types/Task';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Load tasks when component mounts
    setTasks(TaskService.getTasks());
  }, []);

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask = TaskService.saveTask(taskData);
    setTasks(TaskService.getTasks());
  };

  const handleUpdateTask = (updatedTask: Task) => {
    TaskService.updateTask(updatedTask.id, updatedTask);
    setTasks(TaskService.getTasks());
  };

  const handleDeleteTask = (taskId: string) => {
    TaskService.deleteTask(taskId);
    setTasks(TaskService.getTasks());
  };

  return (
    <div className="container">
      <h1>Task Manager</h1>
      <TaskForm onSubmit={handleCreateTask} />
      <TaskList 
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
};