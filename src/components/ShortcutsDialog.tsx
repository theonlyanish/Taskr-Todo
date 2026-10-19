import React, { useEffect, useRef } from 'react';

interface ShortcutsDialogProps {
  isApple: boolean;
  onClose: () => void;
}

// The keyboard shortcuts, shown only when someone presses ? (nothing in the
// app points to it)
export const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ isApple, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);

  const mod = isApple ? '⌘' : 'Ctrl';
  const groups: { title: string; rows: [React.ReactNode, string][] }[] = [
    {
      title: 'Getting around',
      rows: [
        [<><kbd>j</kbd> <kbd>k</kbd></>, 'Next or previous task'],
        [<kbd>Enter</kbd>, 'Open the task'],
        [<><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></>, 'List, Board or Calendar'],
        [<><kbd>/</kbd> or <kbd>{mod}</kbd> <kbd>K</kbd></>, 'Search and commands']
      ]
    },
    {
      title: 'Tasks',
      rows: [
        [<kbd>x</kbd>, 'Complete or untick'],
        [<kbd>e</kbd>, 'Edit'],
        [<kbd>n</kbd>, 'New task'],
        [<><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd></>, 'Move up or down in the list'],
        [<><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></>, 'Move a card on the board']
      ]
    },
    {
      title: 'Selecting',
      rows: [
        [<><kbd>{mod}</kbd>-click</>, 'Pick a task, or unpick it'],
        [<><kbd>Shift</kbd>-click</>, 'Pick everything in between'],
        [<kbd>Esc</kbd>, 'Leave a text box, stop selecting, or close a window']
      ]
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape' || event.key === '?') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <h3 id="shortcuts-title">Keyboard shortcuts</h3>
        {groups.map(group => (
          <section key={group.title} className="shortcuts-group">
            <h4>{group.title}</h4>
            <dl>
              {group.rows.map(([keys, action]) => (
                <div key={action} className="shortcuts-row">
                  <dt>{keys}</dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <div className="modal-actions">
          <button ref={closeRef} type="button" className="cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
