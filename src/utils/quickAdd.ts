import { useEffect, useState } from 'react';
import { anchorRepeat, findRepeat, formatRepeat } from './repeat';

// Natural-language quick add: "pay rent fri 5pm" becomes the title "pay rent"
// due on Friday, and "gym every friday" a task repeating every Friday. chrono-node is loaded on demand so it stays out of the first
// page load.

type ChronoEn = typeof import('chrono-node/en');

export interface QuickAddMatch {
  title: string; // the input with the date phrase taken out
  dueDate: Date; // midnight UTC, like every other due date in the app
  matchedText: string; // the phrase that was read as a date, e.g. "fri 5pm"
  timeText?: string; // "5:00 pm" when a time was given; Taskr stores dates only
  repeat?: string; // "week:1" when the text says how it repeats (utils/repeat)
}

let chrono: ChronoEn | null = null;
let loading: Promise<void> | null = null;

export const loadQuickAdd = () => {
  loading ??= import('chrono-node/en').then(module => {
    chrono = module;
  });
  return loading;
};

// For tests, which load chrono directly
export const setQuickAddParser = (module: ChronoEn) => {
  chrono = module;
};

// US English reads 3/11 as March 11; everywhere else as 3 November
const usesMonthFirst = () =>
  typeof navigator !== 'undefined' && /^en-US\b/i.test(navigator.language);

// Words that often sit before a date phrase and shouldn't stay in the title
const TRAILING_LINK_WORDS = /\s+(on|by|due|at|for|before|from)$/i;

// Weekday abbreviations that are also everyday words ("sat exam prep")
const AMBIGUOUS_ALONE = ['sat', 'sun', 'wed'];

export const parseQuickAdd = (input: string, now = new Date()): QuickAddMatch | null => {
  if (!chrono || !input.trim()) return null;

  // "every friday" first, then any start date in what's left ("from 1 nov")
  const repeatMatch = findRepeat(input, now);
  if (repeatMatch) {
    const before = input.slice(0, repeatMatch.index).trimEnd().replace(TRAILING_LINK_WORDS, '');
    const after = input.slice(repeatMatch.index + repeatMatch.matchedText.length);
    const rest = `${before} ${after}`.replace(/\s+/g, ' ').trim();
    // "from 1 nov": chrono reads "from 1" as a time, so the date is looked
    // for without the starting word, and only a day counts
    const startWord = /\b(from|starting|beginning)\s+(?=\S)/i.exec(rest);
    const start = rest ? findDate(startWord ? rest.replace(startWord[0], '') : rest, now, true) : null;
    const title = start?.title ?? rest;
    if (!title) return null;
    const dueDate = start?.dueDate ?? repeatMatch.firstDue;
    const startText = start && `${startWord ? `${startWord[1]} ` : ''}${start.matchedText}`;
    return {
      title,
      dueDate,
      matchedText: [repeatMatch.matchedText, startText].filter(Boolean).join(' '),
      timeText: start?.timeText,
      repeat: anchorRepeat(formatRepeat(repeatMatch.repeat), dueDate)
    };
  }
  return findDate(input, now);
};

// The first date phrase in the text. dayOnly: a time alone ("at 5") doesn't
// count, for the start of a repeat
const findDate = (input: string, now: Date, dayOnly = false): QuickAddMatch | null => {
  if (!chrono) return null;
  const parser = usesMonthFirst() ? chrono.casual : chrono.GB;
  const results = parser.parse(input, now, { forwardDate: true });

  for (const result of results) {
    const { start } = result;
    // A lone number, year or month ("chapter 3", "watch 1917", "March numbers")
    // isn't a due date; a day, weekday or time is
    const meaningful =
      start.isCertain('day') || start.isCertain('weekday') || (!dayOnly && start.isCertain('hour'));
    if (!meaningful || AMBIGUOUS_ALONE.includes(result.text.trim().toLowerCase())) continue;

    const before = input.slice(0, result.index).trimEnd().replace(TRAILING_LINK_WORDS, '');
    const after = input.slice(result.index + result.text.length);
    const title = `${before} ${after}`.replace(/\s+/g, ' ').trim();
    // Typing only a date ("tomorrow") would leave no title, so keep it as text
    if (!title) return null;

    const date = start.date();
    return {
      title,
      dueDate: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
      matchedText: result.text,
      timeText: start.isCertain('hour')
        ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : undefined
    };
  }
  return null;
};

// "Today", "Tomorrow", "Fri 23 Oct", or "Fri 23 Oct 2027" outside this year
export const describeDueDate = (dueDate: Date, now = new Date()) => {
  const day = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAway = Math.round((day - today) / 86_400_000);
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  return dueDate.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: dueDate.getUTCFullYear() === now.getFullYear() ? undefined : 'numeric',
    timeZone: 'UTC'
  });
};

// Loads the parser on first use and re-renders once it's ready
export const useQuickAdd = () => {
  const [ready, setReady] = useState(chrono !== null);
  useEffect(() => {
    if (ready) return;
    let active = true;
    loadQuickAdd()
      .then(() => active && setReady(true))
      .catch(error => console.error('Quick add date parsing unavailable:', error));
    return () => {
      active = false;
    };
  }, [ready]);
  return ready;
};
