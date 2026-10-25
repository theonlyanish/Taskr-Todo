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
  // Shown once Google sign-in is switched on for the Supabase project
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [leavingForGoogle, setLeavingForGoogle] = useState(false);
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

  useEffect(() => {
    let active = true;
    AuthService.googleSignInEnabled().then(enabled => active && setGoogleAvailable(enabled));
    return () => {
      active = false;
    };
  }, []);

  const continueWithGoogle = async () => {
    setError(null);
    setLeavingForGoogle(true);
    try {
      await AuthService.signInWithGoogle();
      // The page goes to Google from here
    } catch (err) {
      setError(friendlyAuthError(err));
      setLeavingForGoogle(false);
    }
  };

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

            {showModeSwitch && googleAvailable && (
              <>
                <button
                  type="button"
                  className="auth-google"
                  onClick={continueWithGoogle}
                  disabled={leavingForGoogle || loading}
                >
                  <svg className="auth-google-mark" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  {leavingForGoogle ? 'Opening Google…' : 'Continue with Google'}
                </button>
                <div className="auth-divider" aria-hidden="true"><span>or</span></div>
              </>
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
