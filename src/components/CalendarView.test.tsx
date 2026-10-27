import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarView } from './CalendarView';
import { Task } from '../types/Task';

const makeTask = (id: string, day: number, extra: Partial<Task> = {}): Task => ({
  id, title: id, status: 'To Do', createdAt: new Date(), updatedAt: new Date(),
  dueDate: new Date(Date.UTC(2026, 9, day)), ...extra
});
const parent = makeTask('Review the complete project brief before the client meeting', 26, {
  subtasks: [makeTask('Check the client feedback', 26, { isSubtask: true, parentId: 'parent' })]
});
const later = makeTask('Pay rent', 28);
let phone = true;
const mediaListeners = new Set<() => void>();
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 26, 12));
  phone = true;
  mediaListeners.clear();
  window.matchMedia = jest.fn().mockImplementation(() => ({
    get matches() { return phone; },
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener)
  }));
});

afterEach(() => {
  jest.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

function setup(extra: Partial<React.ComponentProps<typeof CalendarView>> = {}) {
  const handlers = { onTaskSelect: jest.fn(), onTaskUpdate: jest.fn(), onDateSelect: jest.fn() };
  const view = render(<CalendarView tasks={[parent, later]} {...handlers} {...extra} />);
  return { ...handlers, ...view };
}

function chooseDay(day: number, count: number) {
  const date = new Date(2026, 9, day).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  return screen.getByRole('button', { name: `${date}, ${count} task${count === 1 ? '' : 's'}` });
}

function details() {
  return within(document.querySelector('.calendar-day-details') as HTMLElement);
}

describe('mobile month calendar', () => {
  it('shows full task and subtask titles for today, with their parent context', () => {
    setup();
    expect(chooseDay(26, 2)).toHaveAttribute('aria-pressed', 'true');
    expect(details().getByText(parent.title)).toBeInTheDocument();
    expect(details().getByText('Check the client feedback')).toBeInTheDocument();
    expect(details().getByText(`To Do · Subtask of ${parent.title}`)).toBeInTheDocument();
    expect(details().queryByText('Pay rent')).not.toBeInTheDocument();
    // Screen readers hear the date in words, as the heading shows it
    expect(screen.getByRole('status')).toHaveTextContent(`due on ${details().getByRole('heading').textContent}`);
  });

  it('browses a date without opening the form, and adds explicitly with a UTC due date', () => {
    const { onDateSelect } = setup();
    fireEvent.click(chooseDay(28, 1));
    expect(details().getByText('Pay rent')).toBeInTheDocument();
    expect(details().queryByText(parent.title)).not.toBeInTheDocument();
    expect(onDateSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '+ Add task for this day' }));
    expect(onDateSelect).toHaveBeenCalledWith(new Date('2026-10-28T00:00:00Z'));
  });

  it('opens and completes tasks using the existing handlers', () => {
    const { onTaskSelect, onTaskUpdate } = setup();
    fireEvent.click(details().getByRole('button', { name: `${parent.title} To Do` }));
    expect(onTaskSelect).toHaveBeenCalledWith(parent);
    fireEvent.click(details().getByRole('checkbox', { name: `Complete “${parent.title}”` }));
    expect(onTaskUpdate).toHaveBeenCalledWith(parent.id, { status: 'Completed' });
  });

  it('shows the empty day state and follows month navigation', () => {
    setup();
    fireEvent.click(chooseDay(27, 0));
    expect(details().getByText('No tasks due on this day.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next month/i }));
    expect(details().getByRole('heading').textContent).toContain('November');
  });

  it('updates the selected day after task edits and can reopen completed tasks', () => {
    const { rerender, onTaskSelect, onTaskUpdate, onDateSelect } = setup();
    const done = { ...parent, status: 'Completed' as const };
    rerender(<CalendarView tasks={[done]} onTaskSelect={onTaskSelect} onTaskUpdate={onTaskUpdate} onDateSelect={onDateSelect} />);
    const checkbox = details().getByRole('checkbox', { name: `Reopen “${parent.title}”` });
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(checkbox);
    expect(onTaskUpdate).toHaveBeenCalledWith(parent.id, { status: 'To Do' });
  });

  it('keeps the existing calendar on desktop and in phone week view', () => {
    const { rerender, onTaskSelect, onTaskUpdate } = setup();
    act(() => { phone = false; mediaListeners.forEach(listener => listener()); });
    expect(document.querySelector('.calendar-day-details')).not.toBeInTheDocument();
    expect(document.querySelector('.calendar-mobile-day')).not.toBeInTheDocument();
    expect(document.querySelector('.fc-daygrid-day-number')).toHaveTextContent(/^27$/);
    act(() => { phone = true; mediaListeners.forEach(listener => listener()); });
    expect(document.querySelector('.calendar-day-details')).toBeInTheDocument();
    rerender(<CalendarView tasks={[parent]} layout="dayGridWeek" onTaskSelect={onTaskSelect} onTaskUpdate={onTaskUpdate} />);
    expect(document.querySelector('.calendar-day-details')).not.toBeInTheDocument();
    expect(document.querySelector('.calendar-mobile-day')).not.toBeInTheDocument();
  });
});
