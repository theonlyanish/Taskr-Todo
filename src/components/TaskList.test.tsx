import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Task } from '../types/Task';
import { orderKey } from '../utils/taskOrder';
import { TaskList } from './TaskList';

const BASE = Date.UTC(2026, 9, 18);
const task = (title: string, minutes: number): Task => ({
  id: title,
  title,
  status: 'To Do',
  createdAt: new Date(BASE + minutes * 60_000),
  updatedAt: new Date(BASE + minutes * 60_000)
});
const tasks = [task('Alpha', 0), task('Bravo', 1), task('Charlie', 2)];

const renderList = (props: Partial<React.ComponentProps<typeof TaskList>> = {}) => {
  const handlers = {
    onTaskSelect: jest.fn(),
    onTaskToggle: jest.fn(),
    onAddSubtask: jest.fn(),
    onReorder: jest.fn()
  };
  render(<TaskList tasks={tasks} {...handlers} {...props} />);
  return handlers;
};

const row = (title: string) => screen.getByText(title).closest('button')!;

describe('the task list', () => {
  it('shows tasks oldest first', () => {
    renderList();
    expect(screen.getAllByText(/Alpha|Bravo|Charlie/).map(el => el.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('moves a task up with Alt+↑, to a place between its new neighbours', () => {
    const { onReorder } = renderList();
    fireEvent.keyDown(row('Charlie'), { key: 'ArrowUp', altKey: true });
    expect(onReorder).toHaveBeenCalledTimes(1);
    const [id, position] = onReorder.mock.calls[0];
    expect(id).toBe('Charlie');
    expect(position).toBeGreaterThan(orderKey(tasks[0]));
    expect(position).toBeLessThan(orderKey(tasks[1]));
    expect(screen.getByText('Charlie moved to 2 of 3.')).toBeInTheDocument();
  });

  it('says so when a task is already at the top', () => {
    const { onReorder } = renderList();
    fireEvent.keyDown(row('Alpha'), { key: 'ArrowUp', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha is already first.')).toBeInTheDocument();
  });

  it('opens a task on a plain click', () => {
    const { onTaskSelect } = renderList();
    fireEvent.click(row('Bravo'));
    expect(onTaskSelect).toHaveBeenCalledWith(tasks[1]);
  });

  it('selects instead of opening when the click is a selection', () => {
    const onSelectClick = jest.fn((_task: Task, event: React.MouseEvent) => event.ctrlKey);
    const { onTaskSelect } = renderList({ onSelectClick, selecting: true, bulkSelectedIds: ['Bravo'] });
    fireEvent.click(row('Charlie'), { ctrlKey: true });
    expect(onSelectClick).toHaveBeenCalled();
    expect(onTaskSelect).not.toHaveBeenCalled();
    // Picked rows say so to screen readers
    expect(row('Bravo')).toHaveAttribute('aria-pressed', 'true');
    expect(row('Alpha')).toHaveAttribute('aria-pressed', 'false');
  });

  it('says when a section is empty', () => {
    render(
      <TaskList tasks={[]} emptyText="Nothing done yet." onTaskSelect={jest.fn()} onTaskToggle={jest.fn()} onAddSubtask={jest.fn()} />
    );
    expect(screen.getByText('Nothing done yet.')).toBeInTheDocument();
  });
});
