import { formatTime, formatDateOnly } from '../time';
import { setRuntimeLang } from '../runtimeLang';

// 2026-06-15 12:00:00 로컬 기준으로 고정
const NOW = new Date(2026, 5, 15, 12, 0, 0);
const ago = (ms) => new Date(NOW.getTime() - ms);
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  setRuntimeLang('ko');
});
afterEach(() => jest.useRealTimers());

describe('formatTime — 한국어 기본값', () => {
  it('빈 값이면 빈 문자열', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('1분 미만은 "방금 전"', () => {
    expect(formatTime(NOW)).toBe('방금 전');
    expect(formatTime(ago(59 * SEC))).toBe('방금 전');
  });

  it('1시간 미만은 분 단위', () => {
    expect(formatTime(ago(MIN))).toBe('1분 전');
    expect(formatTime(ago(59 * MIN))).toBe('59분 전');
  });

  it('24시간 미만은 시간 단위', () => {
    expect(formatTime(ago(HOUR))).toBe('1시간 전');
    expect(formatTime(ago(23 * HOUR))).toBe('23시간 전');
  });

  it('7일 미만은 일 단위', () => {
    expect(formatTime(ago(DAY))).toBe('1일 전');
    expect(formatTime(ago(6 * DAY))).toBe('6일 전');
  });

  it('7일 이상 같은 해면 "M월 D일"', () => {
    expect(formatTime(new Date(2026, 3, 19))).toBe('4월 19일');
  });

  it('작년 이전이면 "YYYY.MM.DD"', () => {
    expect(formatTime(new Date(2025, 3, 19))).toBe('2025.04.19');
  });

  it('문자열/Date 입력을 모두 받는다', () => {
    expect(formatTime(ago(2 * HOUR).toISOString())).toBe('2시간 전');
    expect(formatTime(ago(2 * HOUR))).toBe('2시간 전');
  });
});

describe('formatTime — 영어 (런타임 언어 en)', () => {
  beforeEach(() => setRuntimeLang('en'));

  it('상대 시간 라벨이 영어로 바뀐다', () => {
    expect(formatTime(NOW)).toBe('just now');
    expect(formatTime(ago(5 * MIN))).toBe('5m ago');
    expect(formatTime(ago(3 * HOUR))).toBe('3h ago');
    expect(formatTime(ago(2 * DAY))).toBe('2d ago');
  });

  it('같은 해 날짜는 "Mon D"', () => {
    expect(formatTime(new Date(2026, 3, 19))).toBe('Apr 19');
  });

  it('지난 해 날짜는 "Mon D, YYYY"', () => {
    expect(formatTime(new Date(2025, 3, 19))).toBe('Apr 19, 2025');
  });
});

describe('formatTime — t() 번역 함수 우선', () => {
  it('t()가 값을 주면 그 값을 쓴다', () => {
    const t = (key) => ({ 'time.now': 'NOW!', 'time.minute': ' minutes back' }[key] ?? key);
    expect(formatTime(NOW, t)).toBe('NOW!');
    expect(formatTime(ago(3 * MIN), t)).toBe('3 minutes back');
  });

  it('t()가 키를 그대로 돌려주면(미번역) 기본 라벨로 폴백한다', () => {
    const t = (key) => key;
    expect(formatTime(NOW, t)).toBe('방금 전');
  });
});

describe('formatDateOnly', () => {
  it('같은 해면 M/D', () => {
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe('1/5');
    expect(formatDateOnly(new Date(2026, 11, 31))).toBe('12/31');
  });

  it('다른 해면 YYYY.MM.DD (0 패딩)', () => {
    expect(formatDateOnly(new Date(2025, 0, 5))).toBe('2025.01.05');
  });

  it('문자열 입력도 받는다', () => {
    expect(formatDateOnly('2026-03-07T00:00:00')).toBe('3/7');
  });
});
