import React, { useEffect, useRef } from 'react';
import { Task } from '../types/Task';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable, DropArg } from '@fullcalendar/interaction';

interface CalendarViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  selectedTaskId?: string;
  onDateSelect?: (date: Date) => void;
}

// Due dates are stored as midnight UTC, so convert a calendar day (local
// midnight) to that form before saving it.
const toUtcDate = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onTaskSelect,
  onTaskUpdate,
  selectedTaskId,
  onDateSelect
}) => {
  const calendarRef = useRef<any>(null);
  const selectedDateRef = useRef<string | null>(null);
  const unscheduledRef = useRef<HTMLDivElement>(null);

  // Every task and subtask, each subtask straight after its parent
  const allTasks = tasks
    .filter(task => !task.isSubtask)
    .flatMap(task => [
      { task, parentTitle: undefined as string | undefined },
      ...(task.subtasks || []).map(subtask => ({ task: subtask, parentTitle: task.title }))
    ]);

  // Open tasks and subtasks with no due date; these go in the tray above the calendar
  const unscheduledTasks = allTasks.filter(
    ({ task }) => !task.dueDate && task.status !== 'Completed'
  );
  const hasUnscheduled = unscheduledTasks.length > 0;

  const events = allTasks
    .filter(({ task }) => task.dueDate)
    .map(({ task, parentTitle }) => ({
      id: task.id,
      title: task.title,
      // A plain YYYY-MM-DD all-day date keeps the task on the same day in every timezone
      start: new Date(task.dueDate!).toISOString().split('T')[0],
      allDay: true,
      classNames: [
        `calendar-task-${task.status.toLowerCase().replace(' ', '-')}`,
        parentTitle ? 'calendar-subtask' : '',
        task.id === selectedTaskId ? 'selected' : ''
      ],
      extendedProps: {
        task,
        parentTitle
      }
    }));

  // Let tray items be dragged onto calendar days. create: false stops
  // FullCalendar adding its own event; the task re-renders from state instead.
  useEffect(() => {
    if (!hasUnscheduled || !unscheduledRef.current) return;
    const draggable = new Draggable(unscheduledRef.current, {
      itemSelector: '.calendar-unscheduled-item',
      minDistance: 5,
      eventData: el => ({ title: el.dataset.title, create: false })
    });
    return () => draggable.destroy();
  }, [hasUnscheduled]);

  const handleEventClick = (info: any) => {
    onTaskSelect(info.event.extendedProps.task);
  };

  // FullCalendar renders events as links without an href, which the keyboard
  // skips. Make each one focusable and open it with Enter or Space.
  const handleEventDidMount = ({ el, event }: { el: HTMLElement; event: { title: string; extendedProps: { parentTitle?: string } } }) => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    // Name the parent of a subtask, since the event only shows its own title
    const { parentTitle } = event.extendedProps;
    if (parentTitle) {
      el.setAttribute('title', `Subtask of ${parentTitle}`);
      el.setAttribute('aria-label', `${event.title}, subtask of ${parentTitle}`);
    }
    el.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.click();
      }
    });
  };

  // An event already on the calendar was dragged to another day
  const handleEventDrop = (info: { event: { id: string; start: Date | null } }) => {
    if (info.event.start) {
      onTaskUpdate(info.event.id, { dueDate: toUtcDate(info.event.start) });
    }
  };

  // A task from the unscheduled tray was dropped on a day
  const handleExternalDrop = (info: DropArg) => {
    const taskId = info.draggedEl.dataset.taskId;
    if (taskId) {
      onTaskUpdate(taskId, { dueDate: toUtcDate(info.date) });
    }
  };

  const handleDateClick = (info: { date: Date; dayEl: HTMLElement }) => {
    if (onDateSelect) {
      // Remove previous selection
      if (selectedDateRef.current) {
        const prevSelected = document.querySelector('.fc-day.selected-date');
        prevSelected?.classList.remove('selected-date');
      }

      // Add selection to clicked date
      info.dayEl.classList.add('selected-date');
      selectedDateRef.current = info.date.toISOString();

      onDateSelect(toUtcDate(info.date));
    }
  };

  // Clear selection when switching months
  useEffect(() => {
    const calendar = calendarRef.current;
    if (calendar) {
      const api = calendar.getApi();
      api.on('datesSet', () => {
        const prevSelected = document.querySelector('.fc-day.selected-date');
        if (prevSelected) {
          prevSelected.classList.remove('selected-date');
          selectedDateRef.current = null;
        }
      });
    }
  }, []);

  return (
    <div className="calendar-container">
      {hasUnscheduled && (
        <div className="calendar-unscheduled">
          <div className="calendar-unscheduled-header">
            <span className="calendar-unscheduled-title">
              Unscheduled · {unscheduledTasks.length}
            </span>
            <span className="calendar-unscheduled-hint">Drag onto a day to set a due date</span>
          </div>
          <div className="calendar-unscheduled-list" ref={unscheduledRef}>
            {unscheduledTasks.map(({ task, parentTitle }) => (
              <button
                type="button"
                key={task.id}
                className={`calendar-unscheduled-item ${parentTitle ? 'subtask' : ''} ${task.id === selectedTaskId ? 'selected' : ''}`}
                data-task-id={task.id}
                data-title={task.title}
                data-status={task.status}
                title={parentTitle ? `Subtask of ${parentTitle}` : undefined}
                aria-label={parentTitle ? `${task.title}, subtask of ${parentTitle}` : undefined}
                onClick={() => onTaskSelect(task)}
              >
                {parentTitle && (
                  <span className="calendar-unscheduled-parent" aria-hidden="true">
                    {parentTitle} ›{' '}
                  </span>
                )}
                {task.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="calendar-grid">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventClick={handleEventClick}
          eventDidMount={handleEventDidMount}
          dateClick={handleDateClick}
          editable={true}
          eventDurationEditable={false}
          eventDrop={handleEventDrop}
          droppable={true}
          drop={handleExternalDrop}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
          }}
          buttonText={{ month: 'Month', week: 'Week', today: 'Today' }}
          views={{ dayGridWeek: { dayMaxEvents: false } }}
          dayMaxEvents={3}
          eventDisplay="block"
          height="100%"
          stickyHeaderDates={true}
          firstDay={0}
        />
      </div>
    </div>
  );
};
