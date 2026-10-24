import React, { useEffect, useMemo, useRef } from 'react';
import { Task } from '../types/Task';
import { computeStats, formatDuration } from '../utils/stats';

interface StatsDialogProps {
  tasks: Task[];
  isSignedIn: boolean;
  onOpenTask: (task: Task) => void;
  onClose: () => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const weekLabel = (start: Date) => start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Tasks done per week, the current streak and how long tasks take once
// started, worked out from the task list (utils/stats)
export const StatsDialog: React.FC<StatsDialogProps> = ({ tasks, isSignedIn, onOpenTask, onClose }) => {
  const stats = useMemo(() => computeStats(tasks, new Date()), [tasks]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  const busiest = Math.max(...stats.weeks.map(week => week.count));
  const lastIndex = stats.weeks.length - 1;
  // Values on the caps of this week and the busiest week only; the tooltip
  // and the table carry the rest
  const busiestIndex = stats.weeks.findIndex(week => week.count === busiest);
  const nothingDone = stats.weeks.every(week => week.count === 0);
  const longest = stats.inProgressNow.slice(0, 3);
  const notShown = stats.inProgressCount - longest.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content stats-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-title"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="stats-title">Your stats</h3>

        <div className="stats-tiles">
          <div className="stats-tile">
            <span className="stats-tile-label">Done this week</span>
            <span className="stats-tile-value">{stats.doneThisWeek}</span>
            <span className="stats-tile-note">{stats.doneLastWeek} last week</span>
          </div>
          <div className="stats-tile">
            <span className="stats-tile-label">Streak</span>
            <span className="stats-tile-value">{plural(stats.currentStreak, 'day')}</span>
            <span className="stats-tile-note">
              {stats.bestStreak > 0 ? `Best: ${plural(stats.bestStreak, 'day')}` : 'Finish a task to start one'}
            </span>
          </div>
          <div className="stats-tile">
            <span className="stats-tile-label">Time in progress</span>
            <span className="stats-tile-value">
              {stats.medianInProgressMs === null ? '–' : formatDuration(stats.medianInProgressMs)}
            </span>
            <span className="stats-tile-note">
              {stats.medianInProgressMs === null
                ? 'Shows once tasks go from In Progress to done'
                : `Typical, across ${plural(stats.inProgressMeasured, 'task')}`}
            </span>
          </div>
        </div>

        <h4 className="stats-heading" id="stats-weeks-title">Tasks done per week</h4>
        <div className="stats-chart" aria-hidden="true">
          {stats.weeks.map((week, index) => {
            const label = index === lastIndex ? 'This week' : `Week of ${weekLabel(week.start)}`;
            const showValue = week.count > 0 && (index === lastIndex || index === busiestIndex);
            return (
              <div key={week.start.getTime()} className="stats-column">
                <span className="stats-tip">
                  {label}: {plural(week.count, 'task')}
                </span>
                <div className="stats-plot">
                  {showValue && <span className="stats-value">{week.count}</span>}
                  {week.count > 0 && (
                    <span className="stats-bar" style={{ height: `${(week.count / busiest) * 100}%` }} />
                  )}
                </div>
                <span className={`stats-week ${index === lastIndex ? 'is-current' : ''}`}>
                  {index === lastIndex ? 'Now' : weekLabel(week.start)}
                </span>
              </div>
            );
          })}
        </div>
        {nothingDone && <p className="stats-empty stats-chart-empty">Complete a task and it shows up here.</p>}
        <table className="sr-only" aria-labelledby="stats-weeks-title">
          <thead>
            <tr>
              <th scope="col">Week starting</th>
              <th scope="col">Tasks done</th>
            </tr>
          </thead>
          <tbody>
            {stats.weeks.map(week => (
              <tr key={week.start.getTime()}>
                <td>{weekLabel(week.start)}</td>
                <td>{week.count}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 className="stats-heading">In progress now</h4>
        {stats.inProgressCount === 0 ? (
          <p className="stats-empty">Nothing in progress.</p>
        ) : (
          <ul className="stats-progress">
            {longest.map(({ task, forMs }) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="stats-progress-task"
                  onClick={() => {
                    onClose();
                    onOpenTask(task);
                  }}
                >
                  <span className="stats-progress-title">{task.title}</span>
                  <span className="stats-progress-time">{formatDuration(forMs)}</span>
                </button>
              </li>
            ))}
            {notShown > 0 && (
              <li className="stats-progress-more">
                {longest.length
                  ? `and ${notShown} more`
                  : `${plural(notShown, 'task')}, started before stats were added`}
              </li>
            )}
          </ul>
        )}

        <p className="stats-footnote">
          From the tasks {isSignedIn ? 'in your account' : 'on this device'}. Tasks count, not subtasks, and
          deleted tasks are left out.
          {stats.approximate && ' Tasks finished before stats were added use the time they were last edited.'}
        </p>

        <div className="stats-actions">
          <button ref={closeRef} type="button" className="cancel-btn stats-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
