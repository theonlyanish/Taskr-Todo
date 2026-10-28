import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TaskPanel } from './TaskPanel';

const fields = <><h2 id="task-form-title">Edit task</h2><input id="task-title" aria-label="Title" /></>;

describe('mobile task panel', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    jest.restoreAllMocks();
  });

  it('focuses the editor, locks the background, then restores the list position and trigger', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
    const { rerender } = render(<TaskPanel mobile open onClose={jest.fn()}>{fields}</TaskPanel>);
    expect(screen.getByRole('dialog', { name: 'Edit task' })).toHaveAttribute('open');
    expect(screen.getByLabelText('Title')).toHaveFocus();
    expect(document.body.style.top).toBe('-420px');
    expect(document.body.style.position).toBe('fixed');

    rerender(<TaskPanel mobile open={false} onClose={jest.fn()}>{fields}</TaskPanel>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('handles Escape through the native cancel event', () => {
    const close = jest.fn();
    render(<TaskPanel mobile open onClose={close}>{fields}</TaskPanel>);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the desktop form and summary inline', () => {
    render(<TaskPanel mobile={false} open={false} onClose={jest.fn()} summary={<p>Coming up</p>}>{fields}</TaskPanel>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByText('Coming up')).toBeInTheDocument();
    expect(document.body.style.position).toBe('');
  });
});
