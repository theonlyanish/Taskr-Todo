import React from 'react';
import { describeDue, useToday } from '../utils/dueDate';

interface DueDateProps {
  dueDate: Date | string;
  completed?: boolean;
  className?: string;
}

// A task's due date as "Today", "Tomorrow", "Friday" or "3 days ago", red once
// it's overdue. The exact date is in the tooltip and read out to screen readers.
export const DueDate: React.FC<DueDateProps> = ({ dueDate, completed = false, className = '' }) => {
  useToday();
  const { text, full, tone } = describeDue(new Date(dueDate), completed);

  return (
    <span className={`due-label due-${tone} ${className}`} title={full}>
      <svg className="due-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
      <span className="sr-only">{tone === 'overdue' ? `Overdue, was due ${full}` : `Due ${full}`}</span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
};
