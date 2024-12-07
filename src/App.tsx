import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { ThemeToggle } from './components/ThemeToggle';
import { TaskService } from './services/taskService';
import { Task } from './types/Task';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if user has a theme preference in localStorage
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Load tasks when component mounts
    setTasks(TaskService.getTasks());
    
    // Apply theme class to body
    document.body.classList.toggle('dark-theme', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>Task Manager</h1>
        <ThemeToggle isDark={isDarkMode} onToggle={toggleTheme} />
      </header>
      <TaskForm onSubmit={handleCreateTask} />
      <TaskList 
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
};