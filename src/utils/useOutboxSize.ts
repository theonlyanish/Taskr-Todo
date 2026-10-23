import { useEffect, useState } from 'react';
import { onOutboxChange, outboxSize } from '../services/syncQueue';

// How many of the signed-in user's changes are waiting on this device to
// reach the account. Re-read when this tab queues or sends changes, and when
// the window regains focus (another tab may have sent them).
export const useOutboxSize = (userId: string | undefined) => {
  const [size, setSize] = useState(0);

  useEffect(() => {
    if (!userId) {
      setSize(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      outboxSize(userId)
        .then(count => {
          if (!cancelled) setSize(count);
        })
        .catch(() => {
          // Storage unavailable: nothing can be queued either
        });
    };
    refresh();
    const unsubscribe = onOutboxChange(refresh);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', refresh);
    };
  }, [userId]);

  return size;
};
