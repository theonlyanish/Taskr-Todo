import React from 'react';

interface SyncIndicatorProps {
  isSignedIn: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  // Changes made on this device that haven't reached the account yet
  pendingChanges: number;
  syncFailed: boolean;
  onSync: () => void;
  onSignIn: () => void;
}

type SyncState = 'guest' | 'offline' | 'syncing' | 'failed' | 'waiting' | 'saved';

export const syncState = ({ isSignedIn, isOnline, isSyncing, pendingChanges, syncFailed }: Omit<SyncIndicatorProps, 'onSync' | 'onSignIn'>): SyncState => {
  if (!isSignedIn) return 'guest';
  if (!isOnline) return 'offline';
  if (isSyncing) return 'syncing';
  if (syncFailed) return 'failed';
  if (pendingChanges > 0) return 'waiting';
  return 'saved';
};

const changes = (count: number) => `${count} change${count === 1 ? '' : 's'}`;

// Cloud outline shared by every signed-in state; the mark inside says which
const CLOUD = 'M7 18.5h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z';

const marks: Record<Exclude<SyncState, 'guest'>, React.ReactNode> = {
  saved: <path d="M9.6 14.2l1.8 1.8 3.2-3.4" />,
  syncing: <circle className="sync-icon-spinner" cx="12" cy="14.2" r="2.4" />,
  waiting: <path d="M12 16.6v-4.4M10.1 14l1.9-1.9 1.9 1.9" />,
  failed: <path d="M12 11.6v2.8M12 16.8h.01" />,
  offline: <path d="M3.5 4.5l17 16" />
};

// Header button showing whether the account is up to date. Signed in, a click
// syncs now (live sync normally does it on its own); as a guest it opens
// sign-in, since tasks are only kept on this device.
export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ onSync, onSignIn, ...status }) => {
  const state = syncState(status);
  const { pendingChanges } = status;

  const label = {
    guest: 'Saved on this device. Sign in to sync',
    offline: pendingChanges > 0
      ? `Offline. ${changes(pendingChanges)} waiting to sync`
      : 'Offline. Changes are saved on this device',
    syncing: 'Syncing…',
    failed: 'Couldn’t sync. Click to try again',
    waiting: `${changes(pendingChanges)} waiting to sync. Click to send`,
    saved: 'All changes saved. Click to sync now'
  }[state];

  // Nothing to do while offline or mid-sync; aria-disabled keeps the tooltip
  const inactive = state === 'offline' || state === 'syncing';
  const handleClick = () => {
    if (state === 'guest') onSignIn();
    else if (!inactive) onSync();
  };

  return (
    <button
      type="button"
      className={`sync-indicator sync-${state}`}
      onClick={handleClick}
      aria-label={label}
      aria-disabled={inactive || undefined}
      title={label}
    >
      <svg className="sync-icon" viewBox="0 0 24 24" aria-hidden="true">
        {state === 'guest' ? (
          <>
            <rect x="4" y="5" width="16" height="11" rx="1.5" />
            <path d="M2.5 19h19" />
          </>
        ) : (
          <>
            <path d={CLOUD} />
            {marks[state]}
          </>
        )}
      </svg>
      {(state === 'waiting' || state === 'offline') && pendingChanges > 0 && (
        <span className="sync-count" aria-hidden="true">
          {pendingChanges > 99 ? '99+' : pendingChanges}
        </span>
      )}
    </button>
  );
};
