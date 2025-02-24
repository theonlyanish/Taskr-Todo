import React from 'react';
import { SyncStatus } from '../services/taskService';

interface SyncIndicatorProps {
  status: SyncStatus;
  onSync: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ status, onSync }) => {
  const getIcon = () => {
    switch (status) {
      case 'synced':
        return '☁️'; // Cloud icon for synced
      case 'syncing':
        return '🔄'; // Rotating arrows for syncing
      case 'unsynced':
        return '📥'; // Download icon for unsynced
      case 'error':
        return '⚠️'; // Warning icon for error
      default:
        return '☁️';
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'synced':
        return 'All changes are synced';
      case 'syncing':
        return 'Syncing changes...';
      case 'unsynced':
        return 'Click to sync changes';
      case 'error':
        return 'Sync error, click to retry';
      default:
        return 'Sync status';
    }
  };

  return (
    <button
      className={`sync-indicator ${status}`}
      onClick={onSync}
      title={getTitle()}
      aria-label={getTitle()}
    >
      {getIcon()}
    </button>
  );
}; 