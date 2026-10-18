import {
  CLOUD_ASLEEP_MESSAGE,
  friendlyAuthError,
  friendlyDeleteAccountError,
  isSupabaseUnavailable
} from './supabaseErrors';

describe('telling "the server can’t be reached" apart from real errors', () => {
  it.each([
    ['a failed fetch', new TypeError('Failed to fetch')],
    ['an auth network failure', Object.assign(new Error('x'), { name: 'AuthRetryableFetchError' })],
    ['a database request that never got through', { message: 'x', status: 0 }],
    ['a gateway error', { message: 'Bad Gateway', status: 502 }],
    ['a paused project', { message: 'Project paused', status: 540 }]
  ])('%s counts as unreachable', (_, error) => {
    expect(isSupabaseUnavailable(error)).toBe(true);
  });

  it.each([
    ['a wrong password', Object.assign(new Error('Invalid login credentials'), { status: 400 })],
    ['a duplicate row', { code: '23505', message: 'duplicate key', status: 409 }],
    ['nothing at all', undefined]
  ])('%s does not', (_, error) => {
    expect(isSupabaseUnavailable(error)).toBe(false);
  });
});

describe('sign-in messages in plain words', () => {
  it('explains common sign-in problems', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials')).message).toMatch(/don’t match/);
    expect(friendlyAuthError(new Error('User already registered'))).toMatchObject({ suggestSignIn: true });
    expect(friendlyAuthError(new TypeError('Failed to fetch')).message).toBe(CLOUD_ASLEEP_MESSAGE);
  });

  it('says what went wrong for anything else', () => {
    expect(friendlyAuthError(new Error('Something odd')).message).toBe('Something went wrong: Something odd');
  });
});

describe('deleting an account', () => {
  it('always says nothing was deleted when it fails', () => {
    expect(friendlyDeleteAccountError(new TypeError('Failed to fetch'))).toMatch(/nothing was deleted/);
    expect(friendlyDeleteAccountError({ code: 'PGRST202', message: 'Could not find the function' })).toMatch(/isn’t available/);
    expect(friendlyDeleteAccountError(new Error('boom'))).toMatch(/nothing was deleted/);
  });
});
