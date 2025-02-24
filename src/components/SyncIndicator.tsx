import React from 'react';

interface SyncIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  onSync: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  isOnline,
  isSyncing,
  onSync
}) => {
  const getIcon = () => {
    if (!isOnline) return '📡'; // Offline icon
    if (isSyncing) return '🔄'; // Syncing icon
    return '☁️'; // Cloud icon for online
  };

  const getClassName = () => {
    let className = 'sync-indicator';
    if (!isOnline) className += ' offline';
    if (isSyncing) className += ' syncing';
    return className;
  };

  return (
    <button
      className={getClassName()}
      onClick={onSync}
      title={!isOnline ? 'Offline' : isSyncing ? 'Syncing...' : 'Sync'}
      disabled={!isOnline || isSyncing}
    >
      {getIcon()}
    </button>
  );
}; 