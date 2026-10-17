import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { Task, TaskStatus } from '../types/Task';
import { isEqual } from 'lodash';

interface KanbanViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  selectedTaskId?: string;
}

interface ColumnDefinition {
  id: TaskStatus;
  title: string;
}

const COLUMNS: ColumnDefinition[] = [
  { id: 'To Do', title: 'To Do' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'Completed', title: 'Completed' }
];

// Prefer the column under the pointer, falling back to whichever column the
// dragged card overlaps most.
const collisionDetection: CollisionDetection = args => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : rectIntersection(args);
};

const columnTitle = (id: unknown) => COLUMNS.find(column => column.id === id)?.title ?? 'a column';

// Moving a card with the keyboard remounts it in its new column; this
// remembers which card should take focus back.
let cardToRefocus: string | null = null;

// Subtasks listed inside a Kanban card
const SubtaskItem: React.FC<{
  subtask: Task;
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
}> = ({ subtask, onTaskSelect, selectedTaskId }) => {
  return (
    <button
      type="button"
      className={`kanban-subtask-item ${subtask.id === selectedTaskId ? 'selected' : ''} ${subtask.status === 'Completed' ? 'completed' : ''}`}
      data-status={subtask.status}
      onClick={(e) => {
        e.stopPropagation();
        onTaskSelect(subtask);
      }}
      // Keep Enter and Space for the subtask, not the card it sits in
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="kanban-subtask-title">{subtask.title}</span>
    </button>
  );
};

const KanbanCardContent: React.FC<{
  task: Task;
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
}> = ({ task, onTaskSelect, selectedTaskId }) => (
  <>
    <div className="kanban-task-title">{task.title}</div>
    {task.dueDate && (
      <div className="kanban-task-due-date">
        {new Date(task.dueDate).toLocaleDateString()}
      </div>
    )}

    {/* Display subtasks if they exist */}
    {task.subtasks && task.subtasks.length > 0 && (
      <div className="kanban-subtasks-container">
        <div className="kanban-subtasks-header">Subtasks:</div>
        {task.subtasks.map(subtask => (
          <SubtaskItem
            key={subtask.id}
            subtask={subtask}
            onTaskSelect={onTaskSelect}
            selectedTaskId={selectedTaskId}
          />
        ))}
      </div>
    )}
  </>
);

const KanbanCard: React.FC<{
  task: Task;
  onTaskSelect: (task: Task) => void;
  onMove: (task: Task, step: -1 | 1) => void;
  selectedTaskId?: string;
}> = ({ task, onTaskSelect, onMove, selectedTaskId }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status, title: task.title }
  });
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (cardToRefocus === task.id) {
      cardToRefocus = null;
      cardRef.current?.focus({ preventScroll: true });
      cardRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [task.id]);

  return (
    <div
      ref={node => {
        setNodeRef(node);
        cardRef.current = node;
      }}
      {...attributes}
      {...listeners}
      data-task-id={task.id}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTaskSelect(task);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          cardToRefocus = task.id;
          onMove(task, e.key === 'ArrowRight' ? 1 : -1);
        }
      }}
      className={`kanban-task-card ${
        task.id === selectedTaskId ? 'selected' : ''
      } ${task.status === 'Completed' ? 'completed' : ''} ${isDragging ? 'drag-source' : ''}`}
      onClick={() => onTaskSelect(task)}
    >
      <KanbanCardContent task={task} onTaskSelect={onTaskSelect} selectedTaskId={selectedTaskId} />
    </div>
  );
};

const KanbanColumn: React.FC<{
  column: ColumnDefinition;
  children: React.ReactNode;
}> = ({ column, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div ref={setNodeRef} className="kanban-column">
      <h2 className="kanban-column-title">{column.title}</h2>
      <div className={`kanban-task-list ${isOver ? 'dragging-over' : ''}`}>
        {children}
      </div>
    </div>
  );
};

