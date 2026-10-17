import { useCallback, useEffect, useRef, useState } from 'react';

// A countdown for working on one task. It's kept as the time it ends, not a
// ticking counter, so it stays right in a throttled background tab and
// carries on after a reload. While it runs, the browser tab shows the time
// left, so it's visible from other tabs too.

export const FOCUS_LENGTHS = [15, 25, 50] as const;

export interface FocusSession {
  taskId: string;
  title: string;
  totalMs: number; // planned length, including any minutes added
  endsAt: number | null; // when running: the clock time it ends
  remainingMs: number | null; // when paused: what was left
}

export type FocusPhase = 'running' | 'paused' | 'finished';

const STORAGE_KEY = 'focusSession';

const load = (): FocusSession | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved.taskId === 'string' && typeof saved.totalMs === 'number') return saved;
  } catch {
    // Unreadable or storage unavailable
  }
  return null;
};

const save = (session: FocusSession | null) => {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not kept across a reload, but the timer still works
  }
};

const remainingOf = (session: FocusSession, now: number) =>
  session.endsAt !== null ? Math.max(0, session.endsAt - now) : session.remainingMs ?? 0;

// 25:00, 4:05, and 1:02:30 for anything an hour or longer
export const formatRemaining = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

// A soft two-note chime. Needs an AudioContext made during a click (browsers
// block sound that no one asked for), so one is opened when the timer starts.
const chime = (audio: AudioContext | null) => {
  if (!audio) return;
  try {
    audio.resume();
    [0, 0.22].forEach((offset, index) => {
      const start = audio.currentTime + offset;
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.type = 'sine';
      tone.frequency.value = index === 0 ? 660 : 880;
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      tone.connect(volume).connect(audio.destination);
      tone.start(start);
      tone.stop(start + 0.65);
    });
  } catch {
    // No sound; the tab title and the timer bar still say time's up
  }
};

export const useFocusTimer = () => {
  const [session, setSessionState] = useState<FocusSession | null>(load);
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<AudioContext | null>(null);
  // The page title before the timer took it over
  const baseTitleRef = useRef(document.title);

  const setSession = useCallback((next: FocusSession | null) => {
    save(next);
    setSessionState(next);
    setNow(Date.now());
  }, []);

  const remainingMs = session ? remainingOf(session, now) : 0;
  const phase: FocusPhase | null = !session
    ? null
    : session.endsAt === null ? 'paused' : remainingMs <= 0 ? 'finished' : 'running';

  // Tick once a second, on the second, while running
  useEffect(() => {
    if (phase !== 'running' || !session?.endsAt) return;
    const untilNextSecond = (session.endsAt - Date.now()) % 1000 || 1000;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      interval = window.setInterval(() => setNow(Date.now()), 1000);
    }, untilNextSecond);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [phase, session?.endsAt]);

  // Chime when time runs out with the page open (not for a session that ran
  // out while the page was closed)
  const previousPhaseRef = useRef(phase);
  useEffect(() => {
    if (previousPhaseRef.current === 'running' && phase === 'finished') chime(audioRef.current);
    previousPhaseRef.current = phase;
  }, [phase]);

  // Time left in the browser tab
  useEffect(() => {
    if (!session || !phase) {
      document.title = baseTitleRef.current;
      return;
    }
    const time = formatRemaining(remainingMs);
    document.title =
      phase === 'finished' ? `Time’s up · ${session.title}`
        : phase === 'paused' ? `Paused ${time} · ${session.title}`
          : `${time} · ${session.title}`;
  }, [session, phase, remainingMs]);

  useEffect(() => {
    const baseTitle = baseTitleRef.current;
    return () => {
      document.title = baseTitle;
    };
  }, []);

  // Called from the buttons that start the clock, which count as the click
  // browsers need before they'll play the chime
  const ensureAudio = () => {
    if (audioRef.current || typeof window.AudioContext !== 'function') return;
    try {
      audioRef.current = new window.AudioContext();
    } catch {
      // Sound unavailable
    }
  };

  const start = (taskId: string, title: string, minutes: number) => {
    ensureAudio();
    const totalMs = minutes * 60_000;
    setSession({ taskId, title, totalMs, endsAt: Date.now() + totalMs, remainingMs: null });
  };

  const pause = () => {
    if (session?.endsAt) setSession({ ...session, endsAt: null, remainingMs: remainingOf(session, Date.now()) });
  };

  const resume = () => {
    if (session && session.endsAt === null) {
      ensureAudio();
      setSession({ ...session, endsAt: Date.now() + (session.remainingMs ?? 0), remainingMs: null });
    }
  };

  // After time's up: keep going a little longer
  const extend = (minutes: number) => {
    if (!session) return;
    ensureAudio();
    const extra = minutes * 60_000;
    setSession({ ...session, totalMs: session.totalMs + extra, endsAt: Date.now() + extra, remainingMs: null });
  };

  const stop = useCallback(() => setSession(null), [setSession]);

  // Follow the task if it's renamed
  const rename = useCallback((title: string) => {
    setSessionState(current => {
      if (!current || current.title === title) return current;
      const next = { ...current, title };
      save(next);
      return next;
    });
  }, []);

  return { session, phase, remainingMs, start, pause, resume, extend, stop, rename };
};
