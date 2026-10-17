import React, { useEffect, useState } from 'react';
import { FocusPhase, FocusSession, formatRemaining } from '../utils/focusTimer';

interface FocusTimerProps {
  session: FocusSession;
  phase: FocusPhase;
  remainingMs: number;
  canComplete: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onExtend: (minutes: number) => void;
  onComplete: () => void;
  onShowTask: () => void;
}

// Ring around the time: the part still to go
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Floating bar for the focus timer, shown on every view while a session is on
export const FocusTimer: React.FC<FocusTimerProps> = ({
  session,
  phase,
  remainingMs,
  canComplete,
  onPause,
  onResume,
  onStop,
  onExtend,
  onComplete,
  onShowTask
}) => {
  // Runs down while timing; a full green ring once the time is done
  const left = phase === 'finished' ? 1 : session.totalMs > 0 ? Math.min(1, remainingMs / session.totalMs) : 0;
  const label = phase === 'finished' ? 'Time’s up' : phase === 'paused' ? 'Paused' : 'Focusing on';

  // Spoken on changes only; the countdown itself isn't read out every second
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    setAnnouncement(
      phase === 'finished' ? `Time’s up for ${session.title}`
        : phase === 'paused' ? 'Focus timer paused'
          : `Focus timer running for ${session.title}, ${formatRemaining(remainingMs)} left`
    );
    // Only when the phase or task changes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session.taskId]);

  return (
    <section className={`focus-bar focus-${phase}`} aria-label="Focus timer">
      <span className="sr-only" role="status">{announcement}</span>

      <span className="focus-ring" aria-hidden="true">
        <svg viewBox="0 0 36 36">
          <circle className="focus-ring-track" cx="18" cy="18" r={RING_RADIUS} />
          <circle
            className="focus-ring-left"
            cx="18"
            cy="18"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - left)}
          />
        </svg>
      </span>

      <button type="button" className="focus-bar-task" onClick={onShowTask} title="Show this task">
        <span className="focus-bar-label">{label}</span>
        <span className="focus-bar-title">{session.title}</span>
      </button>

      {phase !== 'finished' && (
        <span className="focus-bar-time" role="timer" aria-label="Time left">
          {formatRemaining(remainingMs)}
        </span>
      )}

      <div className="focus-bar-actions">
        {phase === 'running' && (
          <button type="button" className="focus-bar-btn" onClick={onPause}>Pause</button>
        )}
        {phase === 'paused' && (
          <button type="button" className="focus-bar-btn" onClick={onResume}>Resume</button>
        )}
        {phase === 'finished' && (
          <>
            {canComplete && (
              <button type="button" className="focus-bar-btn focus-bar-primary" onClick={onComplete}>
                Mark done
              </button>
            )}
            <button type="button" className="focus-bar-btn" onClick={() => onExtend(5)}>+5 min</button>
          </>
        )}
        <button
          type="button"
          className="focus-bar-close"
          onClick={onStop}
          aria-label={phase === 'finished' ? 'Close focus timer' : 'Stop focus timer'}
          title={phase === 'finished' ? 'Close' : 'Stop'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </section>
  );
};
