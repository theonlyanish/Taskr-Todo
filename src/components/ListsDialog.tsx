import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_LIST_ID, LIST_COLORS, LIST_NAME_MAX, TaskList, nameTaken, nextListColor } from '../utils/taskLists';

interface ListsDialogProps {
  mode: 'new' | 'manage';
  lists: TaskList[];
  // Tasks in each list (all of them, done or not), for the delete question
  taskCounts: Record<string, number>;
  onCreate: (name: string, color: string) => void;
  onUpdate: (listId: string, changes: Partial<Pick<TaskList, 'name' | 'color'>>) => void;
  // deleteTasks: delete the list's tasks too (with undo), or move them to Personal
  onDelete: (listId: string, deleteTasks: boolean) => void;
  onModeChange: (mode: 'new' | 'manage') => void;
  onClose: () => void;
}

const plural = (count: number) => `${count} task${count === 1 ? '' : 's'}`;

const ColorPicker: React.FC<{ value: string; onChange: (color: string) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="list-colors" role="radiogroup" aria-label={label}>
    {LIST_COLORS.map((color, index) => (
      <button
        key={color}
        type="button"
        role="radio"
        aria-checked={color === value}
        aria-label={`Colour ${index + 1}`}
        className="list-color"
        style={{ backgroundColor: color }}
        onClick={() => onChange(color)}
      />
    ))}
  </div>
);

// Make a new list, or rename, recolour and delete the user's lists
export const ListsDialog: React.FC<ListsDialogProps> = ({
  mode,
  lists,
  taskCounts,
  onCreate,
  onUpdate,
  onDelete,
  onModeChange,
  onClose
}) => {
  const ownLists = lists.filter(list => list.id !== DEFAULT_LIST_ID);
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => nextListColor(ownLists));
  const [error, setError] = useState<string | null>(null);
  // Names being edited in the manage view, saved on blur or Enter
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode === 'new') {
      setName('');
      setError(null);
      // Lists may have changed since the dialog opened (one deleted in Manage)
      setColor(nextListColor(ownLists));
      nameRef.current?.focus();
    } else {
      closeRef.current?.focus();
    }
    // Only when switching between New and Manage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  const create = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the list a name.');
    if (nameTaken(trimmed, lists)) return setError('You already have a list with that name.');
    onCreate(trimmed, color);
  };

  const saveName = (list: TaskList) => {
    const draft = drafts[list.id];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === list.name) {
      setDrafts(({ [list.id]: _, ...rest }) => rest);
      setRowErrors(({ [list.id]: _, ...rest }) => rest);
      return;
    }
    if (nameTaken(trimmed, lists, list.id)) {
      setRowErrors(current => ({ ...current, [list.id]: 'Another list has that name.' }));
      return;
    }
    onUpdate(list.id, { name: trimmed });
    setDrafts(({ [list.id]: _, ...rest }) => rest);
    setRowErrors(({ [list.id]: _, ...rest }) => rest);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content lists-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lists-title"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {mode === 'new' ? (
          <form onSubmit={create} noValidate>
            <h3 id="lists-title">New list</h3>
            <label className="lists-label" htmlFor="new-list-name">Name</label>
            <input
              ref={nameRef}
              id="new-list-name"
              className="form-input"
              value={name}
              maxLength={LIST_NAME_MAX}
              placeholder="Work"
              aria-invalid={!!error}
              aria-describedby={error ? 'new-list-error' : undefined}
              onChange={event => {
                setName(event.target.value);
                setError(null);
              }}
            />
            {error && <p id="new-list-error" className="lists-error" role="alert">{error}</p>}
            <span className="lists-label" id="new-list-colour">Colour</span>
            <ColorPicker value={color} onChange={setColor} label="Colour" />
            <div className="lists-actions">
              <button type="button" className="cancel-btn lists-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="lists-btn lists-btn-primary">Create list</button>
            </div>
          </form>
        ) : (
          <>
            <h3 id="lists-title">Your lists</h3>
            <ul className="lists-rows">
              <li className="lists-row">
                <span className="list-dot" style={{ backgroundColor: lists[0].color }} aria-hidden="true" />
                <div className="lists-row-main">
                  <span className="lists-row-name">{lists[0].name}</span>
                  <span className="lists-row-note">Holds every task not in another list</span>
                </div>
              </li>
              {ownLists.map(list => (
                <li key={list.id} className="lists-row">
                  <span className="list-dot" style={{ backgroundColor: list.color }} aria-hidden="true" />
                  <div className="lists-row-main">
                    <input
                      className="form-input lists-row-input"
                      aria-label={`Name of ${list.name}`}
                      value={drafts[list.id] ?? list.name}
                      maxLength={LIST_NAME_MAX}
                      onChange={event => setDrafts(current => ({ ...current, [list.id]: event.target.value }))}
                      onBlur={() => saveName(list)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveName(list);
                        }
                      }}
                    />
                    {rowErrors[list.id] && <p className="lists-error" role="alert">{rowErrors[list.id]}</p>}
                    <ColorPicker
                      value={list.color}
                      onChange={next => onUpdate(list.id, { color: next })}
                      label={`Colour of ${list.name}`}
                    />
                    {confirmingDelete === list.id ? (
                      <div className="lists-confirm" role="group" aria-label={`Delete ${list.name}`}>
                        <p>
                          {taskCounts[list.id]
                            ? `“${list.name}” has ${plural(taskCounts[list.id])}.`
                            : `Delete “${list.name}”?`}
                        </p>
                        <div className="lists-confirm-actions">
                          {taskCounts[list.id] ? (
                            <>
                              <button type="button" className="lists-btn" onClick={() => onDelete(list.id, false)}>
                                Move {taskCounts[list.id] === 1 ? 'it' : 'them'} to {lists[0].name}
                              </button>
                              <button type="button" className="lists-btn lists-btn-danger" onClick={() => onDelete(list.id, true)}>
                                Delete {taskCounts[list.id] === 1 ? 'it' : 'them'} too
                              </button>
                            </>
                          ) : (
                            <button type="button" className="lists-btn lists-btn-danger" onClick={() => onDelete(list.id, false)}>
                              Delete list
                            </button>
                          )}
                          <button type="button" className="lists-btn lists-btn-quiet" onClick={() => setConfirmingDelete(null)}>
                            Keep it
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="lists-delete"
                        onClick={() => setConfirmingDelete(list.id)}
                      >
                        Delete list
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="lists-actions">
              <button type="button" className="lists-btn" onClick={() => onModeChange('new')}>New list</button>
              <button ref={closeRef} type="button" className="cancel-btn lists-btn" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
