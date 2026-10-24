import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '../types/Task';
import isEqual from 'lodash/isEqual';
import { useStatusMorph } from '../utils/statusMorph';
import { DueDate } from './DueDate';
import { SubtaskProgress } from './SubtaskProgress';
import { setSubtasksExpanded, useSubtasksExpanded } from '../utils/subtaskExpansion';
import { TaskPosition, placeAt, positionBetween, sortByOrder, stepPosition } from '../utils/taskOrder';

interface KanbanViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onReorder?: (taskId: string, position: number, status?: TaskStatus, others?: TaskPosition[]) => void;
  selectedTaskId?: string;
  // Bulk selection: picked cards, whether select mode is on, and the click
  // handler that returns true when a click selected rather than opened
  bulkSelectedIds?: string[];
  selecting?: boolean;
  onSelectClick?: (task: Task, event: React.MouseEvent | React.KeyboardEvent) => boolean;
  onClearCompleted?: () => void;
}

interface ColumnDefinition {
  id: TaskStatus;
  title: string;
  // Shown in the column while it has no cards
  emptyText: string;
}

const COLUMNS: ColumnDefinition[] = [
  { id: 'To Do', title: 'To Do', emptyText: 'Nothing waiting. New tasks start here.' },
  { id: 'In Progress', title: 'In Progress', emptyText: 'Drag a card here when you start it.' },
  { id: 'Completed', title: 'Completed', emptyText: 'Drag a card here when it’s done.' }
];

const isColumnId = (id: unknown): id is TaskStatus => COLUMNS.some(column => column.id === id);

// What the dragged card is over: the card under the pointer, or else the
// nearest card in the column under the pointer (so the gaps between cards
// still sort), or the column itself when it has no other cards. Falls back to
// whatever the dragged card overlaps most when the pointer is off the board.
const collisionDetection: CollisionDetection = args => {
  const pointerHits = pointerWithin(args);
  const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
  const cardHit = hits.find(hit => !isColumnId(hit.id));
  if (cardHit) return [cardHit];
  const columnHit = hits.find(hit => isColumnId(hit.id));
  if (!columnHit) return hits;
  const cardsInColumn = args.droppableContainers.filter(
    container => container.data.current?.sortable?.containerId === columnHit.id && container.id !== args.active.id
  );
  if (cardsInColumn.length === 0) return [columnHit];
  const nearest = closestCenter({ ...args, droppableContainers: cardsInColumn });
  return nearest.length > 0 ? [nearest[0]] : [columnHit];
};

const columnTitle = (id: unknown) => COLUMNS.find(column => column.id === id)?.title ?? 'a column';

// A column's cards in the order the user set, without subtasks
const columnTasks = (tasks: Task[], status: TaskStatus) =>
  sortByOrder(tasks.filter(task => task.status === status && !task.isSubtask));

// The list with new positions applied
const withPositions = (tasks: Task[], positions: TaskPosition[]) => {
  const byId = new Map(positions.map(item => [item.id, item.position]));
  return tasks.map(task => (byId.has(task.id) ? { ...task, position: byId.get(task.id) } : task));
};

