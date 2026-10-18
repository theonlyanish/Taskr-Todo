import * as chrono from 'chrono-node/en';
import { describeDueDate, parseQuickAdd, setQuickAddParser } from './quickAdd';

// Saturday 17 October 2026, 10am
const NOW = new Date(2026, 9, 17, 10, 0);
const day = (date: Date) => date.toISOString().slice(0, 10);

const withLanguage = (language: string, run: () => void) => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'language');
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(window.navigator, 'language', original);
    else delete (window.navigator as { language?: string }).language;
  }
};

beforeAll(() => setQuickAddParser(chrono));

describe('quick add dates', () => {
  it.each([
    ['call mum tomorrow', 'call mum', '2026-10-18'],
    ['pay rent fri', 'pay rent', '2026-10-23'],
    ['team lunch next tuesday', 'team lunch', '2026-10-20'],
    ['renew passport by 1 Dec', 'renew passport', '2026-12-01'],
    ['submit report in 3 days', 'submit report', '2026-10-20']
  ])('"%s" becomes "%s" due %s', (input, title, dueDay) => {
    const match = parseQuickAdd(input, NOW);
    expect(match).not.toBeNull();
    expect(match!.title).toBe(title);
    expect(day(match!.dueDate)).toBe(dueDay);
  });

  it.each(['call May about the lease', 'watch 1917', 'read chapter 3', 'buy 2 apples'])(
    'leaves "%s" alone: a month or year on its own is not a due date',
    input => {
      expect(parseQuickAdd(input, NOW)).toBeNull();
    }
  );

  it('keeps a time out of the title and reports it separately', () => {
    const match = parseQuickAdd('pay rent fri 5pm', NOW);
    expect(match?.title).toBe('pay rent');
    expect(match?.timeText).toBeTruthy();
  });

  it('reads 3/11 day-first outside the US and month-first in the US', () => {
    withLanguage('en-AU', () => {
      expect(day(parseQuickAdd('dentist on 3/11', NOW)!.dueDate)).toBe('2026-11-03');
    });
    withLanguage('en-US', () => {
      expect(day(parseQuickAdd('dentist on 3/11', NOW)!.dueDate)).toBe('2027-03-11');
    });
  });

  it('describes today and tomorrow in words', () => {
    expect(describeDueDate(new Date(Date.UTC(2026, 9, 17)), NOW)).toBe('Today');
    expect(describeDueDate(new Date(Date.UTC(2026, 9, 18)), NOW)).toBe('Tomorrow');
  });
});
