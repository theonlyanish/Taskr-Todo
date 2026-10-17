import React, { useEffect, useRef, useState } from 'react';
import { AuthService } from '../services/authService';
import { TaskService } from '../services/taskService';
import { friendlyAuthError } from '../services/supabaseErrors';

export type AuthMode = 'signIn' | 'signUp' | 'reset' | 'updatePassword';

interface AuthProps {
  onAuthStateChange: (isLoggedIn: boolean) => void;
  onClose: () => void;
  // Why sign-in was asked for, e.g. "Sign in to import tasks"; replaces the default line
  message?: string;
  // Guest tasks that will move into the account on sign-in
  guestTaskCount?: number;
  initialMode?: AuthMode;
}

// Supabase's default minimum
const MIN_PASSWORD_LENGTH = 6;

const TITLES: Record<AuthMode, string> = {
  signIn: 'Sign in',
  signUp: 'Create account',
  reset: 'Reset your password',
  updatePassword: 'Choose a new password'
};

const SUBMIT_LABELS: Record<AuthMode, [idle: string, busy: string]> = {
  signIn: ['Sign in', 'Signing in…'],
  signUp: ['Create account', 'Creating account…'],
  reset: ['Send reset link', 'Sending…'],
  updatePassword: ['Update password', 'Updating…']
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type Notice = { kind: 'confirmEmail' | 'resetSent'; email: string };

// Sign in, create account and password reset dialog
export const Auth: React.FC<AuthProps> = ({
  onAuthStateChange,
  onClose,
  message,
  guestTaskCount = 0,
  initialMode = 'signIn'
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ message: string; suggestSignIn?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const noticeButtonRef = useRef<HTMLButtonElement>(null);

  // Return focus to whatever opened the dialog once it closes
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Put focus where the user needs to type (or on the notice's button)
  useEffect(() => {
    (notice ? noticeButtonRef.current : firstFieldRef.current)?.focus();
  }, [mode, notice]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setShowPassword(false);
  };

  // Esc closes; Tab and Shift+Tab stay inside the dialog
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signIn') {
        await AuthService.signIn(email, password);
        // Sync local tasks with cloud after login
        await TaskService.syncTasksWithCloud();
        onAuthStateChange(true);
      } else if (mode === 'signUp') {
        const { session } = await AuthService.signUp(email, password);
        // With email confirmation turned off Supabase signs the user straight in
        if (session) onAuthStateChange(true);
        else setNotice({ kind: 'confirmEmail', email });
      } else if (mode === 'reset') {
        await AuthService.requestPasswordReset(email);
        setNotice({ kind: 'resetSent', email });
      } else {
        await AuthService.updatePassword(password);
        onAuthStateChange(true);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const showModeSwitch = !notice && (mode === 'signIn' || mode === 'signUp');
  const needsEmail = mode !== 'updatePassword';
  const needsPassword = mode !== 'reset';
  const choosingPassword = mode === 'signUp' || mode === 'updatePassword';

  const intro =
    mode === 'reset' ? 'Enter your email and we’ll send you a link to choose a new password.'
      : mode === 'updatePassword' ? 'Enter a new password for your account.'
        : message ?? (
          guestTaskCount > 0
            ? `Sync your tasks across devices. The ${guestTaskCount} task${guestTaskCount === 1 ? '' : 's'} you have now come${guestTaskCount === 1 ? 's' : ''} with you.`
            : 'Sync your tasks across devices and keep them safe in your account.'
        );

  const [idleLabel, busyLabel] = SUBMIT_LABELS[mode];

  return (
    <div className="modal-overlay auth-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        aria-describedby={notice ? 'auth-notice-text' : 'auth-intro'}
        onKeyDown={handleKeyDown}
      >
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="auth-brand">
          <img src="/Logo.png" alt="" />
          <span>Taskr</span>
        </div>

        {notice ? (
          <div className="auth-notice">
            <span className="auth-notice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            </span>
            <h2 id="auth-title" className="auth-title">Check your inbox</h2>
            <p id="auth-notice-text" className="auth-intro">
              {notice.kind === 'confirmEmail'
                ? <>We sent a confirmation link to <strong>{notice.email}</strong>. Open it to finish creating your account, then sign in here.</>
                : <>We sent a password reset link to <strong>{notice.email}</strong>. Open it to choose a new password.</>}
            </p>
            <p className="auth-hint">Nothing there? Check your spam folder.</p>
            <button ref={noticeButtonRef} type="button" className="auth-submit" onClick={() => switchMode('signIn')}>
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {showModeSwitch && (
              <div
                className="view-switcher auth-mode-switch"
                role="group"
                aria-label="Account"
                style={{ '--segments': 2, '--active-index': mode === 'signUp' ? 1 : 0 } as React.CSSProperties}
              >
                <span className="view-switcher-indicator" aria-hidden="true" />
                <button type="button" className="view-switcher-option" aria-pressed={mode === 'signIn'} onClick={() => switchMode('signIn')}>
                  Sign in
                </button>
                <button type="button" className="view-switcher-option" aria-pressed={mode === 'signUp'} onClick={() => switchMode('signUp')}>
                  Create account
                </button>
              </div>
            )}

            {/* The switch already shows the mode, so the heading is for screen readers there */}
            <h2 id="auth-title" className={showModeSwitch ? 'sr-only' : 'auth-title'}>{TITLES[mode]}</h2>
            <p id="auth-intro" className="auth-intro">{intro}</p>

            {error && (
              <div className="auth-alert" role="alert">
                <span>{error.message}</span>
                {error.suggestSignIn && (
                  <button type="button" className="auth-link" onClick={() => switchMode('signIn')}>
                    Sign in instead
                  </button>
                )}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              {needsEmail && (
                <div className="auth-field">
                  <label htmlFor="auth-email">Email</label>
                  <input
                    ref={firstFieldRef}
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
              )}

              {needsPassword && (
                <div className="auth-field">
                  <div className="auth-label-row">
                    <label htmlFor="auth-password">{mode === 'updatePassword' ? 'New password' : 'Password'}</label>
                    {mode === 'signIn' && (
                      <button type="button" className="auth-link" onClick={() => switchMode('reset')}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="auth-password">
                    <input
                      ref={mode === 'updatePassword' ? firstFieldRef : undefined}
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={choosingPassword ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      required
                      minLength={choosingPassword ? MIN_PASSWORD_LENGTH : undefined}
                      aria-describedby={choosingPassword ? 'auth-password-hint' : undefined}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword(shown => !shown)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.5 9.5 0 0112 5c5 0 8.5 4.5 9.5 7a13 13 0 01-2.6 3.8M6.1 6.1C4.2 7.4 3 9.3 2.5 12c1 2.5 4.5 7 9.5 7a9.3 9.3 0 004.3-1" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  {choosingPassword && (
                    <p id="auth-password-hint" className="auth-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
                  )}
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading && <span className="auth-spinner" aria-hidden="true" />}
                {loading ? busyLabel : idleLabel}
              </button>
            </form>

            {mode === 'reset' && (
              <button type="button" className="auth-link auth-back" onClick={() => switchMode('signIn')}>
                Back to sign in
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
