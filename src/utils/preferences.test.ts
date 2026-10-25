import { parsePreferences, preferencesKey, savedView, saveView } from './preferences';

beforeEach(() => localStorage.clear());

describe('settings that follow you', () => {
  it('reads settings saved on the account, ignoring anything unrecognised', () => {
    expect(parsePreferences({ theme: 'dark', view: 'kanban', calendarLayout: 'dayGridWeek' })).toEqual({
      theme: 'dark',
      view: 'kanban',
      calendarLayout: 'dayGridWeek'
    });
    expect(parsePreferences({ theme: 'purple', view: 'spreadsheet', extra: 1 })).toEqual({
      theme: undefined,
      view: undefined,
      calendarLayout: undefined
    });
    expect(parsePreferences(null)).toBeNull();
    expect(parsePreferences('dark')).toBeNull();
  });

  it('reads the open list and the folded and unfolded sections', () => {
    expect(
      parsePreferences({ listId: '7d56d555-158d-4ab4-9034-5fe5ebb713b7', completedCollapsed: true, addDetailsOpen: false })
    ).toEqual({ listId: '7d56d555-158d-4ab4-9034-5fe5ebb713b7', completedCollapsed: true, addDetailsOpen: false });
    // Anything that isn't a plain id or a true/false is ignored
    expect(parsePreferences({ listId: '<script>', completedCollapsed: 'yes', addDetailsOpen: 1 })).toEqual({});
  });

  it('notices when only one of the newer settings changes', () => {
    expect(preferencesKey({ view: 'kanban', completedCollapsed: true })).not.toBe(
      preferencesKey({ view: 'kanban', completedCollapsed: false })
    );
    expect(preferencesKey({ listId: 'work' })).not.toBe(preferencesKey({ listId: 'personal' }));
  });

  it('compares settings regardless of how they were written', () => {
    expect(preferencesKey({ view: 'kanban', theme: 'dark' })).toBe(preferencesKey({ theme: 'dark', view: 'kanban' }));
    expect(preferencesKey({ theme: 'dark' })).not.toBe(preferencesKey({ theme: 'light' }));
  });

  it('remembers the last view on this device', () => {
    expect(savedView()).toBeUndefined();
    saveView('calendar');
    expect(savedView()).toBe('calendar');
    localStorage.setItem('view', 'nonsense');
    expect(savedView()).toBeUndefined();
  });
});
