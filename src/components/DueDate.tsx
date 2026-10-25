import React from 'react';
import { describeDue, useToday } from '../utils/dueDate';
import { describeRepeat, parseRepeatValue } from '../utils/repeat';

interface DueDateProps {
  dueDate: Date | string;
  completed?: boolean;
  className?: string;
  // How the task repeats ("week:1"), shown as a small loop after the date
  repeat?: string | null;
}

// A task's due date as "Today", "Tomorrow", "Friday" or "3 days ago", red once
// it's overdue. The exact date is in the tooltip and read out to screen readers.
export const DueDate: React.FC<DueDateProps> = ({ dueDate, completed = false, className = '', repeat }) => {
  useToday();
  const date = new Date(dueDate);
  const { text, full, tone } = describeDue(date, completed);
  const repeatRule = parseRepeatValue(repeat);
  const repeatText = repeatRule ? describeRepeat(repeatRule, date) : null;

  return (
    <span className={`due-label due-${tone} ${className}`} title={repeatText ? `${full} · ${repeatText}` : full}>
      <svg className="due-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
      <span className="sr-only">
        {tone === 'overdue' ? `Overdue, was due ${full}` : `Due ${full}`}
        {repeatText && `, repeats ${repeatText.replace(/^E/, 'e')}`}
      </span>
      <span aria-hidden="true">{text}</span>
      {repeatText && (
        <svg className="due-repeat-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17 2.5l3 3-3 3M4 11.5v-1a5 5 0 0 1 5-5h11M7 21.5l-3-3 3-3M20 12.5v1a5 5 0 0 1-5 5H4" />
        </svg>
      )}
    </span>
  );
};
