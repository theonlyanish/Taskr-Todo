import React from 'react';
import { Task } from '../types/Task';

interface SubtaskProgressProps {
  subtasks: Task[];
  expanded: boolean;
  // Omitted for a picture of the card (the board's drag copy): no button then
  onToggle?: () => void;
  controlsId?: string;
}

const RADIUS = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// "1/3 subtasks" with a ring that fills as they're done; shows or hides the subtasks
export const SubtaskProgress: React.FC<SubtaskProgressProps> = ({ subtasks, expanded, onToggle, controlsId }) => {
  const total = subtasks.length;
  const done = subtasks.filter(subtask => subtask.status === 'Completed').length;
  const allDone = total > 0 && done === total;

  const content = (
    <>
      <svg className="subtask-progress-ring" viewBox="0 0 14 14" aria-hidden="true">
        <circle className="subtask-progress-track" cx="7" cy="7" r={RADIUS} />
        <circle
          className="subtask-progress-done"
          cx="7"
          cy="7"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - done / total)}
        />
      </svg>
      <span aria-hidden="true">{done}/{total} subtasks</span>
      <svg className="subtask-progress-caret" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </>
  );

  const className = `subtask-progress ${allDone ? 'all-done' : ''} ${expanded ? 'expanded' : ''}`;

  if (!onToggle) return <span className={className}>{content}</span>;

  return (
    <button
      type="button"
      className={className}
      aria-expanded={expanded}
      aria-controls={controlsId}
      aria-label={`${done} of ${total} subtasks done. ${expanded ? 'Hide' : 'Show'} subtasks`}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
      // Keep Enter and Space for the chip, not the card it sits in
      onKeyDown={event => event.stopPropagation()}
    >
      {content}
    </button>
  );
};
