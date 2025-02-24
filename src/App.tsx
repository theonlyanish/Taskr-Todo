import React, { useState, useEffect } from 'react';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { ThemeToggle } from './components/ThemeToggle';
import { Auth } from './components/Auth';
import { SyncIndicator } from './components/SyncIndicator';
import { TaskService } from './services/taskService';
import { AuthService } from './services/authService';
import { Task } from './types/Task';
import { User } from '@supabase/supabase-js';
import './styles.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode is enabled based on local storage
    return localStorage.getItem('theme') === 'dark';
  });
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState(TaskService.getSyncStatus());
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Effect to toggle dark mode and update local storage
  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Load tasks and check auth state on mount
  useEffect(() => {
    const loadInitialData = async () => {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      
      const loadedTasks = await TaskService.getTasks();
      setTasks(loadedTasks);
    };

    loadInitialData();

    // Subscribe to auth changes
    const { data: { subscription } } = AuthService.subscribeToAuthChanges((user) => {
      setUser(user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Monitor sync status changes
  useEffect(() => {
    const checkSyncStatus = () => {
      setSyncStatus(TaskService.getSyncStatus());
    };

    const interval = setInterval(checkSyncStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddNewTask = () => {
    setSelectedTask(null);
  };

  const handleTaskSubmit = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask = await TaskService.saveTask(task);
    if (newTask) {
      setTasks(prev => [newTask, ...prev]);
      setSelectedTask(null);
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    const updatedTask = await TaskService.updateTask(taskId, updates);
    if (updatedTask) {
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      setSelectedTask(null);
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    const success = await TaskService.deleteTask(taskId);
    if (success) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTask(null);
    }
  };

  const handleSync = async () => {
    if (user) {
      await TaskService.forceSyncWithCloud();
      const updatedTasks = await TaskService.getTasks();
      setTasks(updatedTasks);
    }
  };

  const handleAuthStateChange = (isLoggedIn: boolean) => {
    setShowAuthModal(false);
    if (!isLoggedIn) {
      setTasks([]);
      setSelectedTask(null);
    }
  };

  const handleSignOut = async () => {
    await AuthService.signOut();
    // Clear tasks and reload from localStorage
    const localTasks = await TaskService.getTasks();
    setTasks(localTasks);
  };

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <header className="app-header">
        <div className="header">
          <h1>Task Manager</h1>
        </div>
        <div className="header-controls">
          {user && (
            <SyncIndicator
              status={syncStatus}
              onSync={handleSync}
            />
          )}
          <ThemeToggle
            isDark={isDarkMode}
            onToggle={() => setIsDarkMode(!isDarkMode)}
          />
          {user ? (
            <button
              onClick={handleSignOut}
              className="sign-out-btn"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="sign-in-btn"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        <div className="tasks-column">
          <div className="tasks-header">
            <button className="add-task-button" onClick={handleAddNewTask}>
              <span>+</span> Add New Task
            </button>
          </div>
          
          {/* To Do Section */}
          <div className="task-section">
            <h2>To Do</h2>
            <TaskList 
              tasks={tasks.filter(task => task.status === 'To Do')}
              onTaskSelect={setSelectedTask}
              onTaskToggle={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                  handleTaskUpdate(taskId, {
                    status: task.status === 'Completed' ? 'To Do' : 'Completed'
                  });
                }
              }}
              selectedTaskId={selectedTask?.id}
            />
          </div>

          {/* In Progress Section */}
          <div className="task-section in-progress-section">
            <h2>In Progress</h2>
            <TaskList
              tasks={tasks.filter(task => task.status === 'In Progress')}
              onTaskSelect={setSelectedTask}
              onTaskToggle={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                  handleTaskUpdate(taskId, {
                    status: task.status === 'Completed' ? 'To Do' : 'Completed'
                  });
                }
              }}
              selectedTaskId={selectedTask?.id}
            />
          </div>

          {/* Completed Section */}
          <div className="task-section completed-section">
            <h2>Completed</h2>
            <TaskList 
              tasks={tasks.filter(task => task.status === 'Completed')}
              onTaskSelect={setSelectedTask}
              onTaskToggle={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                  handleTaskUpdate(taskId, {
                    status: task.status === 'Completed' ? 'To Do' : 'Completed'
                  });
                }
              }}
              selectedTaskId={selectedTask?.id}
            />
          </div>
        </div>

        <div className="task-detail-column">
          <TaskForm
            selectedTask={selectedTask}
            onSubmit={handleTaskSubmit}
            onDelete={handleTaskDelete}
          />
        </div>
      </div>

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content auth-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            <Auth onAuthStateChange={handleAuthStateChange} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;