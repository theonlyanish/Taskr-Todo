import React, { useEffect, useMemo, useRef, useState } from 'react';

export type PaletteGroup = 'Actions' | 'Tasks' | 'Create';

export interface PaletteItem {
  id: string;
  label: string;
  group: PaletteGroup;
  hint?: string;
  // Extra words the search should match, e.g. "add create" for "New task"
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  items: PaletteItem[];
  onCreateTask: (title: string) => void;
  onClose: () => void;
}

// Keep the list short; typing narrows it down
const MAX_TASK_RESULTS = 8;

// Ctrl+K / Cmd+K search box for running actions and jumping to tasks
export const CommandPalette: React.FC<CommandPaletteProps> = ({ items, onCreateTask, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Where focus was before opening, so it can go back there afterwards
  const returnFocusRef = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const text = query.trim();
    const needle = text.toLowerCase();
    // 0 = title starts with the text, 1 = title contains it, 2 = only a keyword does
    const rank = (item: PaletteItem) => {
      if (!needle) return 0;
      const label = item.label.toLowerCase();
      if (label.startsWith(needle)) return 0;
      if (label.includes(needle)) return 1;
      return (item.keywords ?? '').toLowerCase().includes(needle) ? 2 : -1;
    };
    const search = (group: PaletteGroup) =>
      items
        .map(item => ({ item, score: item.group === group ? rank(item) : -1 }))
        .filter(({ score }) => score >= 0)
        .sort((a, b) => a.score - b.score);

    const actions = search('Actions');
    const tasks = search('Tasks').slice(0, MAX_TASK_RESULTS);
    // Show whichever group has the better match first (actions win a tie)
    const bestScore = (found: { score: number }[]) => found[0]?.score ?? Infinity;
    const ordered = bestScore(tasks) < bestScore(actions) ? [...tasks, ...actions] : [...actions, ...tasks];
    const list: PaletteItem[] = ordered.map(({ item }) => item);

    // Offer to create a task from whatever was typed, unless it already exists
    const exists = items.some(item => item.group === 'Tasks' && item.label.toLowerCase() === needle);
    if (text && !exists) {
      list.push({
        id: 'create-task',
        label: `Create task “${text}”`,
        group: 'Create',
        run: () => onCreateTask(text)
      });
    }
    return list;
  }, [items, query, onCreateTask]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const restoreFocus = (onlyIfLost: boolean) => {
    const previous = returnFocusRef.current;
    requestAnimationFrame(() => {
      const lost = document.activeElement === document.body || !document.activeElement;
      if ((!onlyIfLost || lost) && previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    });
  };

  const dismiss = () => {
    onClose();
    restoreFocus(false);
  };

  // Close first, then run, so commands that move focus (e.g. "New task") keep it
  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
    restoreFocus(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      setActiveIndex(index => (index - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    } else if (event.key === 'Tab') {
      // The search box is the only control here; keep focus inside the dialog
      event.preventDefault();
    }
  };

  // Group consecutive results under a heading, keeping one running index
  const groups: { name: PaletteGroup; entries: { item: PaletteItem; index: number }[] }[] = [];
  results.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.entries.push({ item, index });
    else groups.push({ name: item.group, entries: [{ item, index }] });
  });

  return (
    <div className="palette-overlay" onMouseDown={dismiss}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={event => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-autocomplete="list"
          aria-activedescendant={results[activeIndex] ? `palette-option-${activeIndex}` : undefined}
          placeholder="Search tasks or type a command…"
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div id="palette-results" className="palette-list" role="listbox" aria-label="Results" ref={listRef}>
          {groups.map(group => (
            <div key={group.name} role="group" aria-labelledby={`palette-group-${group.name}`}>
              <div id={`palette-group-${group.name}`} className="palette-group">
                {group.name}
              </div>
              {group.entries.map(({ item, index }) => (
                <div
                  key={item.id}
                  id={`palette-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-index={index}
                  className={`palette-item ${index === activeIndex ? 'active' : ''}`}
                  onMouseMove={() => setActiveIndex(index)}
                  // Keep focus in the search box while clicking a result
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(item)}
                >
                  <span className="palette-item-label">{item.label}</span>
                  {item.hint && <span className="palette-item-hint">{item.hint}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="palette-footer" aria-hidden="true">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
          <span><kbd>Enter</kbd> to choose</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
