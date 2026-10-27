import React, { useEffect, useRef, useState } from 'react';
import { Task } from '../types/Task';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable, DropArg } from '@fullcalendar/interaction';
import type { CalendarLayout } from '../utils/preferences';

interface CalendarViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  selectedTaskId?: string;
  onDateSelect?: (date: Date) => void;
  // Month or Week, remembered between visits
  layout?: CalendarLayout;
  onLayoutChange?: (layout: CalendarLayout) => void;
}

// Due dates are stored as midnight UTC, so convert a calendar day (local
// midnight) to that form before saving it.
const toUtcDate = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

const calendarDay = (date: Date) => toUtcDate(date).toISOString().slice(0, 10);
const dueDay = (date: Date) => new Date(date).toISOString().slice(0, 10);
const PHONE_QUERY = '(max-width: 600px)';
// "Wednesday, 28 October 2026" in the user's own date format
const longDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onTaskSelect,
  onTaskUpdate,
  selectedTaskId,
  onDateSelect,
  layout = 'dayGridMonth',
  onLayoutChange
}) => {
  const calendarRef = useRef<any>(null);
  const selectedDateRef = useRef<string | null>(null);
  const unscheduledRef = useRef<HTMLDivElement>(null);
  const [isPhone, setIsPhone] = useState(() => window.matchMedia?.(PHONE_QUERY).matches ?? false);
  const [selectedDay, setSelectedDay] = useState(() => calendarDay(new Date()));
  const mobileMonth = isPhone && layout === 'dayGridMonth';

  useEffect(() => {
    const media = window.matchMedia?.(PHONE_QUERY);
    if (!media) return;
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // The layout can also change from outside, when the account's saved setting arrives
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api && api.view.type !== layout) api.changeView(layout);
  }, [layout]);

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
  const dayTasks = allTasks.filter(({ task }) => task.dueDate && dueDay(task.dueDate) === selectedDay);
  // The selected day ("2026-10-28") as words, for its heading and screen readers
  const selectedDayText = new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
  // Group once per render rather than scan every task for each date cell.
  const tasksByDay = new Map<string, typeof allTasks>();
  allTasks.forEach(item => {
    if (!item.task.dueDate) return;
    const key = dueDay(item.task.dueDate);
    const group = tasksByDay.get(key) ?? [];
    group.push(item);
    tasksByDay.set(key, group);
  });

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
  const handleEventDidMount = ({ el, event }: { el: HTMLElement; event: { id: string; title: string; extendedProps: { parentTitle?: string } } }) => {
    el.dataset.taskId = event.id;
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
    if (mobileMonth) {
      setSelectedDay(calendarDay(info.date));
      return;
    }
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
    <div className={`calendar-container${mobileMonth ? ' calendar-mobile-month' : ''}`}>
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
          initialView={layout}
          datesSet={arg => {
            onLayoutChange?.(arg.view.type as CalendarLayout);
            // Keep the day details in the month/week reached by navigation.
            const start = calendarDay(arg.view.currentStart);
            const end = calendarDay(arg.view.currentEnd);
            setSelectedDay(current => current < start || current >= end ? start : current);
          }}
          dayCellClassNames={arg => mobileMonth && calendarDay(arg.date) === selectedDay ? ['mobile-selected-date'] : []}
          dayCellContent={arg => {
            // Keep React owning the cell content across breakpoint changes;
            // removing the renderer leaves FullCalendar's old portal behind.
            if (!mobileMonth) return <>{arg.dayNumberText}</>;
            const key = calendarDay(arg.date);
            const items = tasksByDay.get(key) ?? [];
            // FullCalendar always wraps this in its day-number <a>. It has no
            // href, so browsers and screen readers treat it as a plain wrapper
            // and this button is what's announced and pressed.
            return (
              <button
                type="button"
                className="calendar-mobile-day"
                aria-pressed={key === selectedDay}
                aria-label={`${longDate(arg.date)}, ${items.length} task${items.length === 1 ? '' : 's'}`}
                onClick={event => {
                  event.stopPropagation();
                  setSelectedDay(key);
                }}
              >
                <span>{arg.dayNumberText}</span>
                <span className="calendar-mobile-marks" aria-hidden="true">
                  {items.slice(0, 3).map(({ task }) => <span key={task.id} className="calendar-mobile-mark" data-status={task.status} />)}
                  {items.length > 3 && <span className="calendar-mobile-extra">+{items.length - 3}</span>}
                </span>
              </button>
            );
          }}
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
          height={mobileMonth ? 'auto' : '100%'}
          stickyHeaderDates={true}
          firstDay={0}
        />
      </div>
      {mobileMonth && (
        <section className="calendar-day-details" aria-labelledby="calendar-day-heading">
          <div className="calendar-day-heading">
            <h2 id="calendar-day-heading">{selectedDayText}</h2>
            <span>{dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}</span>
          </div>
          <div className="sr-only" role="status">{dayTasks.length} task{dayTasks.length === 1 ? '' : 's'} due on {selectedDayText}</div>
          {dayTasks.length === 0 ? <p className="calendar-day-empty">No tasks due on this day.</p> : (
            <ul className="calendar-day-tasks">
              {dayTasks.map(({ task, parentTitle }) => (
                <li key={task.id} className={`calendar-day-task${task.id === selectedTaskId ? ' selected' : ''}`} data-status={task.status}>
                  <button type="button" role="checkbox" aria-checked={task.status === 'Completed'}
                    aria-label={`${task.status === 'Completed' ? 'Reopen' : 'Complete'} “${task.title}”`}
                    className={`task-checkbox${task.status === 'Completed' ? ' checked' : ''}`}
                    onClick={() => onTaskUpdate(task.id, { status: task.status === 'Completed' ? 'To Do' : 'Completed' })}
                  />
                  <button type="button" className="calendar-day-task-content" onClick={() => onTaskSelect(task)}
                    aria-current={task.id === selectedTaskId ? 'true' : undefined}>
                    <span className="calendar-day-task-title">{task.title}</span>
                    <span className="calendar-day-task-meta">{task.status}{parentTitle ? ` · Subtask of ${parentTitle}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {onDateSelect && <button type="button" className="calendar-day-add" onClick={() => onDateSelect(new Date(`${selectedDay}T00:00:00Z`))}>+ Add task for this day</button>}
        </section>
      )}
    </div>
  );
};
