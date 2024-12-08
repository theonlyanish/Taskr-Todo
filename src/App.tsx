import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { ThemeToggle } from './components/ThemeToggle';
import { TaskService } from './services/taskService';
import { SupabaseTaskService } from './services/supabaseTaskService';
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
    // Initial load from local storage
    setTasks(TaskService.getTasks());
    
    // Then fetch from Supabase and update
    const fetchTasks = async () => {
      const supabaseTasks = await SupabaseTaskService.getTasks();
      if (supabaseTasks.length > 0) {
        setTasks(supabaseTasks);
        // Update local storage using the public method
        TaskService.syncTasks(supabaseTasks);
      }
    };
    
    fetchTasks();
  }, []);

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

  const handleTaskStatusToggle = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const newStatus = task.status === 'Completed' ? 'To Do' : 'Completed';
      const updatedTask = await SupabaseTaskService.updateTask(taskId, { status: newStatus });
      if (updatedTask) {
        const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
        setTasks(updatedTasks);
        TaskService.syncTasks(updatedTasks);
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

  const handleDeleteTask = async (taskId: string) => {
    const success = await SupabaseTaskService.deleteTask(taskId);
    if (success) {
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      setTasks(updatedTasks);
      TaskService.syncTasks(updatedTasks);
    }
  };

  const handleSubmit = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Save to Supabase first
    const savedTask = await SupabaseTaskService.saveTask(task);
    if (savedTask) {
      // If successful, update local storage and state
      const updatedTasks = [savedTask, ...tasks];
      setTasks(updatedTasks);
      TaskService.syncTasks(updatedTasks);
    }
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header">
          <img src={process.env.PUBLIC_URL + '/favicon_io/favicon.ico'} alt="Task Manager Logo" />
          <h1>Task Manager</h1>
        </div>
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
            onSubmit={handleSubmit}
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
                onClick={() => handleDeleteTask(taskToDelete?.id || '')}
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