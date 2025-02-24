import React, { useEffect, useRef } from 'react';
import { Task } from '../types';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg } from '@fullcalendar/core';

interface CalendarViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
  onDateSelect?: (date: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onTaskSelect,
  selectedTaskId,
  onDateSelect
}) => {
  const calendarRef = useRef<any>(null);
  const selectedDateRef = useRef<string | null>(null);

  const events = tasks.map(task => ({
    id: task.id,
    title: task.title,
    start: task.dueDate,
    classNames: [
      `calendar-task-${task.status.toLowerCase().replace(' ', '-')}`,
      task.id === selectedTaskId ? 'selected' : ''
    ],
    extendedProps: {
      task
    }
  }));

  const handleEventClick = (info: any) => {
    onTaskSelect(info.event.extendedProps.task);
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

      // Create a new Date object at midnight UTC to avoid timezone issues
      const selectedDate = new Date(Date.UTC(
        info.date.getFullYear(),
        info.date.getMonth(),
        info.date.getDate()
      ));
      onDateSelect(selectedDate);
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
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}
        dayMaxEvents={3}
        eventDisplay="block"
        height="100%"
        stickyHeaderDates={true}
        firstDay={0}
      />
    </div>
  );
}; 