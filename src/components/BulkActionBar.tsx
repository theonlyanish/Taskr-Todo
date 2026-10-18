import React from 'react';
import { TaskStatus } from '../types/Task';

interface BulkActionBarProps {
  count: number;
  total: number;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onDone: () => void;
}

const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Completed'];

// Shown while tasks are selected (Ctrl/⌘-click, Shift-click, or "Select tasks"
// in Ctrl+K): act on all of them at once
export const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, total, onMove, onDelete, onSelectAll, onDone }) => {
  const none = count === 0;

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Selected tasks">
      <span className="bulk-count" role="status">
        {none ? 'Click tasks to select them' : `${count} selected`}
      </span>
      <select
        className="bulk-move"
        aria-label="Move selected tasks to"
        value=""
        disabled={none}
        onChange={event => onMove(event.target.value as TaskStatus)}
      >
        <option value="" disabled>Move to…</option>
        {STATUSES.map(status => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
      <button type="button" className="bulk-btn" disabled={none} onClick={() => onMove('Completed')}>
        Complete
      </button>
      <button type="button" className="bulk-btn bulk-delete" disabled={none} onClick={onDelete}>
        Delete
      </button>
      {count < total && (
        <button type="button" className="bulk-btn bulk-link" onClick={onSelectAll}>
          Select all
        </button>
      )}
      <button type="button" className="bulk-done" onClick={onDone} aria-label="Stop selecting" title="Stop selecting (Esc)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
};
