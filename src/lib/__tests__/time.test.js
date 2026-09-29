import { formatTime, formatDateOnly } from '../time';
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
