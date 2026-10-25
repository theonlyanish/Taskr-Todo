import React, { useEffect, useRef, useState } from 'react';
import { TaskList } from '../utils/taskLists';

interface ListMenuProps {
  lists: TaskList[];
  currentListId: string;
  // Unfinished tasks in each list
  counts: Record<string, number>;
  onSwitch: (listId: string) => void;
  onNewList: () => void;
  onManage: () => void;
}

// The list showing, beside the logo, and a menu to switch lists or make a
// new one. Follows the WAI-ARIA menu button pattern, like the account menu.
export const ListMenu: React.FC<ListMenuProps> = ({ lists, currentListId, counts, onSwitch, onNewList, onManage }) => {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<'current' | 'first' | 'last' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = lists.find(list => list.id === currentListId) ?? lists[0];

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);

  // Close when clicking anywhere outside the menu
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !focusOnOpen) return;
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);
    const target =
      focusOnOpen === 'current'
        ? list.find(item => item.getAttribute('aria-checked') === 'true')
        : focusOnOpen === 'first'
          ? list[0]
          : list[list.length - 1];
    target?.focus();
    setFocusOnOpen(null);
  }, [open, focusOnOpen]);

  const openMenu = (focus: 'current' | 'first' | 'last' = 'current') => {
    setOpen(true);
    setFocusOnOpen(focus);
  };

  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(list.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  const choose = (action: () => void) => {
    closeMenu(true);
    action();
  };

  return (
    <div className="list-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="list-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="list-menu-list"
        aria-label={`List: ${current.name}. Switch list`}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="list-dot" style={{ backgroundColor: current.color }} aria-hidden="true" />
        <span className="list-menu-name">{current.name}</span>
        <svg className="list-menu-caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id="list-menu-list"
          className="list-menu-list"
          role="menu"
          aria-label="Lists"
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
        >
          {lists.map(list => (
            <button
              key={list.id}
              type="button"
              role="menuitemradio"
              aria-checked={list.id === currentListId}
              tabIndex={-1}
              className="list-menu-item"
              onClick={() => choose(() => onSwitch(list.id))}
            >
              <span className="list-dot" style={{ backgroundColor: list.color }} aria-hidden="true" />
              <span className="list-menu-item-name">{list.name}</span>
              <span className="list-menu-item-count">
                {counts[list.id] ?? 0}
                <span className="sr-only"> to do</span>
              </span>
              <svg className="list-menu-check" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </button>
          ))}
          <div className="list-menu-separator" role="separator" />
          <button type="button" role="menuitem" tabIndex={-1} className="list-menu-item" onClick={() => choose(onNewList)}>
            <svg className="list-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            New list
          </button>
          {lists.length > 1 && (
            <button type="button" role="menuitem" tabIndex={-1} className="list-menu-item" onClick={() => choose(onManage)}>
              <svg className="list-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
              </svg>
              Rename or delete lists
            </button>
          )}
        </div>
      )}
    </div>
  );
};
