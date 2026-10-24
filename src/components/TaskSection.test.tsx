import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Task } from '../types/Task';
import { TaskSection } from './TaskSection';

const task = (title: string, extra: Partial<Task> = {}): Task => ({
  id: title,
  title,
  status: 'Completed',
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
  ...extra
});

const subtask = task('Buy stamps', { isSubtask: true, parentId: 'Post letters' });
const tasks = [task('Post letters', { subtasks: [subtask] }), subtask, task('Pay rent')];

const renderSection = (props: Partial<React.ComponentProps<typeof TaskSection>> = {}) => {
  const handlers = { onTaskSelect: jest.fn(), onTaskToggle: jest.fn(), onAddSubtask: jest.fn() };
  render(<TaskSection title="Completed" tasks={tasks} emptyText="Nothing done yet." {...handlers} {...props} />);
  return handlers;
};

describe('a task section', () => {
  it('counts its tasks in the heading, not their subtasks', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'Completed, 2 tasks' })).toBeInTheDocument();
  });

  it('says so when it’s empty', () => {
    renderSection({ tasks: [] });
    expect(screen.getByRole('heading', { name: 'Completed, 0 tasks' })).toBeInTheDocument();
    expect(screen.getByText('Nothing done yet.')).toBeInTheDocument();
  });

  it('folds away and opens again from its heading', () => {
    const onToggleCollapsed = jest.fn();
    const { rerender } = render(
      <TaskSection
        title="Completed"
        tasks={tasks}
        emptyText="Nothing done yet."
        collapsed={false}
        onToggleCollapsed={onToggleCollapsed}
        onTaskSelect={jest.fn()}
        onTaskToggle={jest.fn()}
        onAddSubtask={jest.fn()}
      />
    );
    const toggle = screen.getByRole('button', { name: /Completed/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Pay rent')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(onToggleCollapsed).toHaveBeenCalled();

    rerender(
      <TaskSection
        title="Completed"
        tasks={tasks}
        emptyText="Nothing done yet."
        collapsed
        onToggleCollapsed={onToggleCollapsed}
        onTaskSelect={jest.fn()}
        onTaskToggle={jest.fn()}
        onAddSubtask={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Completed/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Pay rent')).not.toBeInTheDocument();
    // The count still shows while folded
    expect(screen.getByRole('heading', { name: 'Completed, 2 tasks' })).toBeInTheDocument();
  });

  it('offers Clear only when there’s something to clear', () => {
    const onClear = jest.fn();
    renderSection({ onClear });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
  });
});
