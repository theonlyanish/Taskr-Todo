import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { focusTaskById, useKeyboardShortcuts } from './keyboardShortcuts';

// Rows shaped like the list's: a task item holding its main button
const Harness: React.FC<{ handlers: Parameters<typeof useKeyboardShortcuts>[0]; dialogOpen?: boolean }> = ({
  handlers,
  dialogOpen = false
}) => {
  useKeyboardShortcuts(handlers);
  return (
    <>
      {['Alpha', 'Bravo', 'Charlie'].map(title => (
        <div key={title} className="task-item" data-task-id={title}>
          <button type="button" className="task-content">{title}</button>
        </div>
      ))}
      <div hidden>
        <div className="task-item" data-task-id="Hidden">
          <button type="button" className="task-content">Hidden</button>
        </div>
      </div>
      <input aria-label="Title" />
      {dialogOpen && <div role="dialog" aria-label="Something open" />}
    </>
  );
};

const setup = (dialogOpen = false) => {
  const handlers = {
    onToggle: jest.fn(),
    onEdit: jest.fn(),
    onNewTask: jest.fn(),
    onSearch: jest.fn(),
    onHelp: jest.fn()
  };
  render(<Harness handlers={handlers} dialogOpen={dialogOpen} />);
  return handlers;
};

const press = (key: string, options: KeyboardEventInit = {}) => fireEvent.keyDown(document.activeElement ?? document.body, { key, ...options });
const focused = () => document.activeElement?.textContent;

beforeEach(() => {
  // jsdom doesn't lay anything out, so give every element a box; the shortcuts
  // skip elements without one (hidden subtasks, other views)
  jest.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList;
  });
});

describe('keyboard shortcuts', () => {
  it('moves between tasks with j and k, starting from the first and stopping at the ends', () => {
    setup();
    press('j');
    expect(focused()).toBe('Alpha');
    press('j');
    press('j');
    expect(focused()).toBe('Charlie');
    press('j');
    expect(focused()).toBe('Charlie');
    press('k');
    expect(focused()).toBe('Bravo');
  });

  it('skips tasks that are hidden', () => {
    setup();
    ['j', 'j', 'j', 'j'].forEach(key => press(key));
    expect(focused()).toBe('Charlie');
  });

  it('completes and edits the task the keyboard is on', () => {
    const { onToggle, onEdit } = setup();
    press('j');
    press('j');
    press('x');
    expect(onToggle).toHaveBeenCalledWith('Bravo');
    press('e');
    expect(onEdit).toHaveBeenCalledWith('Bravo');
  });

  it('does nothing with x or e when no task has focus', () => {
    const { onToggle, onEdit } = setup();
    press('x');
    press('e');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('opens a new task, search and the shortcuts list', () => {
    const { onNewTask, onSearch, onHelp } = setup();
    press('n');
    press('/');
    press('?');
    expect(onNewTask).toHaveBeenCalled();
    expect(onSearch).toHaveBeenCalled();
    expect(onHelp).toHaveBeenCalled();
  });

  it('leaves keys alone while typing', () => {
    const { onNewTask } = setup();
    screen.getByLabelText('Title').focus();
    press('n');
    press('j');
    expect(onNewTask).not.toHaveBeenCalled();
    expect(focused()).not.toBe('Alpha');
  });

  it('leaves keys alone while a dialog is open', () => {
    const { onHelp } = setup(true);
    press('?');
    press('j');
    expect(onHelp).not.toHaveBeenCalled();
    expect(focused()).not.toBe('Alpha');
  });

  it('ignores modified keys', () => {
    const { onNewTask, onSearch } = setup();
    press('n', { ctrlKey: true });
    press('/', { metaKey: true });
    press('n', { altKey: true });
    expect(onNewTask).not.toHaveBeenCalled();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('puts focus back on a task by id, after it moves', () => {
    setup();
    expect(focusTaskById('Charlie')).toBe(true);
    expect(focused()).toBe('Charlie');
    expect(focusTaskById('Hidden')).toBe(false);
  });
});
