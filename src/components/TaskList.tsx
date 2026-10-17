import React, { useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '../types/Task';
import { TaskPosition, placeAt, sortByOrder, stepPosition } from '../utils/taskOrder';
import { TaskCard, TaskCardProps } from './TaskCard';

// Define the interface for TaskListProps
interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskToggle: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  onReorder?: (taskId: string, position: number, status?: TaskStatus, others?: TaskPosition[]) => void;
  selectedTaskId?: string;
}

// Rows only slide up and down
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// A top-level row that can be dragged to a new place in its section
const SortableTaskCard: React.FC<TaskCardProps> = props => {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    data: { title: props.task.title }
  });
  return (
    <TaskCard
      {...props}
      sortable={{
        ref: setNodeRef,
        listeners,
        isDragging,
        style: {
          transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
          transition
        }
      }}
    />
  );
};

// TaskList component definition
export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskSelect,
  onTaskToggle,
  onAddSubtask,
  onReorder,
  selectedTaskId
}) => {
  // Subtasks are shown inside their parent; the rest in the order the user set
  const mainTasks = sortByOrder(tasks.filter(task => !task.isSubtask));
  // Screen reader message for moves made with the keyboard
  const [announcement, setAnnouncement] = useState('');

  // Same as the board: mouse drags start after a small move so clicks still
  // open the task, touch drags after a short press so swiping still scrolls
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!onReorder || !over || active.id === over.id) return;
    const from = mainTasks.findIndex(task => task.id === active.id);
    const to = mainTasks.findIndex(task => task.id === over.id);
    if (from < 0 || to < 0) return;
    const moved = mainTasks[from];
    const { position, others } = placeAt(mainTasks.filter(task => task.id !== moved.id), to, moved);
    onReorder(moved.id, position, undefined, others);
  };

  // Alt+Up or Alt+Down on a row
  const handleKeyboardMove = (task: Task, step: -1 | 1) => {
    if (!onReorder) return;
    const move = stepPosition(mainTasks, task.id, step);
    if (!move) {
      setAnnouncement(`${task.title} is already ${step < 0 ? 'first' : 'last'}.`);
      return;
    }
    onReorder(task.id, move.position, undefined, move.others);
    setAnnouncement(`${task.title} moved to ${move.index + 1} of ${mainTasks.length}.`);
  };

  const titleOf = (id: unknown) => mainTasks.find(task => task.id === id)?.title ?? 'Task';
  const placeOf = (id: unknown) => mainTasks.findIndex(task => task.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is at ${placeOf(over.id)} of ${mainTasks.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} moved to ${placeOf(over.id)} of ${mainTasks.length}.` : `${titleOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`
  };

  const cardProps = (task: Task): TaskCardProps => ({
    task,
    onTaskSelect,
    onTaskToggle,
    onAddSubtask,
    selectedTaskId,
    onKeyboardMove: onReorder && mainTasks.length > 1 ? step => handleKeyboardMove(task, step) : undefined
  });

  return (
    <div className="task-list">
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      {onReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements }}
        >
          <SortableContext items={mainTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
            {mainTasks.map(task => (
              <SortableTaskCard key={task.id} {...cardProps(task)} />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        mainTasks.map(task => <TaskCard key={task.id} {...cardProps(task)} />)
      )}
      {mainTasks.length === 0 && (
        <div className="no-tasks">No tasks in this section</div>
      )}
    </div>
  );
};
