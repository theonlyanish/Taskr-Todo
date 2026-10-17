import React, { useLayoutEffect, useState } from 'react';
import { TaskStatus } from '../types/Task';

// When a task changes status its card usually moves to another section or
// column, where React creates a fresh element, so a CSS transition has nothing
// to start from. This remembers each task's last status across those remounts
// and plays a one-off animation that sweeps the colour strip around the colour
// wheel from the old status colour to the new one (see .status-morph in styles.css).

const STATUS_COLOR: Record<TaskStatus, string> = {
  'To Do': 'var(--status-todo)',
  'In Progress': 'var(--status-progress)',
  Completed: 'var(--status-done)'
};

const lastSeenStatus = new Map<string, TaskStatus>();

interface Morph {
  from: TaskStatus;
  to: TaskStatus;
  run: number; // alternates the animation name so back-to-back changes restart it
}

let runCounter = 0;

export const useStatusMorph = (taskId: string, status: TaskStatus) => {
  const [morph, setMorph] = useState<Morph | null>(null);

  // Layout effect so the start colour is applied before the browser paints
  useLayoutEffect(() => {
    const previous = lastSeenStatus.get(taskId);
    lastSeenStatus.set(taskId, status);
    if (previous && previous !== status) {
      setMorph({ from: previous, to: status, run: runCounter++ });
    }
  }, [taskId, status]);

  if (!morph) return { className: '', style: undefined, onAnimationEnd: undefined };

  return {
    className: `status-morph status-morph-${morph.run % 2}`,
    style: {
      '--morph-from': STATUS_COLOR[morph.from],
      '--morph-to': STATUS_COLOR[morph.to]
    } as React.CSSProperties,
    onAnimationEnd: (event: React.AnimationEvent) => {
      if (event.target === event.currentTarget && event.animationName.startsWith('status-morph')) {
        setMorph(null);
      }
    }
  };
};
