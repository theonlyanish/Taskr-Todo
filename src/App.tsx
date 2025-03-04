import React, { useState, useEffect } from 'react';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { ThemeToggle } from './components/ThemeToggle';
import { Auth } from './components/Auth';
import { SyncIndicator } from './components/SyncIndicator';
import KanbanView from './components/KanbanView';
import { CalendarView } from './components/CalendarView';
import { SupabaseTaskService } from './services/supabaseTaskService';
import { AuthService } from './services/authService';
import { Task, TaskStatus } from './types/Task';
import { User } from '@supabase/supabase-js';
import { loadTasks, addTask, updateTask, deleteTask } from './utils/taskOperations';
import { MantineProvider } from '@mantine/core';
import './styles.css';
import { getPresetTasks, hasSeenPresetTasks, markPresetTasksAsSeen, resetPresetTasksState } from './utils/presetTasks';
import { offlineStorage } from './utils/offlineStorage';

// Add this type definition at the top of the file
type ViewType = 'normal' | 'kanban' | 'calendar';

// Add this function before the App component
const updateTaskAndParents = (tasks: Task[], taskId: string, updates: Partial<Task>): Task[] => {
  return tasks.map(task => {
    if (task.subtasks) {
      const updatedSubtasks = updateTaskAndParents(task.subtasks, taskId, updates);
      
      // Check if any subtask was updated
      const updatedSubtask = updatedSubtasks.find(st => st.id === taskId);
      
      if (updatedSubtask) {
        // If the updated task is a subtask being changed to "In Progress" or "Completed", 
        // and the parent is in "To Do", move the parent to "In Progress"
        if ((updates.status === 'In Progress' || updates.status === 'Completed') && task.status === 'To Do') {
          return {
            ...task,
            subtasks: updatedSubtasks,
            status: 'In Progress' as TaskStatus
          };
        }
        
        // Don't change the parent's section, just update its subtasks
        return {
          ...task,
          subtasks: updatedSubtasks
        };
      }
      
      return {
        ...task,
        subtasks: updatedSubtasks
      };
    }
    
    if (task.id === taskId) {
      return { ...task, ...updates };
    }
    return task;
  });
};

