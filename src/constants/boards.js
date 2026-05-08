// 클라이언트용 게시판 slug 상수 — server/constants/boards.js와 일치 유지

// 도시 필터가 의미 있는 보드
export const LOCAL_BOARD_SLUGS = [
  'market', 'jobs', 'roomrent', 'car', 'giveaway', 'realestate', 'meetup',
];

// 거래 상태 토글(판매중/판매완료) 적용 보드
export const TRADE_BOARD_SLUGS = [
  'market',    // 사고팔고
  'giveaway',  // 나눔
  'car',       // 자동차
  'roomrent',  // 룸렌트 (입주가능/입주완료)
];

// roomrent는 라벨이 다름 (입주가능/입주완료)
export const TRADE_LABELS = {
  default:  { selling: '판매중', sold: '판매완료' },
  roomrent: { selling: '입주가능', sold: '입주완료' },
};

export function getTradeLabel(boardSlug, status) {
  const set = TRADE_LABELS[boardSlug] || TRADE_LABELS.default;
  return set[status] || set.selling;
}

export function isTradeBoard(boardSlug) {
  return TRADE_BOARD_SLUGS.includes(boardSlug);
}
