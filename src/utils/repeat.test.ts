import { describeRepeat, findRepeat, formatRepeat, nextDueDate, parseRepeatValue, Repeat } from './repeat';

// Due dates are midnight UTC of the day
const due = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
// Sunday 25 October 2026, midday local time
const NOW = new Date(2026, 9, 25, 12);

const every = (unit: Repeat['unit'], interval = 1, monthDay?: number): Repeat => ({ unit, interval, ...(monthDay ? { monthDay } : {}) });

describe('storing a repeat', () => {
  it('round-trips through its short form', () => {
    for (const repeat of [every('day'), every('week', 2), every('month', 1, 31), every('weekday'), every('year')]) {
      expect(parseRepeatValue(formatRepeat(repeat))).toEqual(repeat);
    }
  });

  it('ignores anything it doesn’t recognise', () => {
    expect(parseRepeatValue('fortnight')).toBeNull();
    expect(parseRepeatValue('week:0')).toBeNull();
    expect(parseRepeatValue(null)).toBeNull();
  });
});

describe('the next due date', () => {
  it.each([
    ['every day', every('day'), '2026-10-25', '2026-10-26'],
    ['every 2 weeks', every('week', 2), '2026-10-30', '2026-11-13'],
    ['every month', every('month'), '2026-10-28', '2026-11-28'],
    ['every year', every('year'), '2026-10-30', '2027-10-30'],
    // Friday to Monday
    ['every weekday', every('weekday'), '2026-10-30', '2026-11-02']
  ])('%s', (_, repeat, from, expected) => {
    expect(iso(nextDueDate(due(from), repeat, NOW))).toBe(expected);
  });

  it('keeps a monthly task on the 31st after a short month', () => {
    const monthly = every('month', 1, 31);
    const feb = nextDueDate(due('2027-01-31'), monthly, new Date(2027, 0, 31));
    expect(iso(feb)).toBe('2027-02-28');
    expect(iso(nextDueDate(feb, monthly, new Date(2027, 1, 28)))).toBe('2027-03-31');
  });

  it('skips dates that have already passed when an overdue task is done', () => {
    // A weekly Monday task last due three weeks ago comes back next Monday
    expect(iso(nextDueDate(due('2026-10-05'), every('week'), NOW))).toBe('2026-10-26');
  });

  it('puts 29 February on the 28th in other years', () => {
    expect(iso(nextDueDate(due('2028-02-29'), every('year'), new Date(2028, 1, 29)))).toBe('2029-02-28');
  });
});

describe('describing a repeat', () => {
  it('names the weekday or day of the month from the due date', () => {
    expect(describeRepeat(every('week'), due('2026-10-30'))).toBe('Every Friday');
    expect(describeRepeat(every('week', 2), due('2026-10-30'))).toBe('Every 2 weeks on Friday');
    expect(describeRepeat(every('month'), due('2026-10-22'))).toBe('Every month on the 22nd');
    expect(describeRepeat(every('weekday'))).toBe('Every weekday');
    expect(describeRepeat(every('day', 3))).toBe('Every 3 days');
  });
});

describe('reading a repeat in quick add', () => {
  const read = (text: string) => {
    const match = findRepeat(text, NOW);
    return match && { repeat: formatRepeat(match.repeat), first: iso(match.firstDue), text: match.matchedText };
  };

  it.each([
    ['gym every friday', 'week:1', '2026-10-30', 'every friday'],
    ['bins every other tue', 'week:2', '2026-10-27', 'every other tue'],
    ['standup every weekday', 'weekday:1', '2026-10-26', 'every weekday'],
    ['water plants every 3 days', 'day:3', '2026-10-25', 'every 3 days'],
    ['pay rent every month', 'month:1', '2026-10-25', 'every month'],
    ['pay rent every 1st', 'month:1@1', '2026-11-01', 'every 1st'],
    ['backup daily', 'day:1', '2026-10-25', 'daily'],
    ['timesheet fortnightly', 'week:2', '2026-10-25', 'fortnightly'],
    ['Every Sunday call mum', 'week:1', '2026-10-25', 'Every Sunday']
  ])('“%s”', (text, repeat, first, matched) => {
    expect(read(text)).toEqual({ repeat, first, text: matched });
  });

  it('leaves patterns it can’t repeat as they are', () => {
    expect(read('book club every 2nd monday')).toBeNull();
  });

  it('leaves ordinary words alone', () => {
    expect(read('everyone meeting')).toBeNull();
    expect(read('read every page')).toBeNull();
    expect(read('weeklyish plan')).toBeNull();
  });
});
