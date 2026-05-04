// 공용 시간 포맷터
// - 1분 미만: "방금 전"
// - 1시간 미만: "N분 전"
// - 24시간 미만: "N시간 전"
// - 7일 미만: "N일 전"
// - 올해: "4월 19일" / "Apr 19"
// - 작년 이전: "2025.04.19" / "Apr 19, 2025"

import { getRuntimeLang } from './runtimeLang';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');

const KO_LABELS = {
  now: '방금 전', minute: '분 전', hour: '시간 전', day: '일 전',
  monthDay: '{m}월 {d}일', fullDate: '{y}.{m}.{d}',
};
const EN_LABELS = {
  now: 'just now', minute: 'm ago', hour: 'h ago', day: 'd ago',
  monthDay: '{month} {d}', fullDate: '{month} {d}, {y}',
};
const DEFAULT_LABELS = () => (getRuntimeLang() === 'en' ? EN_LABELS : KO_LABELS);

export function formatTime(input, t) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  const fallback = DEFAULT_LABELS();
  const pickT = (key, fb) => {
    if (!t) return fb;
    const v = t(`time.${key}`);
    return v && v !== `time.${key}` ? v : fb;
  };
  const labels = {
    now: pickT('now', fallback.now),
    minute: pickT('minute', fallback.minute),
    hour: pickT('hour', fallback.hour),
    day: pickT('day', fallback.day),
    monthDay: pickT('monthDay', fallback.monthDay),
    fullDate: pickT('fullDate', fallback.fullDate),
  };

  // 상대 시간
  if (diffSec < 60) return labels.now;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}${labels.minute}`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}${labels.hour}`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}${labels.day}`;

  // 절대 날짜
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  const month = MONTHS_EN[date.getMonth()]; // 영어 월 약어

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

// 날짜만 (차트·통계 등에 사용)
export function formatDateOnly(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}
