import { toCamel } from '../api';

// CLAUDE.md 규칙: 서버 응답은 toCamel을 거치므로 프론트에서는 항상 obj.id를 쓴다.
// 이 변환이 깨지면 화면 전반이 조용히 undefined가 되므로 회귀 테스트로 고정한다.
describe('toCamel', () => {
  it('_id를 id로 바꾼다', () => {
    expect(toCamel({ _id: 'abc123' })).toEqual({ id: 'abc123' });
  });

  it('snake_case 키를 camelCase로 바꾼다', () => {
    expect(toCamel({ created_at: 1, last_message_at: 2 })).toEqual({
      createdAt: 1,
      lastMessageAt: 2,
    });
  });

  it('중첩 객체와 배열까지 재귀적으로 변환한다', () => {
    const input = {
      _id: 'p1',
      author_info: { _id: 'u1', avatar_url: 'x' },
      comment_list: [{ _id: 'c1', is_secret: true }],
    };
    expect(toCamel(input)).toEqual({
      id: 'p1',
      authorInfo: { id: 'u1', avatarUrl: 'x' },
      commentList: [{ id: 'c1', isSecret: true }],
    });
  });

  it('원시값은 그대로 통과시킨다', () => {
    expect(toCamel(null)).toBeNull();
    expect(toCamel(undefined)).toBeUndefined();
    expect(toCamel(42)).toBe(42);
    expect(toCamel('str')).toBe('str');
    expect(toCamel(true)).toBe(true);
  });

  it('빈 객체/배열을 그대로 유지한다', () => {
    expect(toCamel({})).toEqual({});
    expect(toCamel([])).toEqual([]);
  });

  it('이미 camelCase인 키는 건드리지 않는다', () => {
    expect(toCamel({ userId: 1, nickname: 'a' })).toEqual({ userId: 1, nickname: 'a' });
  });

  it('대문자가 뒤따르는 언더스코어는 변환 대상이 아니다', () => {
    // 정규식이 /_([a-z])/ 이므로 _A는 그대로 남는다 — 현재 동작을 명시적으로 고정
    expect(toCamel({ some_Key: 1 })).toEqual({ some_Key: 1 });
  });

  it('배열 최상위도 변환한다', () => {
    expect(toCamel([{ _id: '1' }, { _id: '2' }])).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
