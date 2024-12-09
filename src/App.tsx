import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { ThemeToggle } from './components/ThemeToggle';
import { TaskService } from './services/taskService';
import { SupabaseTaskService } from './services/supabaseTaskService';
import { Task } from './types/Task';

// The main application component
export const App: React.FC = () => {
  // State to manage tasks, selected task, delete confirmation, and dark mode
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode is enabled based on local storage
    return localStorage.getItem('theme') === 'dark';
  });

  // Effect to toggle dark mode and update local storage
  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    // Initial load from local storage
    setTasks(TaskService.getTasks());
    
    // Then fetch from Supabase and update
    const fetchTasks = async () => {
      const supabaseTasks = await SupabaseTaskService.getTasks();
      if (supabaseTasks.length > 0) {
        setTasks(supabaseTasks);
        TaskService.syncTasks(supabaseTasks);
      }
    };
    
    fetchTasks();
  }, []);

  // Function to handle adding a new task
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

  // Function to handle toggling task status
  const handleTaskStatusToggle = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const newStatus = task.status === 'Completed' ? 'To Do' : 'Completed';
        const updatedTask = await SupabaseTaskService.updateTask(taskId, { 
          status: newStatus 
        });
        
        if (updatedTask) {
          setTasks(prevTasks => 
            prevTasks.map(t => t.id === taskId ? updatedTask : t)
          );
          if (selectedTask?.id === taskId) {
            setSelectedTask(updatedTask);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling task status:', error);
    }
  };

  // Function to handle task click
  const handleTaskClick = (task: Task) => {
    if (task.status === 'Completed') {
      setTaskToDelete(task);
      setShowDeleteConfirm(true);
    } else {
      setSelectedTask(task);
    }
  };

  // Function to handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (taskToDelete) {
      try {
        const success = await SupabaseTaskService.deleteTask(taskToDelete.id);
        if (success) {
          setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete.id));
          if (selectedTask?.id === taskToDelete.id) {
            setSelectedTask(null);
          }
        }
      } catch (error) {
        console.error('Error deleting task:', error);
      } finally {
        setShowDeleteConfirm(false);
        setTaskToDelete(null);
      }
    }
  };

  // Function to handle cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setTaskToDelete(null);
  };

  // Function to handle task form submission
  const handleSubmit = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (selectedTask) {
        // Update existing task
        const updatedTask = await SupabaseTaskService.updateTask(selectedTask.id, task);
        if (updatedTask) {
          setTasks(prevTasks => 
            prevTasks.map(t => t.id === selectedTask.id ? updatedTask : t)
          );
          setSelectedTask(null);
        }
      } else {
        // Create new task
        const savedTask = await SupabaseTaskService.saveTask(task);
        if (savedTask) {
          setTasks(prevTasks => [savedTask, ...prevTasks]);
        }
      }
    } catch (error) {
      console.error('Error handling task submit:', error);
    }
  };

  // JSX for the application
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
      {showDeleteConfirm && taskToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Task</h3>
            <p>Are you sure you want to delete "{taskToDelete.title}"?</p>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button 
                className="delete-btn"
                onClick={handleDeleteConfirm}
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