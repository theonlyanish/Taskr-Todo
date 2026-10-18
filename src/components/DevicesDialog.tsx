import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthService, DeviceSession } from '../services/authService';
import { isSupabaseUnavailable } from '../services/supabaseErrors';
import { deviceName, timeAgo } from '../utils/deviceName';

interface DevicesDialogProps {
  isOnline: boolean;
  // Sign out every device but this one; resolves once done
  onSignOutOthers: () => Promise<void>;
  // Sign out every device including this one (the dialog closes with it)
  onSignOutEverywhere: () => Promise<void>;
  onClose: () => void;
}

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; sessions: DeviceSession[] }
  // The list_my_sessions migration hasn't run, or the server can't be reached
  | { status: 'unavailable'; reason: 'setup' | 'offline' };

// Where you're signed in, and signing other devices out (say, after using a
// shared computer)
export const DevicesDialog: React.FC<DevicesDialogProps> = ({
  isOnline,
  onSignOutOthers,
  onSignOutEverywhere,
  onClose
}) => {
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [busy, setBusy] = useState<'others' | 'everywhere' | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      setList({ status: 'ready', sessions: await AuthService.listSessions() });
    } catch (error) {
      setList({ status: 'unavailable', reason: isSupabaseUnavailable(error) ? 'offline' : 'setup' });
      if (!isSupabaseUnavailable(error)) console.error('Listing signed-in devices failed:', error);
    }
  }, []);

  useEffect(() => {
    load();
    closeRef.current?.focus();
  }, [load]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onClose();
    }
  };

  const signOutOthers = async () => {
    setBusy('others');
    setMessage(null);
    try {
      await onSignOutOthers();
      setMessage({ text: 'Your other devices are signed out. Any that are open now will leave within the hour.' });
      await load();
    } catch (error) {
      setMessage({
        text: isSupabaseUnavailable(error)
          ? 'Couldn’t reach Taskr’s servers, so nothing changed. Check your connection and try again.'
          : 'Something went wrong, so nothing changed. Try again.',
        error: true
      });
    } finally {
      setBusy(null);
    }
  };

  const signOutEverywhere = async () => {
    setBusy('everywhere');
    setMessage(null);
    try {
      await onSignOutEverywhere();
    } catch (error) {
      setBusy(null);
      setMessage({
        text: isSupabaseUnavailable(error)
          ? 'Couldn’t reach Taskr’s servers, so nothing changed. Check your connection and try again.'
          : 'Something went wrong, so nothing changed. Try again.',
        error: true
      });
    }
  };

  const others = list.status === 'ready' ? list.sessions.filter(session => !session.isCurrent).length : null;

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div
        className="modal-content devices-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="devices-title"
        aria-busy={list.status === 'loading' || !!busy}
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="devices-title">Signed-in devices</h3>

        {list.status === 'loading' && <p className="devices-note">Loading…</p>}
        {list.status === 'unavailable' && (
          <p className="devices-note">
            {list.reason === 'offline'
              ? 'The list needs a connection. You can still sign devices out below once you’re back online.'
              : 'The list isn’t available right now, but signing devices out below still works.'}
          </p>
        )}
        {list.status === 'ready' && (
          <ul className="devices-list">
            {list.sessions.map(session => (
              <li key={session.id} className="device-row">
                <svg className="device-icon" viewBox="0 0 24 24" aria-hidden="true">
                  {/iPhone|Android|iPad/.test(session.userAgent ?? '')
                    ? <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>
                    : <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>}
                </svg>
                <div className="device-details">
                  <span className="device-name">
                    {deviceName(session.userAgent)}
                    {session.isCurrent && <span className="device-current">This device</span>}
                  </span>
                  <span className="device-meta">
                    {session.isCurrent ? 'Active now' : `Last active ${timeAgo(session.lastActiveAt)}`}
                    {' · '}Signed in {session.createdAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {message && (
          <p className={`devices-message ${message.error ? 'is-error' : ''}`} role={message.error ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
        {!isOnline && <p className="devices-note" role="status">You’re offline. Connect to sign devices out.</p>}

        <div className="devices-actions">
          <button
            type="button"
            className="devices-btn"
            onClick={signOutOthers}
            disabled={!isOnline || !!busy || others === 0}
          >
            {busy === 'others' ? 'Signing out…' : 'Sign out other devices'}
          </button>
          <button
            type="button"
            className="devices-btn devices-btn-danger"
            onClick={signOutEverywhere}
            disabled={!isOnline || !!busy}
          >
            {busy === 'everywhere' ? 'Signing out…' : 'Sign out everywhere'}
          </button>
          <button ref={closeRef} type="button" className="cancel-btn devices-close" onClick={onClose} disabled={!!busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
