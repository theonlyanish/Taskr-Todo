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
