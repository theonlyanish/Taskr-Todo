import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Task } from '../types/Task';
import { SubtaskProgress } from './SubtaskProgress';

const subtask = (title: string, status: Task['status']): Task => ({
  id: title,
  title,
  status,
  createdAt: new Date(),
  updatedAt: new Date(),
  isSubtask: true
});

const subtasks = [subtask('Pack', 'Completed'), subtask('Book', 'To Do'), subtask('Go', 'To Do')];

describe('subtask progress chip', () => {
  it('shows how many are done and says so to screen readers', () => {
    render(<SubtaskProgress subtasks={subtasks} expanded={false} onToggle={() => {}} />);
    const chip = screen.getByRole('button', { name: '1 of 3 subtasks done. Show subtasks' });
    expect(chip).toHaveTextContent('1/3 subtasks');
    expect(chip).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows or hides the subtasks without the click reaching the task underneath', () => {
    const onToggle = jest.fn();
    const onRowClick = jest.fn();
    render(
      <div onClick={onRowClick}>
        <SubtaskProgress subtasks={subtasks} expanded onToggle={onToggle} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Hide subtasks/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('marks everything done', () => {
    const { container } = render(
      <SubtaskProgress subtasks={subtasks.map(item => ({ ...item, status: 'Completed' }))} expanded={false} onToggle={() => {}} />
    );
    expect(container.querySelector('.subtask-progress')).toHaveClass('all-done');
  });

  it('is just a picture, not a button, on the board’s drag copy', () => {
    render(<SubtaskProgress subtasks={subtasks} expanded={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('1/3 subtasks')).toBeInTheDocument();
  });
});
