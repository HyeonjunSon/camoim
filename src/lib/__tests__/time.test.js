import { formatTime, formatDateOnly, isSameDay, formatDateSeparator } from '../time';
import { setRuntimeLang } from '../runtimeLang';

// Pinned to 2026-06-15 12:00:00 local time
const NOW = new Date(2026, 5, 15, 12, 0, 0);
const ago = (ms) => new Date(NOW.getTime() - ms);
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  setRuntimeLang('ko');
});
afterEach(() => jest.useRealTimers());

describe('formatTime — Korean default', () => {
  it('empty input gives an empty string', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('under a minute reads as just now', () => {
    expect(formatTime(NOW)).toBe('방금 전');
    expect(formatTime(ago(59 * SEC))).toBe('방금 전');
  });

  it('under an hour is shown in minutes', () => {
    expect(formatTime(ago(MIN))).toBe('1분 전');
    expect(formatTime(ago(59 * MIN))).toBe('59분 전');
  });

  it('under a day is shown in hours', () => {
    expect(formatTime(ago(HOUR))).toBe('1시간 전');
    expect(formatTime(ago(23 * HOUR))).toBe('23시간 전');
  });

  it('under a week is shown in days', () => {
    expect(formatTime(ago(DAY))).toBe('1일 전');
    expect(formatTime(ago(6 * DAY))).toBe('6일 전');
  });

  it('a week or more in the same year shows month and day', () => {
    expect(formatTime(new Date(2026, 3, 19))).toBe('4월 19일');
  });

  it('before this year shows the full dotted date', () => {
    expect(formatTime(new Date(2025, 3, 19))).toBe('2025.04.19');
  });

  it('accepts both string and Date input', () => {
    expect(formatTime(ago(2 * HOUR).toISOString())).toBe('2시간 전');
    expect(formatTime(ago(2 * HOUR))).toBe('2시간 전');
  });
});

describe('formatTime — English (runtime language en)', () => {
  beforeEach(() => setRuntimeLang('en'));

  it('relative time labels switch to English', () => {
    expect(formatTime(NOW)).toBe('just now');
    expect(formatTime(ago(5 * MIN))).toBe('5m ago');
    expect(formatTime(ago(3 * HOUR))).toBe('3h ago');
    expect(formatTime(ago(2 * DAY))).toBe('2d ago');
  });

  it('a date this year reads as Mon D', () => {
    expect(formatTime(new Date(2026, 3, 19))).toBe('Apr 19');
  });

  it('a date last year reads as Mon D, YYYY', () => {
    expect(formatTime(new Date(2025, 3, 19))).toBe('Apr 19, 2025');
  });
});

describe('formatTime — the t() translation function wins', () => {
  it('uses the value t() returns', () => {
    const t = (key) => ({ 'time.now': 'NOW!', 'time.minute': ' minutes back' }[key] ?? key);
    expect(formatTime(NOW, t)).toBe('NOW!');
    expect(formatTime(ago(3 * MIN), t)).toBe('3 minutes back');
  });

  it('falls back to the default label when t() echoes the key back (untranslated)', () => {
    const t = (key) => key;
    expect(formatTime(NOW, t)).toBe('방금 전');
  });
});

describe('formatDateOnly', () => {
  it('same year gives M/D', () => {
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe('1/5');
    expect(formatDateOnly(new Date(2026, 11, 31))).toBe('12/31');
  });

  it('a different year gives the zero-padded dotted date', () => {
    expect(formatDateOnly(new Date(2025, 0, 5))).toBe('2025.01.05');
  });

  it('accepts string input too', () => {
    expect(formatDateOnly('2026-03-07T00:00:00')).toBe('3/7');
  });
});

describe('isSameDay', () => {
  it('two timestamps on the same calendar day are equal regardless of time', () => {
    expect(isSameDay(new Date(2026, 5, 15, 0, 0, 1), new Date(2026, 5, 15, 23, 59, 59))).toBe(true);
  });

  it('crossing midnight is a different day', () => {
    expect(isSameDay(new Date(2026, 5, 14, 23, 59, 59), new Date(2026, 5, 15, 0, 0, 0))).toBe(false);
  });

  it('a missing value is never the same day — the first message in a list gets a divider', () => {
    expect(isSameDay(null, NOW)).toBe(false);
    expect(isSameDay(undefined, NOW)).toBe(false);
    expect(isSameDay(NOW, null)).toBe(false);
  });

  it('an invalid date is never the same day', () => {
    expect(isSameDay('not a date', NOW)).toBe(false);
  });

  it('accepts string and Date input interchangeably', () => {
    expect(isSameDay('2026-06-15T01:00:00', new Date(2026, 5, 15, 22, 0, 0))).toBe(true);
  });
});

describe('formatDateSeparator — Korean default', () => {
  it('empty input gives an empty string', () => {
    expect(formatDateSeparator(null)).toBe('');
    expect(formatDateSeparator(undefined)).toBe('');
  });

  it('today reads as "오늘"', () => {
    expect(formatDateSeparator(NOW)).toBe('오늘');
    expect(formatDateSeparator(new Date(2026, 5, 15, 0, 0, 1))).toBe('오늘');
  });

  it('yesterday reads as "어제"', () => {
    expect(formatDateSeparator(ago(DAY))).toBe('어제');
  });

  it('this year, more than a day back, reads as month and day', () => {
    expect(formatDateSeparator(new Date(2026, 0, 5))).toBe('1월 5일');
  });

  it('before this year reads as the full dotted date', () => {
    expect(formatDateSeparator(new Date(2025, 11, 31))).toBe('2025.12.31');
  });

  it('accepts string input too', () => {
    expect(formatDateSeparator('2026-06-14T00:00:00')).toBe('어제');
  });
});

describe('formatDateSeparator — t() translation function', () => {
  it('uses the value t() returns for today/yesterday', () => {
    const t = (key) => ({ 'time.today': 'Today', 'time.yesterday': 'Yesterday' }[key] ?? key);
    expect(formatDateSeparator(NOW, t)).toBe('Today');
    expect(formatDateSeparator(ago(DAY), t)).toBe('Yesterday');
  });

  it('falls back to the runtime-language label when t() echoes the key back (untranslated)', () => {
    const t = (key) => key;
    expect(formatDateSeparator(NOW, t)).toBe('오늘');
  });
});
