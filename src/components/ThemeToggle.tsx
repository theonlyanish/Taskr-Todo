import React from 'react';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

// Light/dark switch in the header. One icon that turns from a sun into a moon:
// the rays fold away and a shadow slides across the sun, leaving a crescent
// (and back again). "Match my device" is in Ctrl+K and the account menu.
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, onToggle }) => {
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`theme-toggle ${isDark ? 'is-dark' : ''}`}
      aria-label={label}
      title={label}
    >
      <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
        <mask id="theme-icon-shadow">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          {/* The shadow: off to the side for the sun, over it for the moon */}
          <circle className="theme-icon-shadow" cx="24" cy="10" r="6" fill="black" />
        </mask>
        <circle className="theme-icon-body" cx="12" cy="12" r="5" mask="url(#theme-icon-shadow)" />
        <g className="theme-icon-rays">
          <line x1="12" y1="1.5" x2="12" y2="3.5" />
          <line x1="12" y1="20.5" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="3.5" y2="12" />
          <line x1="20.5" y1="12" x2="22.5" y2="12" />
          <line x1="4.6" y1="4.6" x2="6" y2="6" />
          <line x1="18" y1="18" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6" y2="18" />
          <line x1="18" y1="6" x2="19.4" y2="4.6" />
        </g>
      </svg>
    </button>
  );
};
