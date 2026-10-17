import { useEffect, useState } from 'react';

// Light or dark theme. Until the user picks one with the toggle, the app
// follows the device's setting, including when it changes while open. Once
// picked, the choice is saved and wins. public/index.html applies the same
// rule before the app loads, so dark mode doesn't flash white first.

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Storage can be unavailable (private windows, blocked site data)
const savedTheme = (): 'dark' | 'light' | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
};

const saveTheme = (dark: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch {
    // Not saved; the toggle still works for this visit
  }
};

const systemPrefersDark = () => window.matchMedia?.(DARK_QUERY).matches ?? false;

export const useTheme = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = savedTheme();
    return saved ? saved === 'dark' : systemPrefersDark();
  });

  // Follow the system setting live until the user has picked a theme
  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const handleChange = (event: MediaQueryListEvent) => {
      if (!savedTheme()) setIsDark(event.matches);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDark);
    // Native parts (date picker, scrollbars, form controls) match the theme too
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // An explicit choice: save it so it wins over the system setting from now on
  const toggleTheme = () => {
    const next = !isDark;
    saveTheme(next);
    setIsDark(next);
  };

  return { isDark, toggleTheme };
};