const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  onTaskSelect,
  onTaskUpdate,
  selectedTaskId
}) => {
  // Add local state to track tasks for optimistic UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  // Screen reader message for moves made with the arrow keys
  const [keyboardAnnouncement, setKeyboardAnnouncement] = useState('');

  // Update local tasks when props change. The functional update reads the
  // previous value without adding localTasks to the dependency array, and the
  // deep comparison avoids a re-render when an equal array arrives.
  useEffect(() => {
    setLocalTasks(prev => (isEqual(tasks, prev) ? prev : tasks));
  }, [tasks]);

  // Mouse drags start after a small move so clicks still open the task. Touch
  // drags need a short press so swiping still scrolls between columns.
  // Keyboard users move cards with the arrow keys instead (see KanbanCard).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    const task = localTasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      // Optimistic UI update - immediately update the local state
      const updatedLocalTasks = localTasks.map(t => {
        // Update the task being dragged
        if (t.id === taskId) {
          // If this is a parent task being completed, also update its subtasks
          if (newStatus === 'Completed' && t.subtasks && t.subtasks.length > 0) {
            return {
              ...t,
              status: newStatus,
              subtasks: t.subtasks.map(subtask => ({
                ...subtask,
                status: 'Completed' as TaskStatus
              }))
            };
          }

          // Regular task update
          return { ...t, status: newStatus };
        }

        return t;
      });

      // Update local state immediately for responsive UI
      setLocalTasks(updatedLocalTasks);

      // Call the parent component's update function to persist changes
      // This happens asynchronously, so the UI is already updated
      setTimeout(() => {
        onTaskUpdate(taskId, { status: newStatus });
      }, 0);
    }
  };

  // Arrow-key move to the neighbouring column
  const handleKeyboardMove = (task: Task, step: -1 | 1) => {
    const target = COLUMNS[COLUMNS.findIndex(column => column.id === task.status) + step];
    if (!target) {
      cardToRefocus = null;
      setKeyboardAnnouncement(`${task.title} is already in the ${step > 0 ? 'last' : 'first'} column.`);
      return;
    }
    moveTask(task.id, target.id);
    setKeyboardAnnouncement(`${task.title} moved to ${target.title}.`);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveTaskId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTaskId(null);
    if (over) {
      moveTask(String(active.id), over.id as TaskStatus);
    }
  };

  // Screen reader messages, using task and column names instead of ids
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${active.data.current?.title}.`,
    onDragOver: ({ active, over }) =>
      over ? `${active.data.current?.title} is over ${columnTitle(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${active.data.current?.title} moved to ${columnTitle(over.id)}.`
        : `${active.data.current?.title} dropped.`,
    onDragCancel: ({ active }) => `Moving ${active.data.current?.title} was cancelled.`
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

  // Modified onTaskSelect to use localTasks
  const handleTaskSelect = (task: Task) => {
    // Find the most up-to-date version of the task from localTasks
    const currentTask = findTaskById(localTasks, task.id);
    if (currentTask) {
      onTaskSelect(currentTask);
    } else {
      onTaskSelect(task);
    }
  };

  // Organize tasks by status - filter out subtasks from main list
  // Use localTasks instead of tasks for immediate UI updates
  const tasksByStatus = COLUMNS.reduce((acc, column) => ({
    ...acc,
    [column.id]: localTasks.filter(task => task.status === column.id && !task.isSubtask)
  }), {} as Record<TaskStatus, Task[]>);

  const activeTask = activeTaskId ? localTasks.find(t => t.id === activeTaskId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Press Enter to open this task. Press the left or right arrow key to move it to another column.'
        }
      }}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {keyboardAnnouncement}
      </div>
      <div className={`kanban-container ${activeTaskId ? 'is-dragging' : ''}`}>
        <div className="kanban-columns">
          {COLUMNS.map((column) => (
            <KanbanColumn key={column.id} column={column}>
              {tasksByStatus[column.id].length === 0 && (
                <div className="kanban-no-tasks">No tasks in this column</div>
              )}
              {tasksByStatus[column.id].map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onTaskSelect={handleTaskSelect}
                  onMove={handleKeyboardMove}
                  selectedTaskId={selectedTaskId}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </div>

      {/* Copy of the card that follows the pointer, drawn above the columns
          so the scrolling board can't clip it */}
      <DragOverlay>
        {activeTask && (
          <div className="kanban-task-card dragging" data-status={activeTask.status}>
            <KanbanCardContent task={activeTask} onTaskSelect={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanView;
