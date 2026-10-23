import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SyncIndicator } from './SyncIndicator';

const signedIn = { isSignedIn: true, isOnline: true, isSyncing: false, pendingChanges: 0, syncFailed: false };

const renderIndicator = (status: Partial<typeof signedIn> = {}) => {
  const handlers = { onSync: jest.fn(), onSignIn: jest.fn() };
  render(<SyncIndicator {...signedIn} {...status} {...handlers} />);
  return { ...handlers, button: screen.getByRole('button') };
};

describe('the sync button', () => {
  it('says everything is saved and syncs when clicked', () => {
    const { button, onSync } = renderIndicator();
    expect(button).toHaveAccessibleName('All changes saved. Click to sync now');
    fireEvent.click(button);
    expect(onSync).toHaveBeenCalled();
  });

  it('opens sign in for a guest instead of syncing', () => {
    const { button, onSync, onSignIn } = renderIndicator({ isSignedIn: false, pendingChanges: 3 });
    expect(button).toHaveAccessibleName('Saved on this device. Sign in to sync');
    fireEvent.click(button);
    expect(onSignIn).toHaveBeenCalled();
    expect(onSync).not.toHaveBeenCalled();
  });

  it('counts changes waiting to be sent', () => {
    const { button } = renderIndicator({ pendingChanges: 1 });
    expect(button).toHaveAccessibleName('1 change waiting to sync. Click to send');
    expect(button).toHaveTextContent('1');
  });

  it('does nothing while offline, but still says what is waiting', () => {
    const { button, onSync } = renderIndicator({ isOnline: false, pendingChanges: 3 });
    expect(button).toHaveAccessibleName('Offline. 3 changes waiting to sync');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onSync).not.toHaveBeenCalled();
  });

  it('offers to try again after a failed sync', () => {
    const { button, onSync } = renderIndicator({ syncFailed: true, pendingChanges: 2 });
    expect(button).toHaveAccessibleName('Couldn’t sync. Click to try again');
    fireEvent.click(button);
    expect(onSync).toHaveBeenCalled();
  });

  it('shows syncing over everything else except being offline', () => {
    const { button } = renderIndicator({ isSyncing: true, syncFailed: true, pendingChanges: 2 });
    expect(button).toHaveAccessibleName('Syncing…');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
