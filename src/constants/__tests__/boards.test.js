import {
  LOCAL_BOARD_SLUGS,
  TRADE_BOARD_SLUGS,
  isTradeBoard,
  getTradeLabel,
  getTradeChangeLabel,
} from '../boards';

// CLAUDE.md의 명시적 불변식: 클라이언트와 서버의 보드 slug 목록은 항상 같아야 한다.
// 한쪽만 고치면 "거래중/판매완료" 토글이 조용히 사라지는 버그가 난다.
const serverBoards = require('../../../server/constants/boards');

describe('클라이언트 ↔ 서버 보드 상수 동기화', () => {
  it('TRADE_BOARD_SLUGS가 서버와 일치한다', () => {
    expect([...TRADE_BOARD_SLUGS].sort()).toEqual([...serverBoards.TRADE_BOARD_SLUGS].sort());
  });

  it('LOCAL_BOARD_SLUGS가 서버와 일치한다', () => {
    expect([...LOCAL_BOARD_SLUGS].sort()).toEqual([...serverBoards.LOCAL_BOARD_SLUGS].sort());
  });

  it('거래 보드는 모두 지역 보드의 부분집합이다', () => {
    TRADE_BOARD_SLUGS.forEach((slug) => expect(LOCAL_BOARD_SLUGS).toContain(slug));
  });

  it('realestate/jobs는 의도적으로 거래 토글에서 제외되어 있다', () => {
    expect(TRADE_BOARD_SLUGS).not.toContain('realestate');
    expect(TRADE_BOARD_SLUGS).not.toContain('jobs');
  });
});

describe('isTradeBoard', () => {
  it('거래 보드면 true', () => {
    expect(isTradeBoard('market')).toBe(true);
    expect(isTradeBoard('roomrent')).toBe(true);
  });
  it('그 외에는 false', () => {
    expect(isTradeBoard('free')).toBe(false);
    expect(isTradeBoard(undefined)).toBe(false);
  });
});

describe('getTradeLabel', () => {
  const t = (key) => key; // 키를 그대로 돌려주는 stub

  it('roomrent는 입주 문구 키를 쓴다', () => {
    expect(getTradeLabel('roomrent', 'selling', t)).toBe('board.rentAvailable');
    expect(getTradeLabel('roomrent', 'sold', t)).toBe('board.rentTaken');
  });

  it('나머지 보드는 판매 문구 키를 쓴다', () => {
    expect(getTradeLabel('market', 'selling', t)).toBe('board.tradeSelling');
    expect(getTradeLabel('market', 'sold', t)).toBe('board.tradeSold');
  });

  it('t가 없으면 한국어 폴백', () => {
    expect(getTradeLabel('market', 'sold')).toBe('판매완료');
    expect(getTradeLabel('market', 'selling')).toBe('판매중');
  });
});

describe('getTradeChangeLabel', () => {
  const t = (key) => key;

  it('현재 상태의 반대로 바꾸는 문구를 준다', () => {
    expect(getTradeChangeLabel('market', 'selling', t)).toBe('board.tradeChangeToSold');
    expect(getTradeChangeLabel('market', 'sold', t)).toBe('board.tradeChangeToSelling');
    expect(getTradeChangeLabel('roomrent', 'selling', t)).toBe('board.rentChangeToTaken');
    expect(getTradeChangeLabel('roomrent', 'sold', t)).toBe('board.rentChangeToAvailable');
  });

  it('t가 없으면 빈 문자열', () => {
    expect(getTradeChangeLabel('market', 'selling')).toBe('');
  });
});
