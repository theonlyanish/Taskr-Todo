// Repeating tasks: "every friday", "every month", "every weekday". A repeat
// is kept on the task as a short string ("week:1", "month:2@31") and always
// goes with a due date, which says where the next one falls: completing the
// task adds the next one, due on the next date after this one (skipping any
// that have already passed).

export type RepeatUnit = 'day' | 'weekday' | 'week' | 'month' | 'year';

export interface Repeat {
  unit: RepeatUnit;
  interval: number; // every 2 weeks: 2
  // Monthly only: the day of the month to come back to after a shorter month
  // (the 31st, after 28 February)
  monthDay?: number;
}

const UNITS: RepeatUnit[] = ['day', 'weekday', 'week', 'month', 'year'];

export const formatRepeat = (repeat: Repeat): string =>
  `${repeat.unit}:${repeat.interval}${repeat.unit === 'month' && repeat.monthDay ? `@${repeat.monthDay}` : ''}`;

export const parseRepeatValue = (value: string | null | undefined): Repeat | null => {
  const match = /^(day|weekday|week|month|year):(\d{1,3})(?:@(\d{1,2}))?$/.exec(value ?? '');
  if (!match) return null;
  const interval = Number(match[2]);
  if (interval < 1) return null;
  const monthDay = match[3] ? Number(match[3]) : undefined;
  return { unit: match[1] as RepeatUnit, interval, ...(monthDay && monthDay <= 31 ? { monthDay } : {}) };
};

/* ---------- Dates (due dates are midnight UTC of the day) ---------- */

const DAY_MS = 86_400_000;
const utcDay = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
// Today's date in the user's time zone, as midnight UTC like a due date
const todayAsDueDate = (now: Date) => utcDay(now.getFullYear(), now.getMonth(), now.getDate());

const step = (date: Date, repeat: Repeat): Date => {
  const { unit, interval } = repeat;
  if (unit === 'day') return addDays(date, interval);
  if (unit === 'week') return addDays(date, 7 * interval);
  if (unit === 'weekday') {
    let next = date;
    for (let left = interval; left > 0; ) {
      next = addDays(next, 1);
      if (next.getUTCDay() !== 0 && next.getUTCDay() !== 6) left--;
    }
    return next;
  }
  if (unit === 'month') {
    const target = date.getUTCMonth() + interval;
    const year = date.getUTCFullYear() + Math.floor(target / 12);
    const month = ((target % 12) + 12) % 12;
    const day = repeat.monthDay ?? date.getUTCDate();
    return utcDay(year, month, Math.min(day, daysInMonth(year, month)));
  }
  // Yearly: 29 February falls on the 28th in other years
  const year = date.getUTCFullYear() + interval;
  const month = date.getUTCMonth();
  return utcDay(year, month, Math.min(date.getUTCDate(), daysInMonth(year, month)));
};

// The due date of the next one after completing a task due on `due`: the
// next date in the pattern that's today or later
export const nextDueDate = (due: Date, repeat: Repeat, now = new Date()): Date => {
  const today = todayAsDueDate(now);
  let next = step(due, repeat);
  for (let guard = 0; next < today && guard < 5000; guard++) next = step(next, repeat);
  return next;
};

