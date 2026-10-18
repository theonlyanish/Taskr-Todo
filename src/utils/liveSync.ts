import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

// Keeps other tabs and devices up to date when tasks change here.
//
// No task data is sent. Other tabs on this device are told through the
// browser (BroadcastChannel), with no server involved, and read the tasks
// from this device's storage; that works for guests too. Other devices of a
// signed-in user get a "your tasks changed" ping through Supabase Realtime
// and fetch the tasks from the server through the usual access rules.
//
// To stay well inside Supabase's free Realtime limits (200 connections at
// once, 2 million messages a month), only signed-in tabs connect, a tab that
// has been hidden for a minute lets go of its connection (and catches up when
// it's shown again), and a burst of changes sends one ping. Past the limits,
// Supabase refuses the connection rather than charging, and the app falls
// back to syncing on load, on reconnect and from the sync button.

const TAB_CHANNEL = 'taskr-tasks';
const EVENT = 'tasks-changed';
// Changes within this window send one ping
const PING_DELAY_MS = 1000;
// Several pings arriving together cause one refresh
const REFRESH_DELAY_MS = 400;
const HIDDEN_DISCONNECT_MS = 60_000;

// A random name for this browser, shared by its tabs. Pings carry it so tabs
// here ignore pings from each other: they already heard through the browser.
const deviceId = (() => {
  const fresh = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    const saved = localStorage.getItem('deviceId');
    if (saved) return saved;
    const id = fresh();
    localStorage.setItem('deviceId', id);
    return id;
  } catch {
    return fresh();
  }
})();

interface LiveSyncOptions {
  userId: string | undefined;
  // Another tab on this device changed the tasks: read them from storage
  onTabChange: () => void;
  // Another device changed the tasks, or this tab may have missed something
  // while it wasn't connected: fetch them from the server
  onDeviceChange: () => void;
}

// "Your tasks changed", to this user's other devices. Only the sending
// device's random name goes with it, never task data.
const sendPing = (channel: RealtimeChannel) => {
  channel.send({ type: 'broadcast', event: EVENT, payload: { device: deviceId } }).catch(() => {
    // Not delivered; other devices still catch up on their next sync
  });
};

export const useLiveSync = ({ userId, onTabChange, onDeviceChange }: LiveSyncOptions) => {
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;
  const onDeviceChangeRef = useRef(onDeviceChange);
  onDeviceChangeRef.current = onDeviceChange;

  const tabChannelRef = useRef<BroadcastChannel | null>(null);
  const deviceChannelRef = useRef<RealtimeChannel | null>(null);
  const pingTimerRef = useRef<number | undefined>(undefined);
  // A ping that couldn't go yet because the channel wasn't connected
  const pingWaitingRef = useRef(false);
  // Which account the tabs are talking about, so a guest tab ignores a signed-in one
  const accountKey = userId ?? 'guest';

  // Other tabs on this device
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(TAB_CHANNEL);
    tabChannelRef.current = channel;
    let timer: number | undefined;
    channel.onmessage = event => {
      if (event.data?.type !== EVENT || event.data.account !== accountKey) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onTabChangeRef.current(), REFRESH_DELAY_MS);
    };
    return () => {
      window.clearTimeout(timer);
      channel.close();
      tabChannelRef.current = null;
    };
  }, [accountKey]);

  // Other devices, for signed-in users, while this tab is in use
  useEffect(() => {
    if (!userId) return;
    let refreshTimer: number | undefined;
    let hiddenTimer: number | undefined;
    let disconnectedWhileHidden = false;

    const refreshSoon = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => onDeviceChangeRef.current(), REFRESH_DELAY_MS);
    };

    const connect = () => {
      if (deviceChannelRef.current) return;
      let joinedBefore = false;
      // Self is off by default: this tab doesn't hear its own pings
      const channel = supabase
        .channel(`tasks:${userId}`)
        .on('broadcast', { event: EVENT }, message => {
          if (message.payload?.device !== deviceId) refreshSoon();
        })
        .subscribe(status => {
          if (String(status) !== 'SUBSCRIBED') return;
          // Back after a dropped connection: catch up on anything missed
          if (joinedBefore) refreshSoon();
          joinedBefore = true;
          // And send a ping that was waiting for the connection
          if (pingWaitingRef.current) {
            pingWaitingRef.current = false;
            sendPing(channel);
          }
        });
      deviceChannelRef.current = channel;
    };

    const disconnect = () => {
      const channel = deviceChannelRef.current;
      deviceChannelRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimer = window.setTimeout(() => {
          disconnect();
          disconnectedWhileHidden = true;
        }, HIDDEN_DISCONNECT_MS);
        return;
      }
      window.clearTimeout(hiddenTimer);
      if (disconnectedWhileHidden) {
        disconnectedWhileHidden = false;
        connect();
        // Anything changed elsewhere while this tab wasn't listening
        onDeviceChangeRef.current();
      }
    };

    if (document.visibilityState === 'visible') connect();
    else disconnectedWhileHidden = true;
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(refreshTimer);
      window.clearTimeout(hiddenTimer);
      disconnect();
    };
  }, [userId]);

  // Tell other tabs straight away (they read this device's storage, which is
  // already saved), and other devices once a burst of changes has settled
  const announceChange = useCallback(() => {
    tabChannelRef.current?.postMessage({ type: EVENT, account: accountKey });
    if (!userId) return;
    pingWaitingRef.current = true;
    window.clearTimeout(pingTimerRef.current);
    pingTimerRef.current = window.setTimeout(() => {
      // Not connected (yet): it goes once the channel joins
      const channel = deviceChannelRef.current;
      if (channel && String(channel.state) === 'joined') {
        pingWaitingRef.current = false;
        sendPing(channel);
      }
    }, PING_DELAY_MS);
  }, [accountKey, userId]);

  return { announceChange };
};
