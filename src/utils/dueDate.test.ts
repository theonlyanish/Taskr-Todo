import { daysUntil, describeDue } from './dueDate';

// Due dates are stored as midnight UTC of the chosen day
const due = (isoDay: string) => new Date(`${isoDay}T00:00:00.000Z`);
// Sunday 18 October 2026, 11:30pm local time: late in the day on purpose
const NOW = new Date(2026, 9, 18, 23, 30);

describe('due date labels', () => {
  it.each([
    ['2026-10-18', 'Today', 'today'],
    ['2026-10-19', 'Tomorrow', 'upcoming'],
    ['2026-10-21', 'Wednesday', 'upcoming'],
    ['2026-10-24', 'Saturday', 'upcoming'],
    ['2026-10-17', 'Yesterday', 'overdue'],
    ['2026-10-15', '3 days ago', 'overdue']
  ])('%s reads as "%s" (%s)', (day, text, tone) => {
    const label = describeDue(due(day), false, NOW);
    expect(label.text).toBe(text);
    expect(label.tone).toBe(tone);
  });

  it('uses a short date a week or more away, with the year only when it differs', () => {
    expect(describeDue(due('2026-10-25'), false, NOW).text).not.toMatch(/2026/);
    expect(describeDue(due('2027-01-05'), false, NOW).text).toMatch(/2027/);
  });

  it('never shows a completed task as overdue', () => {
    expect(describeDue(due('2026-10-15'), true, NOW).tone).toBe('upcoming');
  });

  it('gives the full date for tooltips and screen readers', () => {
    expect(describeDue(due('2026-10-22'), false, NOW).full).toMatch(/22/);
    expect(describeDue(due('2026-10-22'), false, NOW).full).toMatch(/2026/);
  });

  it('counts whole days', () => {
    expect(daysUntil(due('2026-10-18'), NOW)).toBe(0);
    expect(daysUntil(due('2026-10-25'), NOW)).toBe(7);
    expect(daysUntil(due('2026-10-11'), NOW)).toBe(-7);
  });
});

// The tests run in Los Angeles time (scripts/jestGlobalSetup.js)
describe('due dates west of UTC', () => {
  it('really is running west of UTC', () => {
    // If this fails, the timezone setup stopped working and the test below
    // would pass without proving anything
    expect(new Date(2026, 9, 18).getTimezoneOffset()).toBeGreaterThan(0);
  });

  // The old display used toLocaleDateString() on the stored UTC midnight, which
  // showed the day before anywhere west of UTC
  it('keeps the chosen day instead of showing the day before', () => {
    const now = new Date(2026, 9, 18, 9, 0);
    expect(describeDue(due('2026-10-18'), false, now).text).toBe('Today');
    expect(describeDue(due('2026-10-19'), false, now).text).toBe('Tomorrow');
    expect(describeDue(due('2026-10-22'), false, now).full).toMatch(/22/);
  });
});