// Moving a card with the keyboard remounts it in its new column, or reorders
// it in this one; this remembers which card should take focus back.
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
  // False for the copy that follows the pointer while dragging
  interactive?: boolean;
}> = ({ task, onTaskSelect, selectedTaskId, interactive = true }) => {
  const subtasks = task.subtasks ?? [];
  // Hidden behind the progress chip until opened (shared with the list)
  const subtasksOpen = useSubtasksExpanded(task.id);
  const subtasksId = `kanban-subtasks-${task.id}`;

  return (
    <>
      <div className="kanban-task-title">{task.title}</div>
      {task.dueDate && (
        <div className="kanban-task-due-date">
          <DueDate dueDate={task.dueDate} completed={task.status === 'Completed'} />
        </div>
      )}

      {subtasks.length > 0 && (
        <div className="kanban-subtask-progress">
          <SubtaskProgress
            subtasks={subtasks}
            expanded={subtasksOpen}
            onToggle={interactive ? () => setSubtasksExpanded(task.id, !subtasksOpen) : undefined}
            controlsId={subtasksId}
          />
        </div>
      )}
      {subtasks.length > 0 && subtasksOpen && (
        <div id={subtasksId} className="kanban-subtasks-container">
          {sortByOrder(subtasks).map(subtask => (
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
};

const KanbanCard: React.FC<{
  task: Task;
  onTaskSelect: (task: Task) => void;
  onMove: (task: Task, step: -1 | 1) => void;
  onReorderKey: (task: Task, step: -1 | 1) => void;
  selectedTaskId?: string;
  isBulkSelected: boolean;
  selecting: boolean;
  onSelectClick?: (task: Task, event: React.MouseEvent | React.KeyboardEvent) => boolean;
}> = ({ task, onTaskSelect, onMove, onReorderKey, selectedTaskId, isBulkSelected, selecting, onSelectClick }) => {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: task.id,
    data: { status: task.status, title: task.title }
  });
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Sweeps the colour strip from the old column's colour after a move
  const morph = useStatusMorph(task.id, task.status);

  // After every render, since moving up or down doesn't remount the card
  useEffect(() => {
    if (cardToRefocus === task.id) {
      cardToRefocus = null;
      cardRef.current?.focus({ preventScroll: true });
      cardRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });

  return (
    <div
      ref={node => {
        setNodeRef(node);
        cardRef.current = node;
      }}
      {...attributes}
      {...listeners}
      data-task-id={task.id}
      data-status={task.status}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onSelectClick?.(task, e)) return;
          onTaskSelect(task);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          cardToRefocus = task.id;
          onMove(task, e.key === 'ArrowRight' ? 1 : -1);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          cardToRefocus = task.id;
          onReorderKey(task, e.key === 'ArrowDown' ? 1 : -1);
        }
      }}
      className={`kanban-task-card ${
        task.id === selectedTaskId ? 'selected' : ''
      } ${task.status === 'Completed' ? 'completed' : ''} ${isDragging ? 'drag-source' : ''} ${isBulkSelected ? 'bulk-selected' : ''} ${morph.className}`}
      aria-pressed={selecting ? isBulkSelected : undefined}
      style={{
        ...morph.style,
        transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
        transition
      }}
      onAnimationEnd={morph.onAnimationEnd}
      // Shift-click selects a range; don't let it select text as well
      onMouseDown={e => e.shiftKey && onSelectClick && e.preventDefault()}
      onClick={(e) => {
        if (onSelectClick?.(task, e)) return;
        onTaskSelect(task);
      }}
    >
      <KanbanCardContent task={task} onTaskSelect={onTaskSelect} selectedTaskId={selectedTaskId} />
    </div>
  );
};

const KanbanColumn: React.FC<{
  column: ColumnDefinition;
  taskIds: string[];
  // Completed only: remove every card in it (with undo)
  onClear?: () => void;
  children: React.ReactNode;
}> = ({ column, taskIds, onClear, children }) => {
  // The column itself is a drop target too, for empty columns and the space below the cards
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div ref={setNodeRef} className="kanban-column">
      <div className="kanban-column-header">
        <h2 className="kanban-column-title">
          <span aria-hidden="true">
            {column.title}
            <span className="section-count">{taskIds.length}</span>
          </span>
          <span className="sr-only">{`${column.title}, ${taskIds.length} task${taskIds.length === 1 ? '' : 's'}`}</span>
        </h2>
        {onClear && taskIds.length > 0 && (
          <button type="button" className="clear-completed-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <SortableContext id={column.id} items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={`kanban-task-list ${isOver ? 'dragging-over' : ''}`}>
          {children}
        </div>
      </SortableContext>
    </div>
  );
};

const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  onTaskSelect,
  onTaskUpdate,
  onReorder,
  selectedTaskId,
  bulkSelectedIds = [],
  selecting = false,
  onSelectClick,
  onClearCompleted
}) => {
  // Add local state to track tasks for optimistic UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  // Screen reader message for moves made with the arrow keys
  const [keyboardAnnouncement, setKeyboardAnnouncement] = useState('');
  // Where the dragged card started, to tell a column change apart and to undo
  // the live move between columns if the drag is cancelled
  const dragOriginRef = useRef<{ status: TaskStatus; index: number; snapshot: Task[] } | null>(null);

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

  // Up or down a place within the column
  const handleKeyboardReorder = (task: Task, step: -1 | 1) => {
    if (!onReorder) return;
    const column = columnTasks(localTasks, task.status);
    const move = stepPosition(column, task.id, step);
    if (!move) {
      cardToRefocus = null;
      setKeyboardAnnouncement(`${task.title} is already ${step < 0 ? 'at the top' : 'at the bottom'} of ${columnTitle(task.status)}.`);
      return;
    }
    setLocalTasks(prev => withPositions(prev, [{ id: task.id, position: move.position }, ...move.others]));
    onReorder(task.id, move.position, undefined, move.others);
    setKeyboardAnnouncement(`${task.title} moved to ${move.index + 1} of ${column.length} in ${columnTitle(task.status)}.`);
  };

  // The column a card or column id belongs to, as things stand mid-drag
  const columnOf = (id: unknown, list: Task[] = localTasks): TaskStatus | undefined =>
    isColumnId(id) ? id : list.find(task => task.id === id)?.status;

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = localTasks.find(t => t.id === active.id);
    setActiveTaskId(String(active.id));
    if (task) {
      dragOriginRef.current = {
        status: task.status,
        index: columnTasks(localTasks, task.status).findIndex(t => t.id === task.id),
        snapshot: localTasks
      };
    }
  };

  // Crossing into another column: move the card there now, so that column
  // opens a gap where it will land
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setLocalTasks(prev => {
      const from = columnOf(active.id, prev);
      const to = columnOf(over.id, prev);
      if (!from || !to || from === to) return prev;
      const target = columnTasks(prev, to);
      let index = isColumnId(over.id) ? target.length : target.findIndex(t => t.id === over.id);
      if (index < 0) index = target.length;
      // Over the lower half of a card: land below it
      const dragged = active.rect.current.translated;
      if (!isColumnId(over.id) && dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2) {
        index += 1;
      }
      // Provisional; worked out properly on drop
      const before = target[index - 1];
      const after = target[index];
      const position = positionBetween(before, after) ?? Date.now();
      return prev.map(t => (t.id === active.id ? { ...t, status: to, position } : t));
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTaskId(null);
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    const id = String(active.id);
    const status = columnOf(id);
    if (!over || !origin || !status) {
      if (origin) setLocalTasks(origin.snapshot);
      return;
    }

    // The column as it is now (the card may already have moved into it)
    const column = columnTasks(localTasks, status);
    const from = column.findIndex(t => t.id === id);
    const overIndex = isColumnId(over.id) ? column.length - 1 : column.findIndex(t => t.id === over.id);
    const ordered = overIndex >= 0 && overIndex !== from ? arrayMove(column, from, overIndex) : column;
    const index = ordered.findIndex(t => t.id === id);

    const statusChanged = status !== origin.status;
    if (!statusChanged && index === origin.index) {
      // Back where it started; drop any provisional position from the drag
      setLocalTasks(origin.snapshot);
      return;
    }

    if (!onReorder) {
      setLocalTasks(origin.snapshot);
      if (statusChanged) moveTask(id, status);
      return;
    }
    const moved = ordered[index];
    const { position, others } = placeAt(ordered.filter(t => t.id !== id), index, moved);
    setLocalTasks(prev => {
      const placed = withPositions(prev, [{ id, position }, ...others]);
      // Completing a parent completes its subtasks too, as App does
      return status === 'Completed'
        ? placed.map(t => (t.id === id && t.subtasks?.length
            ? { ...t, subtasks: t.subtasks.map(sub => ({ ...sub, status: 'Completed' as TaskStatus })) }
            : t))
        : placed;
    });
    onReorder(id, position, statusChanged ? status : undefined, others);
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
    if (dragOriginRef.current) setLocalTasks(dragOriginRef.current.snapshot);
    dragOriginRef.current = null;
  };

  // Screen reader messages, using task and column names instead of ids
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${active.data.current?.title}.`,
    onDragOver: ({ active, over }) =>
      over ? `${active.data.current?.title} is over ${columnTitle(columnOf(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${active.data.current?.title} moved to ${columnTitle(columnOf(active.id))}.`
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
    [column.id]: columnTasks(localTasks, column.id)
  }), {} as Record<TaskStatus, Task[]>);

  const activeTask = activeTaskId ? localTasks.find(t => t.id === activeTaskId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Press Enter to open this task. Press the left or right arrow key to move it to another column, or up and down to change its place in the column.'
        }
      }}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {keyboardAnnouncement}
      </div>
      <div className={`kanban-container ${activeTaskId ? 'is-dragging' : ''}`}>
        <div className="kanban-columns">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              taskIds={tasksByStatus[column.id].map(task => task.id)}
              onClear={column.id === 'Completed' ? onClearCompleted : undefined}
            >
              {tasksByStatus[column.id].length === 0 && (
                <p className="kanban-no-tasks">{column.emptyText}</p>
              )}
              {tasksByStatus[column.id].map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onTaskSelect={handleTaskSelect}
                  onMove={handleKeyboardMove}
                  onReorderKey={handleKeyboardReorder}
                  isBulkSelected={bulkSelectedIds.includes(task.id)}
                  selecting={selecting}
                  onSelectClick={onSelectClick}
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
            <KanbanCardContent task={activeTask} onTaskSelect={() => {}} interactive={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanView;
