import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { ThemeToggle } from './components/ThemeToggle';
import { TaskService } from './services/taskService';
import { Task } from './types/Task';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    setTasks(TaskService.getTasks());
    document.body.classList.toggle('dark-theme', isDarkMode);
  }, [isDarkMode]);

  const handleAddNewTask = () => {
    setSelectedTask(null); // Clear selected task
    // Find the task title input and focus it
    setTimeout(() => {
      const titleInput = document.querySelector('.task-form input[type="text"]') as HTMLInputElement;
      if (titleInput) {
        titleInput.focus();
      }
    }, 0);
  };

  const handleTaskStatusToggle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const newStatus = task.status === 'Completed' ? 'To Do' : 'Completed';
      const updatedTask = TaskService.updateTask(taskId, { status: newStatus });
      if (updatedTask) {
        setTasks(TaskService.getTasks());
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
      }
    }
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>Today</h1>
        <ThemeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
      </div>
      
      <div className="main-content">
        {/* Left Column - Task Lists */}
        <div className="tasks-column">
          <button className="add-task-button" onClick={handleAddNewTask}>
            <span>+</span> Add New Task
          </button>
          
          {/* To Do Section */}
          <div className="task-section">
            <h2>To Do</h2>
            <TaskList 
              tasks={tasks.filter(task => task.status !== 'Completed')}
              onTaskSelect={setSelectedTask}
              onTaskToggle={handleTaskStatusToggle}
              selectedTaskId={selectedTask?.id}
            />
          </div>

          {/* Completed Section */}
          <div className="task-section completed-section">
            <h2>Completed</h2>
            <TaskList 
              tasks={tasks.filter(task => task.status === 'Completed')}
              onTaskSelect={setSelectedTask}
              onTaskToggle={handleTaskStatusToggle}
              selectedTaskId={selectedTask?.id}
            />
          </div>
        </div>

        {/* Right Column - Task Details/Form */}
        <div className="task-detail-column">
          <TaskForm 
            selectedTask={selectedTask}
            onSubmit={(task) => {
              if (selectedTask) {
                TaskService.updateTask(selectedTask.id, task);
              } else {
                TaskService.saveTask(task);
              }
              setTasks(TaskService.getTasks());
            }}
          />
        </div>
      </div>
    </div>
  );
};