function App() {
  const [tasks, setTasks] = useState<Task[]>([] as Task[]);
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
  const [newSubtaskParentId, setNewSubtaskParentId] = useState<string | null>(null);

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
      
      try {
        let loadedTasks: Task[] = [];
        
        if (currentUser) {
          // If user is logged in, load tasks from Supabase
          loadedTasks = await SupabaseTaskService.getTasks();
          console.log('Tasks loaded from Supabase:', loadedTasks);
        } else {
          // If not logged in, try to load from local storage
          loadedTasks = await loadTasks();
        }

        // Only load preset tasks if there are no existing tasks and they haven't been seen
        if (loadedTasks.length === 0 && !hasSeenPresetTasks()) {
          const presetTasks = getPresetTasks().map(task => {
            const taskId = crypto.randomUUID();
            return {
              ...task,
              id: taskId,
              createdAt: new Date(),
              updatedAt: new Date(),
              subtasks: task.subtasks?.map(subtask => ({
                ...subtask,
                id: crypto.randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date(),
                isSubtask: true,
                parentId: taskId
              })) || []
            };
          });
          
          setTasks(presetTasks);
          markPresetTasksAsSeen();
          // Save preset tasks to offline storage to prevent them from disappearing
          await offlineStorage.saveTasks(presetTasks);
        } else if (loadedTasks.length > 0) {
          // Only set tasks if we actually have tasks to set
          setTasks(loadedTasks);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
        // Fallback to local storage if Supabase fails
        const localTasks = await loadTasks();
        if (localTasks.length > 0) {
          setTasks(localTasks);
        }
      }
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

  const handleAddSubtask = async (parentId: string) => {
    const parentTask = tasks.find(t => t.id === parentId);
    if (!parentTask) return;

    console.log('Adding subtask for parent:', parentId, parentTask);
    
    // Clear selected task and set the parent ID for the new subtask
    setSelectedTask(null);
    setNewSubtaskParentId(parentId);
  };

  const handleTaskSubmit = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    
    // If this is a subtask, find the parent task to inherit its status
    let status = taskData.status;
    if (newSubtaskParentId || taskData.parentId) {
      const parentId = newSubtaskParentId || taskData.parentId;
      const parentTask = findTaskById(tasks, parentId!);
      if (parentTask) {
        // Inherit parent's status unless explicitly set otherwise
        status = taskData.status === 'To Do' ? parentTask.status : taskData.status;
      }
    }
    
    const newTask: Task = {
      ...taskData,
      status,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      // If newSubtaskParentId exists, this is a subtask
      parentId: newSubtaskParentId || taskData.parentId,
      isSubtask: !!(newSubtaskParentId || taskData.parentId),
      subtasks: []
    };

    try {
      // Save the task to Supabase
      const savedTask = await SupabaseTaskService.saveTask(newTask);
      console.log('Task saved to Supabase:', savedTask);
      
      if (newSubtaskParentId || taskData.parentId) {
        // This is a subtask - add it to the parent's subtasks array
        const parentId = newSubtaskParentId || taskData.parentId;
        const updatedTasks = tasks.map(task => {
          if (task.id === parentId) {
            return {
              ...task,
              subtasks: [...(task.subtasks || []), newTask]
            };
          }
          return task;
        });
        setTasks(updatedTasks);
      } else {
        // This is a main task
        setTasks([...tasks, newTask]);
      }
    } catch (error) {
      console.error('Error saving task:', error);
      // Handle the error (e.g., show a notification)
    }
    
      setSelectedTask(null);
    setNewSubtaskParentId(null); // Reset the parent ID
  };

  // Helper function to update a task and all its subtasks
  const updateTaskWithSubtasks = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Find the task
      const taskToUpdate = findTaskById(tasks, taskId);
      if (!taskToUpdate) return;
      
      // If we're completing a parent task, also complete all subtasks
      if (updates.status === 'Completed' && taskToUpdate.subtasks && taskToUpdate.subtasks.length > 0) {
        console.log('Completing parent task and all subtasks:', taskId);
        
        // First update the parent task
        await SupabaseTaskService.updateTask(taskId, {
          ...updates
        });
        
        // Then update all subtasks
        const subtaskUpdatePromises = taskToUpdate.subtasks.map(subtask => 
          SupabaseTaskService.updateTask(subtask.id, { status: 'Completed' as TaskStatus })
        );
        
        await Promise.all(subtaskUpdatePromises);
        
        // Update local state
        const updatedTasks = tasks.map(task => {
          if (task.id === taskId) {
            // Update the parent task
            const updatedTask = { 
              ...task, 
              ...updates,
              updatedAt: new Date(),
              subtasks: task.subtasks?.map(subtask => ({
                ...subtask,
                status: 'Completed' as TaskStatus,
                updatedAt: new Date()
              }))
            };
            return updatedTask;
          }
          return task;
        });
        
        setTasks(updatedTasks);
      } else {
        // Regular update for a single task
        await SupabaseTaskService.updateTask(taskId, {
          ...updates
        });
        
        // Update the task in the local state
        const updatedTasks = updateTaskAndParents(tasks, taskId, {
          ...updates,
          updatedAt: new Date()
        });
        setTasks(updatedTasks);
      }
    } catch (error) {
      console.error('Error updating task with subtasks:', error);
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Find the task to check if it's a subtask
      const taskToUpdate = findTaskById(tasks, taskId);
      if (!taskToUpdate) {
        console.error('Task not found:', taskId);
        return;
      }
      
      // Always update the UI immediately for any status change
      if (updates.status && taskToUpdate.status !== updates.status) {
        console.log('Updating task status immediately:', taskId, updates.status);
        
        // Create an optimistic update for the UI
        const updatedTasks = tasks.map(t => {
          // If this is the task being updated directly
          if (t.id === taskId) {
            // If this is a parent task being completed, also update its subtasks
            if (updates.status === 'Completed' && t.subtasks && t.subtasks.length > 0) {
              return {
                ...t,
                ...updates,
                updatedAt: new Date(),
                subtasks: t.subtasks.map(subtask => ({
                  ...subtask,
                  status: 'Completed' as TaskStatus,
                  updatedAt: new Date()
                }))
              };
            }
            
            // Regular task update
            return { ...t, ...updates, updatedAt: new Date() };
          }
          
          // If this task has subtasks, check if any of them match the taskId
          if (t.subtasks && t.subtasks.length > 0) {
            const hasUpdatedSubtask = t.subtasks.some(subtask => subtask.id === taskId);
            
            if (hasUpdatedSubtask) {
              const updatedSubtasks = t.subtasks.map(subtask => {
                if (subtask.id === taskId) {
                  // This is the subtask being updated
                  return { ...subtask, ...updates, updatedAt: new Date() };
                }
                return subtask;
              });
              
              // If a subtask is being changed to "In Progress" or "Completed" and the parent is in "To Do",
              // automatically move the parent to "In Progress"
              if (
                taskToUpdate.isSubtask && 
                (updates.status === 'In Progress' || updates.status === 'Completed') && 
                t.status === 'To Do'
              ) {
                return { 
                  ...t, 
                  status: 'In Progress' as TaskStatus, 
                  subtasks: updatedSubtasks,
                  updatedAt: new Date()
                };
              }
              
              // Otherwise just update the subtasks
              return { ...t, subtasks: updatedSubtasks };
            }
          }
          
          return t;
        });
        
        // Update the UI immediately
        setTasks(updatedTasks);
        
        // Then update the database asynchronously
        setTimeout(async () => {
          try {
            if (taskToUpdate.isSubtask) {
              // For subtasks, update the status
              await SupabaseTaskService.updateTask(taskId, {
                ...updates
              });
              
              // If the subtask is being changed to "In Progress" or "Completed" and the parent is in "To Do",
              // also update the parent task status in the database
              const parentTask = tasks.find(t => t.subtasks?.some(subtask => subtask.id === taskId));
              if (
                parentTask && 
                (updates.status === 'In Progress' || updates.status === 'Completed') && 
                parentTask.status === 'To Do'
              ) {
                await SupabaseTaskService.updateTask(parentTask.id, { 
                  status: 'In Progress' as TaskStatus 
                });
              }
            } else if (updates.status === 'Completed' && taskToUpdate.subtasks && taskToUpdate.subtasks.length > 0) {
              // For parent tasks being completed, also complete all subtasks in the database
              await SupabaseTaskService.updateTask(taskId, {
                ...updates
              });
              
              // Update all subtasks in the database
              const subtaskUpdatePromises = taskToUpdate.subtasks.map(subtask => 
                SupabaseTaskService.updateTask(subtask.id, { status: 'Completed' as TaskStatus })
              );
              
              await Promise.all(subtaskUpdatePromises);
            } else {
              // Regular update for a task without subtasks
              await SupabaseTaskService.updateTask(taskId, {
                ...updates
              });
            }
          } catch (error) {
            console.error('Error updating task in database:', error);
          }
        }, 0);
      } else {
        // For non-status updates or if status hasn't changed
        if (taskToUpdate.isSubtask) {
          console.log('Updating subtask:', taskId, updates);
          
          // Update the task in the local state first - ensure subtask is updated in parent's array
          const updatedTasks = tasks.map(t => {
            // Check if this task has the subtask we're updating
            if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
              return {
                ...t,
                subtasks: t.subtasks.map(subtask => 
                  subtask.id === taskId 
                    ? { ...subtask, ...updates, updatedAt: new Date() }
                    : subtask
                )
              };
            }
            
            // Also handle direct match (for the updateTaskAndParents function)
            if (t.id === taskId) {
              return { ...t, ...updates, updatedAt: new Date() };
            }
            
            return t;
          });
          
          setTasks(updatedTasks);
          
          // Then update in Supabase
          const updatedTask = await SupabaseTaskService.updateTask(taskId, {
            ...updates
          });
          console.log('Subtask updated in Supabase:', updatedTask);
        } else if (updates.status === 'Completed' && taskToUpdate.subtasks && taskToUpdate.subtasks.length > 0) {
          // If we're completing a parent task with subtasks, use the special function
          await updateTaskWithSubtasks(taskId, updates);
        } else {
          // Regular update for a task without subtasks
          
          // Update the task in the local state first
          const updatedTasks = updateTaskAndParents(tasks, taskId, {
            ...updates,
            updatedAt: new Date()
          });
          setTasks(updatedTasks);
          
          // Then update in Supabase
          const updatedTask = await SupabaseTaskService.updateTask(taskId, {
            ...updates
          });
          console.log('Task updated in Supabase:', updatedTask);
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
      // Handle the error (e.g., show a notification)
    }
    
      setSelectedTask(null);
  };

  // Helper function to find a task by ID (including in subtasks)
  const findTaskById = (taskList: Task[], id: string): Task | undefined => {
    for (const task of taskList) {
      if (task.id === id) {
        return task;
      }
      if (task.subtasks && task.subtasks.length > 0) {
        const found = findTaskById(task.subtasks, id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      // Delete the task from Supabase
      const success = await SupabaseTaskService.deleteTask(taskId);
      console.log('Task deleted from Supabase:', success);
      
    if (success) {
        // Remove the task from the local state
        const updatedTasks = tasks.filter(task => task.id !== taskId);
        setTasks(updatedTasks);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      // Fallback to local delete if Supabase fails
      const updatedTasks = await deleteTask(taskId, tasks);
      setTasks(updatedTasks);
    }
    
    setSelectedTask(null);
  };

  const handleSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const loadedTasks = await SupabaseTaskService.getTasks();
      console.log('Tasks synced from Supabase:', loadedTasks);
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

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTask(null); // Clear selected task when selecting a new date
  };

  const handleResetPresetTasks = async () => {
    // Clear everything first
    resetPresetTasksState();
    setTasks([]);
    setSelectedTask(null);
    
    // Generate new preset tasks
    const presetTasks = getPresetTasks().map(task => {
      const taskId = crypto.randomUUID();
      return {
        ...task,
        id: taskId,
        createdAt: new Date(),
        updatedAt: new Date(),
        subtasks: task.subtasks?.map(subtask => ({
          ...subtask,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isSubtask: true,
          parentId: taskId
        })) || []
      };
    });
    
    // Clear local storage tasks
    await offlineStorage.saveTasks([]);
    
    // Set the new preset tasks
    setTasks(presetTasks);
  };

  return (
    <MantineProvider>
      <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
        <header className="app-header">
          <div className="header">
            <img src="/Logo.png" alt="Taskr Logo" />
            <h1>Taskr</h1>
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
                      const task = findTaskById(tasks, taskId);
                      if (task) {
                        // Optimistic UI update - immediately update the local state
                        const updatedTasks = tasks.map(t => {
                          // Direct match for the task being toggled
                          if (t.id === taskId) {
                            // If this is a parent task being completed, also update its subtasks
                            if (t.subtasks && t.subtasks.length > 0) {
                              return {
                                ...t,
                                status: 'Completed' as TaskStatus,
                                subtasks: t.subtasks.map(subtask => ({
                                  ...subtask,
                                  status: 'Completed' as TaskStatus
                                }))
                              };
                            }
                            
                            // Regular task update
                            return { ...t, status: 'Completed' as TaskStatus };
                          }
                          
                          // If this is a parent task that contains the subtask being toggled
                          if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
                            // If a subtask is being completed and the parent is in "To Do",
                            // move the parent to "In Progress"
                            return {
                              ...t,
                              status: 'In Progress' as TaskStatus,
                              subtasks: t.subtasks.map(subtask => 
                                subtask.id === taskId 
                                  ? { ...subtask, status: 'Completed' as TaskStatus }
                                  : subtask
                              )
                            };
                          }
                          
                          return t;
                        });
                        
                        // Update the UI immediately
                        setTasks(updatedTasks);
                        
                        // Then update the backend
                        setTimeout(() => {
                          handleTaskUpdate(taskId, { status: 'Completed' });
                        }, 0);
                      }
                    }}
                    onAddSubtask={handleAddSubtask}
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
                      const task = findTaskById(tasks, taskId);
                      if (task) {
                        // Optimistic UI update - immediately update the local state
                        const updatedTasks = tasks.map(t => {
                          // Direct match for the task being toggled
                          if (t.id === taskId) {
                            // If this is a parent task being completed, also update its subtasks
                            if (t.subtasks && t.subtasks.length > 0) {
                              return {
                                ...t,
                                status: 'Completed' as TaskStatus,
                                subtasks: t.subtasks.map(subtask => ({
                                  ...subtask,
                                  status: 'Completed' as TaskStatus
                                }))
                              };
                            }
                            
                            // Regular task update
                            return { ...t, status: 'Completed' as TaskStatus };
                          }
                          
                          // If this is a parent task that contains the subtask being toggled
                          if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
                            return {
                              ...t,
                              subtasks: t.subtasks.map(subtask => 
                                subtask.id === taskId 
                                  ? { ...subtask, status: 'Completed' as TaskStatus }
                                  : subtask
                              )
                            };
                          }
                          
                          return t;
                        });
                        
                        // Update the UI immediately
                        setTasks(updatedTasks);
                        
                        // Then update the backend
                        setTimeout(() => {
                          handleTaskUpdate(taskId, { status: 'Completed' });
                        }, 0);
                      }
                    }}
                    onAddSubtask={handleAddSubtask}
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
                      const task = findTaskById(tasks, taskId);
                      if (task) {
                        // Optimistic UI update - immediately update the local state
                        const updatedTasks = tasks.map(t => {
                          // Direct match for the task being toggled
                          if (t.id === taskId) {
                            // If this is a parent task being uncompleted, don't change subtasks
                            return { ...t, status: 'To Do' as TaskStatus };
                          }
                          
                          // If this is a parent task that contains the subtask being toggled
                          if (t.subtasks && t.subtasks.some(subtask => subtask.id === taskId)) {
                            return {
                              ...t,
                              subtasks: t.subtasks.map(subtask => 
                                subtask.id === taskId 
                                  ? { ...subtask, status: 'To Do' as TaskStatus }
                                  : subtask
                              )
                            };
                          }
                          
                          return t;
                        });
                        
                        // Update the UI immediately
                        setTasks(updatedTasks);
                        
                        // Then update the backend
                        setTimeout(() => {
                          handleTaskUpdate(taskId, { status: 'To Do' });
                        }, 0);
                      }
                    }}
                    onAddSubtask={handleAddSubtask}
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
                  parentId={newSubtaskParentId}
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
                  parentId={newSubtaskParentId}
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
                  parentId={newSubtaskParentId}
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
    </MantineProvider>
  );
}

export default App;