import React, { useEffect, useRef } from 'react';
import { ImportResult } from '../utils/importExport';

export type ImportState =
  | { status: 'preview' | 'saving' | 'done'; fileName: string; result: ImportResult }
  | { status: 'error'; fileName: string; message: string; result?: ImportResult };

interface ImportDialogProps {
  state: ImportState;
  onConfirm: () => void;
  onClose: () => void;
}

// Titles shown in the preview before "and N more"
const PREVIEW_COUNT = 6;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Shows what a chosen file contains and saves it only once confirmed
export const ImportDialog: React.FC<ImportDialogProps> = ({ state, onConfirm, onClose }) => {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const saving = state.status === 'saving';

  useEffect(() => {
    primaryRef.current?.focus();
  }, [state.status]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !saving) onClose();
  };

  const { result } = state;
  const title =
    state.status === 'done' ? 'Import complete'
      : state.status === 'error' ? 'Couldn’t import that file'
        : `Import from ${result?.source === 'Todoist' ? 'Todoist' : 'CSV'}`;

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal-content import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="import-dialog-title">{title}</h3>

        {state.status === 'error' && (
          <p className="import-error" role="alert">{state.message}</p>
        )}

        {result && state.status !== 'error' && (
          <>
            <p>
              <strong>{state.fileName}</strong>
              {state.status === 'done' ? ': imported ' : ' contains '}
              {plural(result.taskCount, 'task')}
              {result.subtaskCount > 0 && ` (${plural(result.subtaskCount, 'subtask')})`}.
            </p>

            {state.status !== 'done' && (
              <>
                {result.unreadDates > 0 && (
                  <p className="import-note">
                    {plural(result.unreadDates, 'date')} couldn’t be read (for example recurring ones) and
                    {result.unreadDates === 1 ? ' was' : ' were'} added to the task’s description instead.
                  </p>
                )}
                {result.source === 'Todoist' && (
                  <p className="import-note">
                    Priorities aren’t imported. Section names are added to each task’s description.
                  </p>
                )}
                <ul className="import-preview">
                  {result.tasks.slice(0, PREVIEW_COUNT).map(task => (
                    <li key={task.id}>
                      <span className="import-preview-title">{task.title}</span>
                      {(task.subtasks?.length ?? 0) > 0 && (
                        <span className="import-preview-meta">{plural(task.subtasks!.length, 'subtask')}</span>
                      )}
                    </li>
                  ))}
                  {result.tasks.length > PREVIEW_COUNT && (
                    <li className="import-preview-more">and {result.tasks.length - PREVIEW_COUNT} more</li>
                  )}
                </ul>
              </>
            )}
          </>
        )}

        <div className="modal-actions">
          {(state.status === 'preview' || state.status === 'saving') && (
            <>
              <button type="button" className="cancel-btn" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                ref={primaryRef}
                type="button"
                className="import-confirm-btn"
                onClick={onConfirm}
                disabled={saving}
              >
                {saving ? 'Importing…' : `Import ${plural(state.result.taskCount, 'task')}`}
              </button>
            </>
          )}
          {(state.status === 'done' || state.status === 'error') && (
            <button ref={primaryRef} type="button" className="import-confirm-btn" onClick={onClose}>
              {state.status === 'done' ? 'Done' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
