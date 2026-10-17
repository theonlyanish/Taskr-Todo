import React from 'react';

interface UndoToastProps {
  message: string;
  durationMs: number;
  onUndo: () => void;
  onDismiss: () => void;
}

// Bottom-of-screen notice shown after a delete, with a bar that runs down
// over the undo window.
export const UndoToast: React.FC<UndoToastProps> = ({ message, durationMs, onUndo, onDismiss }) => {
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast-message">{message}</span>
      <button type="button" className="undo-toast-undo" onClick={onUndo}>
        Undo
      </button>
      <button
        type="button"
        className="undo-toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
      <span className="undo-toast-timer" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );
};
