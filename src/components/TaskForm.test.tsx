import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskForm } from './TaskForm';

const renderForm = (props: Partial<React.ComponentProps<typeof TaskForm>> = {}) => {
  const onSubmit = jest.fn();
  render(<TaskForm selectedTask={null} onSubmit={onSubmit} onDelete={jest.fn()} {...props} />);
  return { onSubmit };
};

describe('adding a task for a day picked on the calendar', () => {
  // Wednesday 28 October 2026, as the calendar passes it (midnight UTC)
  const picked = new Date('2026-10-28T00:00:00Z');

  it('says which day it’s for while the date field is folded away', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 20, 12));
    renderForm({ initialDueDate: picked });
    // The note under the title, e.g. "Due Wed, Oct 28" (the wording follows the locale)
    expect(document.getElementById('quick-add-hint')).toHaveTextContent(/^Due .*28/);
    expect(screen.getByRole('button', { name: 'Remove date' })).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('adds the task on that day', () => {
    const { onSubmit } = renderForm({ initialDueDate: picked });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Dentist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dentist', dueDate: picked }));
  });

  it('lets the date go', () => {
    const { onSubmit } = renderForm({ initialDueDate: picked });
    fireEvent.click(screen.getByRole('button', { name: 'Remove date' }));
    expect(screen.queryByRole('button', { name: 'Remove date' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Dentist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueDate: undefined }));
  });

  it('doesn’t repeat the date when the date field is showing', () => {
    renderForm({ initialDueDate: picked, detailsOpen: true, onDetailsOpenChange: jest.fn() });
    expect(screen.queryByRole('button', { name: 'Remove date' })).not.toBeInTheDocument();
  });
});
