import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { TaskService } from '../services/taskService';

interface AuthProps {
  onAuthStateChange: (isLoggedIn: boolean) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthStateChange }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await AuthService.signIn(email, password);
        // Sync local tasks with cloud after login
        await TaskService.syncTasksWithCloud();
        onAuthStateChange(true);
      } else {
        await AuthService.signUp(email, password);
        setShowVerification(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
      <p className="auth-description">
        Sign in to save your tasks and access them anytime, anywhere
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />
        </div>

        {error && <div className="auth-error">{error}</div>}
        {showVerification && !isLogin && (
          <div className="auth-verification-text">
            Please check your email for account verification
          </div>
        )}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setShowVerification(false);
          }}
          className="auth-toggle"
        >
          {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
        </button>
      </form>
    </div>
  );
}; 