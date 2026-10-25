import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatsDialog } from './StatsDialog';
import { Task } from '../types/Task';

const task: Task = {
  id: 'review', title: 'Review proposal', status: 'In Progress',
  createdAt: new Date(), updatedAt: new Date(),
  startedAt: new Date(Date.now() - 60_000)
};

function setup(tasks: Task[] = []) {
  const onOpenTask = jest.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    return <div>
      <div data-testid="background"><button onClick={() => setOpen(true)}>Show stats</button></div>
      <div data-testid="already-inert" ref={element => element?.setAttribute('inert', '')} />
      {open && <StatsDialog tasks={tasks} isSignedIn={false} onClose={() => setOpen(false)} onOpenTask={onOpenTask} />}
    </div>;
  }
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Show stats' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onOpenTask };
}

describe('Stats keyboard focus', () => {
  it('starts on Close and keeps both tab directions inside when there are no task links', () => {
    setup();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(close, { key: 'Tab' })).toBe(false);
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(close).toHaveFocus();
  });

  it('wraps from Close to the first task and from the first task back to Close', () => {
    setup([task]);
    const close = screen.getByRole('button', { name: 'Close' });
    const taskButton = screen.getByRole('button', { name: /Review proposal/ });
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(taskButton).toHaveFocus();
    fireEvent.keyDown(taskButton, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
    taskButton.focus();
    // Normal tabbing between interior controls remains the browser's job.
    expect(fireEvent.keyDown(taskButton, { key: 'Tab' })).toBe(true);
  });

  it.each(['Close', 'Escape', 'backdrop'])('restores focus and background access after %s', method => {
    const { opener } = setup();
    expect(screen.getByTestId('background')).toHaveAttribute('inert');
    if (method === 'Close') fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    else if (method === 'Escape') fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    else fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(screen.getByTestId('background')).not.toHaveAttribute('inert');
    expect(screen.getByTestId('already-inert')).toHaveAttribute('inert');
  });

  it('opens a task without returning focus to the Stats opener', () => {
    const { opener, onOpenTask } = setup([task]);
    const taskButton = screen.getByRole('button', { name: /Review proposal/ });
    taskButton.focus();
    fireEvent.click(taskButton);
    expect(onOpenTask).toHaveBeenCalledWith(task);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).not.toHaveFocus();
    expect(screen.getByTestId('background')).not.toHaveAttribute('inert');
  });
});
