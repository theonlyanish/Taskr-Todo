import { useEffect, useState } from 'react';

// A true/false setting remembered on this device (the folded Completed
// section, "Add details" left open). A signed-in user's account can also set
// it (see useAccountPreferences in App).
export const useDeviceFlag = (key: string) => {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // Not remembered; applies for this visit
    }
  }, [key, value]);
  return [value, setValue] as const;
};
