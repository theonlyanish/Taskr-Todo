import { deviceName, timeAgo } from './deviceName';

describe('device names from user agents', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Chrome on Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Safari on Mac'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari on iPhone'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Linux']
  ])('%#: %s', (userAgent, expected) => {
    expect(deviceName(userAgent)).toBe(expected);
  });

  it('copes with a missing or unfamiliar user agent', () => {
    expect(deviceName(null)).toBe('Unknown device');
    expect(deviceName('curl/8.0')).toBe('Unknown device');
  });
});

describe('time ago', () => {
  const now = new Date(2026, 9, 18, 12, 0);
  it('says "just now" under a minute, then minutes, hours and days', () => {
    expect(timeAgo(new Date(now.getTime() - 20_000), now)).toBe('just now');
    expect(timeAgo(new Date(now.getTime() - 5 * 60_000), now)).toMatch(/5 minutes ago/);
    expect(timeAgo(new Date(now.getTime() - 3 * 3_600_000), now)).toMatch(/3 hours ago/);
    expect(timeAgo(new Date(now.getTime() - 86_400_000), now)).toMatch(/yesterday/);
  });
});
