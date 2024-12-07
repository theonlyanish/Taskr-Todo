import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { ThemeToggle } from './components/ThemeToggle';
import { TaskService } from './services/taskService';
import { Task } from './types/Task';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
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

  const handleTaskClick = (task: Task) => {
    if (task.status === 'Completed') {
      setTaskToDelete(task);
      setShowDeleteConfirm(true);
    } else {
      setSelectedTask(task);
    }
  };

  const handleDeleteTask = () => {
    if (taskToDelete) {
      TaskService.deleteTask(taskToDelete.id);
      setTasks(TaskService.getTasks());
      setTaskToDelete(null);
      setShowDeleteConfirm(false);
      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
      }
    }
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>Task Manager</h1>
        <ThemeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
      </div>
      
      <div className="main-content">
        <div className="tasks-column">
          <button className="add-task-button" onClick={handleAddNewTask}>
            <span>+</span> Add New Task
          </button>
          
          {/* To Do Section */}
          <div className="task-section">
            <h2>To Do</h2>
            <TaskList 
              tasks={tasks.filter(task => task.status === 'To Do')}
              onTaskSelect={setSelectedTask}
              onTaskToggle={handleTaskStatusToggle}
              selectedTaskId={selectedTask?.id}
            />
          </div>

          {/* In Progress Section */}
          <div className="task-section in-progress-section">
            <h2>In Progress</h2>
            <TaskList 
              tasks={tasks.filter(task => task.status === 'In Progress')}
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
              onTaskSelect={handleTaskClick}
              onTaskToggle={handleTaskStatusToggle}
              selectedTaskId={selectedTask?.id}
            />
          </div>
        </div>

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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Task</h3>
            <p>Are you sure you want to delete "{taskToDelete?.title}"?</p>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTaskToDelete(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="delete-btn"
                onClick={handleDeleteTask}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};