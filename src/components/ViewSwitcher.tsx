import React, { useEffect } from 'react';

export type ViewType = 'normal' | 'kanban' | 'calendar';

interface ViewSwitcherProps {
  value: ViewType;
  onChange: (view: ViewType) => void;
}

const VIEWS: { id: ViewType; label: string; shortcut: string; icon: React.ReactNode }[] = [
  {
    id: 'normal',
    label: 'List',
    shortcut: '1',
    icon: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  },
  {
    id: 'kanban',
    label: 'Board',
    shortcut: '2',
    icon: (
      <>
        <rect x="3" y="4" width="5" height="16" rx="1.5" />
        <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
        <rect x="16" y="4" width="5" height="7" rx="1.5" />
      </>
    )
  },
  {
    id: 'calendar',
    label: 'Calendar',
    shortcut: '3',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    )
  }
];

// Keys typed into a field are text, not shortcuts
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Segmented control for switching between the list, Kanban board and calendar.
// Number keys 1 to 3 switch views from anywhere outside a text field.
export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ value, onChange }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const view = VIEWS.find(option => option.shortcut === event.key);
      if (!view) return;
      // The new view's form takes focus straight away; without this the
      // digit would be typed into its title field
      event.preventDefault();
      onChange(view.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  const activeIndex = Math.max(0, VIEWS.findIndex(option => option.id === value));

  return (
    <div
      className="view-switcher"
      role="group"
      aria-label="View"
      style={{ '--active-index': activeIndex } as React.CSSProperties}
    >
      {/* Highlight that slides behind the selected option */}
      <span className="view-switcher-indicator" aria-hidden="true" />
      {VIEWS.map(option => (
        <button
          key={option.id}
          type="button"
          className="view-switcher-option"
          aria-pressed={option.id === value}
          aria-keyshortcuts={option.shortcut}
          title={`${option.label} view (${option.shortcut})`}
          onClick={() => onChange(option.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">{option.icon}</svg>
          {option.label}
        </button>
      ))}
    </div>
  );
};
