import {
  LOCAL_BOARD_SLUGS,
  TRADE_BOARD_SLUGS,
  isTradeBoard,
  getTradeLabel,
  getTradeChangeLabel,
} from '../boards';

// Explicit invariant from CLAUDE.md: the client and server board slug lists must always match.
// Change one side only and the trade-status toggle silently disappears.
const serverBoards = require('../../../server/constants/boards');

describe('client and server board constants stay in sync', () => {
  it('TRADE_BOARD_SLUGS matches the server', () => {
    expect([...TRADE_BOARD_SLUGS].sort()).toEqual([...serverBoards.TRADE_BOARD_SLUGS].sort());
  });

  it('LOCAL_BOARD_SLUGS matches the server', () => {
    expect([...LOCAL_BOARD_SLUGS].sort()).toEqual([...serverBoards.LOCAL_BOARD_SLUGS].sort());
  });

  it('every trade board is a subset of the local boards', () => {
    TRADE_BOARD_SLUGS.forEach((slug) => expect(LOCAL_BOARD_SLUGS).toContain(slug));
  });

  it('realestate and jobs are deliberately excluded from the trade toggle', () => {
    expect(TRADE_BOARD_SLUGS).not.toContain('realestate');
    expect(TRADE_BOARD_SLUGS).not.toContain('jobs');
  });
});

describe('isTradeBoard', () => {
  it('true for a trade board', () => {
    expect(isTradeBoard('market')).toBe(true);
    expect(isTradeBoard('roomrent')).toBe(true);
  });
  it('false otherwise', () => {
    expect(isTradeBoard('free')).toBe(false);
    expect(isTradeBoard(undefined)).toBe(false);
  });
});

describe('getTradeLabel', () => {
  const t = (key) => key; // Stub that echoes the key back

  it('roomrent uses the move-in wording keys', () => {
    expect(getTradeLabel('roomrent', 'selling', t)).toBe('board.rentAvailable');
    expect(getTradeLabel('roomrent', 'sold', t)).toBe('board.rentTaken');
  });

  it('the other boards use the for-sale wording keys', () => {
    expect(getTradeLabel('market', 'selling', t)).toBe('board.tradeSelling');
    expect(getTradeLabel('market', 'sold', t)).toBe('board.tradeSold');
  });

  it('falls back to Korean when t is absent', () => {
    expect(getTradeLabel('market', 'sold')).toBe('판매완료');
    expect(getTradeLabel('market', 'selling')).toBe('판매중');
  });
});

describe('getTradeChangeLabel', () => {
  const t = (key) => key;

  it('returns the wording for flipping to the opposite state', () => {
    expect(getTradeChangeLabel('market', 'selling', t)).toBe('board.tradeChangeToSold');
    expect(getTradeChangeLabel('market', 'sold', t)).toBe('board.tradeChangeToSelling');
    expect(getTradeChangeLabel('roomrent', 'selling', t)).toBe('board.rentChangeToTaken');
    expect(getTradeChangeLabel('roomrent', 'sold', t)).toBe('board.rentChangeToAvailable');
  });

  it('empty string when t is absent', () => {
    expect(getTradeChangeLabel('market', 'selling')).toBe('');
  });
});
