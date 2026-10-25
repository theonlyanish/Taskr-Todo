import React from 'react';
import { Task } from '../types/Task';
import { daysUntil, describeDue, useToday } from '../utils/dueDate';

interface ComingUpProps {
  // The list showing: its tasks and their subtasks
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
}

const SHOWN_PER_GROUP = 5;
const WEEK_AHEAD = 6;

interface Group {
  title: string;
  tone: 'overdue' | 'today' | 'upcoming';
  tasks: Task[];
}

// What's due soon, under the add-task card while no task is open: overdue,
// today, then the next six days. Unfinished tasks and subtasks with a due date.
export const comingUpGroups = (tasks: Task[], now = new Date()): Group[] => {
  // Subtasks sit inside their parent and sometimes at the top level too
  const seen = new Set<string>();
  const all = tasks
    .filter(task => !task.isSubtask)
    .flatMap(task => [task, ...(task.subtasks ?? [])])
    .filter(task => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return !!task.dueDate && task.status !== 'Completed';
    })
    .map(task => ({ task, days: daysUntil(new Date(task.dueDate!), now) }))
    .sort((a, b) => a.days - b.days);

  return [
    { title: 'Overdue', tone: 'overdue' as const, tasks: all.filter(({ days }) => days < 0) },
    { title: 'Today', tone: 'today' as const, tasks: all.filter(({ days }) => days === 0) },
    { title: 'This week', tone: 'upcoming' as const, tasks: all.filter(({ days }) => days > 0 && days <= WEEK_AHEAD) }
  ]
    .map(group => ({ ...group, tasks: group.tasks.map(({ task }) => task) }))
    .filter(group => group.tasks.length > 0);
};

export const ComingUp: React.FC<ComingUpProps> = ({ tasks, onTaskSelect }) => {
  // Re-sorted at midnight on a page left open
  useToday();
  const groups = comingUpGroups(tasks);
  const parentTitle = (task: Task) => tasks.find(parent => parent.id === task.parentId)?.title;

  return (
    <section className="coming-up" aria-labelledby="coming-up-title">
      <h2 id="coming-up-title" className="coming-up-title">Coming up</h2>
      {groups.length === 0 ? (
        <p className="coming-up-empty">Nothing due in the next week. Give a task a date and it shows up here.</p>
      ) : (
        groups.map(group => (
          <div key={group.title} className="coming-up-group">
            <h3 className={`coming-up-heading is-${group.tone}`}>{group.title}</h3>
            <ul className="coming-up-list">
              {group.tasks.slice(0, SHOWN_PER_GROUP).map(task => {
                const due = describeDue(new Date(task.dueDate!));
                const parent = task.isSubtask ? parentTitle(task) : undefined;
                return (
                  <li key={task.id}>
                    <button type="button" className="coming-up-task" onClick={() => onTaskSelect(task)}>
                      <span className="coming-up-task-title">
                        {task.title}
                        {parent && <span className="coming-up-parent">in {parent}</span>}
                      </span>
                      {group.tone !== 'today' && (
                        <span className={`coming-up-due is-${group.tone}`} title={due.full}>{due.text}</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {group.tasks.length > SHOWN_PER_GROUP && (
                <li className="coming-up-more">and {group.tasks.length - SHOWN_PER_GROUP} more</li>
              )}
            </ul>
          </div>
        ))
      )}
    </section>
  );
};
