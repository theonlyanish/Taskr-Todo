import type { ViewType } from '../components/ViewSwitcher';

// Settings that follow a signed-in user between devices (see
// useAccountPreferences). Each is also kept on this device, for guests and for
// a fast start before the account is reached.

export type ThemeChoice = 'dark' | 'light';
export type CalendarLayout = 'dayGridMonth' | 'dayGridWeek';

export interface Preferences {
  // Only set once the user has picked one; until then the app follows the device
  theme?: ThemeChoice;
  view?: ViewType;
  calendarLayout?: CalendarLayout;
  // The list showing (utils/taskLists); one that isn't known shows Personal
  listId?: string;
  // The list view's Completed section folded away
  completedCollapsed?: boolean;
  // "Add details" left open in the add-task card
  addDetailsOpen?: boolean;
}

// Reminders aren't here on purpose: the browser asks for permission to show
// notifications on each device, and only when the user clicks something.

const THEMES: readonly ThemeChoice[] = ['dark', 'light'];
const VIEWS: readonly ViewType[] = ['normal', 'kanban', 'calendar'];
const CALENDAR_LAYOUTS: readonly CalendarLayout[] = ['dayGridMonth', 'dayGridWeek'];

const VIEW_KEY = 'view';
const CALENDAR_LAYOUT_KEY = 'calendarLayout';

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

// Storage can be unavailable (private windows, blocked site data)
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; the setting still applies for this visit
  }
};

export const savedView = () => oneOf(VIEWS, read(VIEW_KEY));
export const saveView = (view: ViewType) => write(VIEW_KEY, view);

export const savedCalendarLayout = () => oneOf(CALENDAR_LAYOUTS, read(CALENDAR_LAYOUT_KEY));
export const saveCalendarLayout = (layout: CalendarLayout) => write(CALENDAR_LAYOUT_KEY, layout);

// Settings as stored on the account, ignoring anything unrecognised
export const parsePreferences = (value: unknown): Preferences | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  return {
    theme: oneOf(THEMES, raw.theme),
    view: oneOf(VIEWS, raw.view),
    calendarLayout: oneOf(CALENDAR_LAYOUTS, raw.calendarLayout),
    listId: typeof raw.listId === 'string' && /^[\w-]{1,64}$/.test(raw.listId) ? raw.listId : undefined,
    completedCollapsed: typeof raw.completedCollapsed === 'boolean' ? raw.completedCollapsed : undefined,
    addDetailsOpen: typeof raw.addDetailsOpen === 'boolean' ? raw.addDetailsOpen : undefined
  };
};

// A stable key for comparing two sets of settings
export const preferencesKey = (prefs: Preferences) =>
  JSON.stringify([
    prefs.theme ?? null,
    prefs.view ?? null,
    prefs.calendarLayout ?? null,
    prefs.listId ?? null,
    prefs.completedCollapsed ?? null,
    prefs.addDetailsOpen ?? null
  ]);
