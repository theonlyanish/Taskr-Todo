import React, { useEffect, useRef, useState } from 'react';

export type DeleteAccountState =
  | { status: 'confirm' | 'deleting'; error?: string }
  | { status: 'done' };

interface DeleteAccountDialogProps {
  email: string;
  taskCount: number;
  isOnline: boolean;
  state: DeleteAccountState;
  onExport: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

// Typed to confirm, since deleting can't be undone
const CONFIRM_WORD = 'delete';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Confirms and reports permanently deleting the signed-in account
export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  email,
  taskCount,
  isOnline,
  state,
  onExport,
  onConfirm,
  onClose
}) => {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const deleting = state.status === 'deleting';
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  // Start in the confirmation box; once deleted, on the button that closes the dialog
  useEffect(() => {
    if (state.status === 'done') doneRef.current?.focus();
    else if (state.status === 'confirm') inputRef.current?.focus();
  }, [state.status]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !deleting) onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (confirmed && isOnline && !deleting) onConfirm();
  };

  return (
    <div className="modal-overlay" onClick={() => !deleting && onClose()}>
      <div
        className="modal-content delete-account-dialog"
        role={state.status === 'done' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {state.status === 'done' ? (
          <>
            <h3 id="delete-account-title">Your account has been deleted</h3>
            <p id="delete-account-description">
              <strong>{email}</strong> and its tasks have been removed from Taskr. You can keep using Taskr on
              this device without an account.
            </p>
            <div className="modal-actions">
              <button ref={doneRef} type="button" className="import-confirm-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 id="delete-account-title">Delete your account?</h3>
            <p id="delete-account-description">
              This permanently deletes <strong>{email}</strong> and {taskCount === 0 ? 'its tasks' : `all ${plural(taskCount, 'task')}`} saved
              to it, on every device. It can’t be undone.
            </p>
            <p className="delete-account-export">
              Want a copy first?{' '}
              <button type="button" className="link-button" onClick={onExport} disabled={deleting}>
                Export your tasks
              </button>
            </p>

            <label className="delete-account-label" htmlFor="delete-account-confirm">
              Type <strong>{CONFIRM_WORD}</strong> to confirm
            </label>
            <input
              ref={inputRef}
              id="delete-account-confirm"
              className="delete-account-input"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              disabled={deleting}
            />

            {!isOnline && (
              <p className="import-note" role="status">
                You’re offline. Connect to the internet to delete your account.
              </p>
            )}
            {state.error && (
              <p className="import-error" role="alert">{state.error}</p>
            )}

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={onClose} disabled={deleting}>
                Cancel
              </button>
              <button type="submit" className="delete-btn" disabled={!confirmed || !isOnline || deleting}>
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