/* ---------- Words ---------- */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ordinal = (day: number) => {
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${day}${suffix}`;
};

// "Every Friday", "Every 2 weeks on Friday", "Every month on the 31st"
export const describeRepeat = (repeat: Repeat, due?: Date | null): string => {
  const { unit, interval } = repeat;
  const weekday = due ? WEEKDAY_NAMES[new Date(due).getUTCDay()] : null;
  switch (unit) {
    case 'day':
      return interval === 1 ? 'Every day' : `Every ${interval} days`;
    case 'weekday':
      return 'Every weekday';
    case 'week':
      if (interval === 1) return weekday ? `Every ${weekday}` : 'Every week';
      return `Every ${interval} weeks${weekday ? ` on ${weekday}` : ''}`;
    case 'month': {
      const day = repeat.monthDay ?? (due ? new Date(due).getUTCDate() : null);
      const base = interval === 1 ? 'Every month' : `Every ${interval} months`;
      return day ? `${base} on the ${ordinal(day)}` : base;
    }
    case 'year':
      return interval === 1 ? 'Every year' : `Every ${interval} years`;
  }
};

// The choices in the task form's Repeat field
export const REPEAT_CHOICES: { value: string; label: string }[] = [
  { value: '', label: 'Doesn’t repeat' },
  { value: 'day:1', label: 'Every day' },
  { value: 'weekday:1', label: 'Every weekday (Mon–Fri)' },
  { value: 'week:1', label: 'Every week' },
  { value: 'week:2', label: 'Every 2 weeks' },
  { value: 'month:1', label: 'Every month' },
  { value: 'year:1', label: 'Every year' }
];

/* ---------- Reading "every friday" in quick add ---------- */

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6
};
const NUMBER_WORDS: Record<string, number> = { other: 2, two: 2, three: 3, four: 4, five: 5, six: 6 };

export interface RepeatMatch {
  repeat: Repeat;
  firstDue: Date; // the first due date when no other date is given
  matchedText: string;
  index: number; // where the phrase starts in the input
}

const nextWeekday = (from: Date, weekday: number) => addDays(from, (weekday - from.getUTCDay() + 7) % 7);

const nextMonthDay = (from: Date, day: number) => {
  if (from.getUTCDate() <= day && day <= daysInMonth(from.getUTCFullYear(), from.getUTCMonth())) {
    return utcDay(from.getUTCFullYear(), from.getUTCMonth(), day);
  }
  return step(utcDay(from.getUTCFullYear(), from.getUTCMonth(), 1), { unit: 'month', interval: 1, monthDay: day });
};

// Finds a repeat phrase in quick add text: "every friday", "every 2 weeks",
// "every other week", "every weekday", "every month", "every 15th", "daily",
// "weekly", "fortnightly", "monthly", "yearly". Starts today, or on the next
// matching weekday or day of the month.
export const findRepeat = (input: string, now = new Date()): RepeatMatch | null => {
  const today = todayAsDueDate(now);
  const pattern =
    /(?:^|\s)(every\s+(?:(\d{1,2}|other|two|three|four|five|six)\s+)?(day|days|weekday|weekdays|week|weeks|month|months|year|years|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|\d{1,2}(?:st|nd|rd|th))|daily|weekly|fortnightly|monthly|yearly|annually)(?=$|[\s,.!?])/i;
  const match = pattern.exec(input);
  if (!match) return null;
  const phrase = match[1];
  const index = match.index + match[0].length - phrase.length;
  const lower = phrase.toLowerCase();
  const found = (repeat: Repeat, firstDue = today): RepeatMatch => ({ repeat, firstDue, matchedText: phrase, index });

  const single: Record<string, Repeat> = {
    daily: { unit: 'day', interval: 1 },
    weekly: { unit: 'week', interval: 1 },
    fortnightly: { unit: 'week', interval: 2 },
    monthly: { unit: 'month', interval: 1 },
    yearly: { unit: 'year', interval: 1 },
    annually: { unit: 'year', interval: 1 }
  };
  if (single[lower]) return found(single[lower]);

  const count = match[2] ? Number(match[2]) || NUMBER_WORDS[match[2].toLowerCase()] : 1;
  const word = match[3].toLowerCase();
  if (count < 1 || count > 99) return null;

  const dayOfMonth = /^(\d{1,2})(st|nd|rd|th)$/.exec(word);
  if (dayOfMonth) {
    const day = Number(dayOfMonth[1]);
    if (day < 1 || day > 31 || match[2]) return null;
    // "every 2nd monday" is a weekday of the month, which Taskr can't repeat
    const nextWord = input.slice(index + phrase.length).trim().split(/\s+/)[0]?.toLowerCase();
    if (nextWord && nextWord in WEEKDAYS) return null;
    return found({ unit: 'month', interval: 1, monthDay: day }, nextMonthDay(today, day));
  }
  if (word in WEEKDAYS) {
    if (match[2] && count !== 2) return null; // "every other friday" only
    return found({ unit: 'week', interval: count }, nextWeekday(today, WEEKDAYS[word]));
  }
  if (word.startsWith('weekday')) {
    // The next weekday, today included
    const first = today.getUTCDay() === 0 ? addDays(today, 1) : today.getUTCDay() === 6 ? addDays(today, 2) : today;
    return match[2] ? null : found({ unit: 'weekday', interval: 1 }, first);
  }
  const unit = word.replace(/s$/, '') as RepeatUnit;
  if (!UNITS.includes(unit)) return null;
  return found({ unit, interval: count });
};

// A monthly repeat remembers its day of the month from the first due date, so
// a task on the 31st comes back to the 31st after February
export const anchorRepeat = (value: string, due: Date): string => {
  const repeat = parseRepeatValue(value);
  if (!repeat) return value;
  if (repeat.unit === 'month' && !repeat.monthDay) {
    return formatRepeat({ ...repeat, monthDay: new Date(due).getUTCDate() });
  }
  return formatRepeat(repeat);
};
