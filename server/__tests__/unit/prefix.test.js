const { BOARD_PREFIXES, normalizePrefix } = require('../../constants/boards');

describe('normalizePrefix', () => {
  it('keeps a prefix the board offers', () => {
    expect(normalizePrefix('market', 'sell')).toBe('sell');
    expect(normalizePrefix('jobs', 'seeking')).toBe('seeking');
  });

  it("drops one from another board, so a car post can't claim 'hiring'", () => {
    expect(normalizePrefix('car', 'hiring')).toBe('');
  });

  it('drops anything on a board without prefixes, and non-strings', () => {
    expect(normalizePrefix('free', 'sell')).toBe('');
    expect(normalizePrefix(undefined, 'sell')).toBe('');
    expect(normalizePrefix('market', { $ne: '' })).toBe('');
    expect(normalizePrefix('market', '')).toBe('');
  });

  it('gives every board distinct keys', () => {
    for (const list of Object.values(BOARD_PREFIXES)) {
      const keys = list.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
