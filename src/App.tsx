import React, { useState, useEffect } from 'react';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { ThemeToggle } from './components/ThemeToggle';
import { Auth } from './components/Auth';
import { SyncIndicator } from './components/SyncIndicator';
import KanbanView from './components/KanbanView';
import { CalendarView } from './components/CalendarView';
import { TaskService } from './services/taskService';
import { AuthService } from './services/authService';
import { Task } from './types/Task';
import { User } from '@supabase/supabase-js';
import { loadTasks, addTask, updateTask, deleteTask } from './utils/taskOperations';
import { MantineProvider } from '@mantine/core';
import './styles.css';
import { DragDropContext } from 'react-beautiful-dnd';

// Add this type definition at the top of the file
type ViewType = 'normal' | 'kanban' | 'calendar';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode is enabled based on local storage
    return localStorage.getItem('theme') === 'dark';
  });
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('normal');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      
      const loadedTasks = await loadTasks();
      setTasks(loadedTasks);
    };

    loadInitialData();

    // Subscribe to auth changes
    const { data: { subscription } } = AuthService.subscribeToAuthChanges((user) => {
      setUser(user);
    });

    // Set up online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAddNewTask = () => {
    setSelectedTask(null);
  };

  const handleTaskSubmit = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    
    const updatedTasks = await addTask(newTask, tasks);
    setTasks(updatedTasks);
    setSelectedTask(null);
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask: Task = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };

    const updatedTasks = await updateTask(updatedTask, tasks);
    setTasks(updatedTasks);
    setSelectedTask(null);
  };

  const handleTaskDelete = async (taskId: string) => {
    const updatedTasks = await deleteTask(taskId, tasks);
    setTasks(updatedTasks);
    setSelectedTask(null);
  };

  const handleSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const loadedTasks = await loadTasks();
      setTasks(loadedTasks);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
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
    const localTasks = await loadTasks();
    setTasks(localTasks);
  };

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    // Drop outside a droppable area
    if (!destination) return;

    // No movement
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    let newStatus: 'To Do' | 'In Progress' | 'Completed';
    switch (destination.droppableId) {
      case 'todo-list':
        newStatus = 'To Do';
        break;
      case 'in-progress-list':
        newStatus = 'In Progress';
        break;
      case 'completed-list':
        newStatus = 'Completed';
        break;
      default:
        return;
    }

    handleTaskUpdate(draggableId, { status: newStatus });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTask(null); // Clear selected task when selecting a new date
  };

  return (
    <MantineProvider>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
          <header className="app-header">
            <div className="header">
              <h1>Task Manager</h1>
            </div>
            <div className="header-controls">
              <SyncIndicator
                isOnline={isOnline}
                isSyncing={isSyncing}
                onSync={handleSync}
              />
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

          <div className="view-selector-container">
            <select 
              className="view-selector"
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
            >
              <option value="normal">Normal View</option>
              <option value="kanban">Kanban View</option>
              <option value="calendar">Calendar View</option>
            </select>
          </div>

          <div className={`main-content ${
            viewType === 'kanban' ? 'kanban-layout' : 
            viewType === 'calendar' ? 'calendar-layout' : ''
          }`}>
            {viewType === 'normal' && (
              <>
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
                    onUpdate={handleTaskUpdate}
                    onDelete={handleTaskDelete}
                  />
                </div>
              </>
            )}
            {viewType === 'kanban' && (
              <>
                <KanbanView
                  tasks={tasks}
                  onTaskSelect={setSelectedTask}
                  onTaskUpdate={handleTaskUpdate}
                  selectedTaskId={selectedTask?.id}
                />
                <div className="task-detail-column">
                  <TaskForm
                    selectedTask={selectedTask}
                    onSubmit={handleTaskSubmit}
                    onUpdate={handleTaskUpdate}
                    onDelete={handleTaskDelete}
                  />
                </div>
              </>
            )}
            {viewType === 'calendar' && (
              <>
                <CalendarView
                  tasks={tasks}
                  onTaskSelect={setSelectedTask}
                  selectedTaskId={selectedTask?.id}
                  onDateSelect={handleDateSelect}
                />
                <div className="task-detail-column">
                  <TaskForm
                    selectedTask={selectedTask}
                    onSubmit={handleTaskSubmit}
                    onUpdate={handleTaskUpdate}
                    onDelete={handleTaskDelete}
                    initialDueDate={selectedDate}
                  />
                </div>
              </>
            )}
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
      </DragDropContext>
    </MantineProvider>
  );
}

export default App;