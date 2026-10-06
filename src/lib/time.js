// Shared time formatters
// - under a minute: "just now"
// - under an hour: "N minutes ago"
// - under a day: "N hours ago"
// - under a week: "N days ago"
// - this year: month and day ("Apr 19")
// - before this year: full date ("Apr 19, 2025")

import { getRuntimeLang } from './runtimeLang';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');

const KO_LABELS = {
  now: '방금 전', minute: '분 전', hour: '시간 전', day: '일 전',
  monthDay: '{m}월 {d}일', fullDate: '{y}.{m}.{d}',
  today: '오늘', yesterday: '어제',
};
const EN_LABELS = {
  now: 'just now', minute: 'm ago', hour: 'h ago', day: 'd ago',
  monthDay: '{month} {d}', fullDate: '{month} {d}, {y}',
  today: 'Today', yesterday: 'Yesterday',
};
const DEFAULT_LABELS = () => (getRuntimeLang() === 'en' ? EN_LABELS : KO_LABELS);

// Prefer the app's translation, and fall back to the runtime-language label when t()
// is absent or echoes the key back (untranslated)
const makePick = (t, fallback) => (key) => {
  if (!t) return fallback[key];
  const v = t(`time.${key}`);
  return v && v !== `time.${key}` ? v : fallback[key];
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const toDate = (input) => (input instanceof Date ? input : new Date(input));

export function formatTime(input, t) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  const pickT = makePick(t, DEFAULT_LABELS());
  const labels = {
    now: pickT('now'),
    minute: pickT('minute'),
    hour: pickT('hour'),
    day: pickT('day'),
    monthDay: pickT('monthDay'),
    fullDate: pickT('fullDate'),
  };

  // Relative time
  if (diffSec < 60) return labels.now;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}${labels.minute}`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}${labels.hour}`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}${labels.day}`;

  // Absolute date
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  const month = MONTHS_EN[date.getMonth()]; // English month abbreviations

  if (y === now.getFullYear()) {
    return labels.monthDay
      .replace('{m}', m)
      .replace('{d}', d)
      .replace('{month}', month);
  }

  return labels.fullDate
    .replace('{y}', y)
    .replace('{m}', pad2(m))
    .replace('{d}', pad2(d))
    .replace('{month}', month);
}

// Whether two timestamps fall on the same calendar day, in the device's local time.
// A missing value is never "the same day", so the first message in a list gets a divider.
export function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = toDate(a);
  const db = toDate(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return startOfDay(da) === startOfDay(db);
}

// Label for a chat date divider: "Today" / "Yesterday" / "Sep 29" / "Sep 29, 2025"
export function formatDateSeparator(input, t) {
  if (!input) return '';
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const pickT = makePick(t, DEFAULT_LABELS());

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) return pickT('today');
  if (dayDiff === 1) return pickT('yesterday');

  const month = MONTHS_EN[date.getMonth()];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();

  if (y === now.getFullYear()) {
    return pickT('monthDay')
      .replace('{m}', m)
      .replace('{d}', d)
      .replace('{month}', month);
  }
  return pickT('fullDate')
    .replace('{y}', y)
    .replace('{m}', pad2(m))
    .replace('{d}', pad2(d))
    .replace('{month}', month);
}

// Date only (used in charts and stats)
export function formatDateOnly(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}
