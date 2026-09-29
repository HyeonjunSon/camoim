import { toCamel } from '../api';

// CLAUDE.md rule: server responses pass through toCamel, so the frontend always uses obj.id.
// If that conversion breaks, screens quietly fill with undefined, so a regression test pins it down.
describe('toCamel', () => {
  it('renames _id to id', () => {
    expect(toCamel({ _id: 'abc123' })).toEqual({ id: 'abc123' });
  });

  it('converts snake_case keys to camelCase', () => {
    expect(toCamel({ created_at: 1, last_message_at: 2 })).toEqual({
      createdAt: 1,
      lastMessageAt: 2,
    });
  });

  it('converts nested objects and arrays recursively', () => {
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

  it('passes primitives through untouched', () => {
    expect(toCamel(null)).toBeNull();
    expect(toCamel(undefined)).toBeUndefined();
    expect(toCamel(42)).toBe(42);
    expect(toCamel('str')).toBe('str');
    expect(toCamel(true)).toBe(true);
  });

  it('keeps empty objects and arrays as they are', () => {
    expect(toCamel({})).toEqual({});
    expect(toCamel([])).toEqual([]);
  });

  it('leaves keys that are already camelCase alone', () => {
    expect(toCamel({ userId: 1, nickname: 'a' })).toEqual({ userId: 1, nickname: 'a' });
  });

  it('an underscore followed by an uppercase letter is not converted', () => {
    // The regex is /_([a-z])/, so _A survives unchanged — pinning the current behaviour explicitly
    expect(toCamel({ some_Key: 1 })).toEqual({ some_Key: 1 });
  });

  it('converts a top-level array too', () => {
    expect(toCamel([{ _id: '1' }, { _id: '2' }])).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
