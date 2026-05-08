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

// 라벨은 i18n에서 가져옴. roomrent는 입주가능/입주완료, 나머지는 판매중/판매완료
// status: 'selling' | 'sold'
export function getTradeLabel(boardSlug, status, t) {
  if (!t) return status === 'sold' ? '판매완료' : '판매중'; // fallback
  if (boardSlug === 'roomrent') {
    return t(status === 'sold' ? 'board.rentTaken' : 'board.rentAvailable');
  }
  return t(status === 'sold' ? 'board.tradeSold' : 'board.tradeSelling');
}

// 토글 버튼 라벨 — '판매완료로 변경' / '판매중으로'
export function getTradeChangeLabel(boardSlug, currentStatus, t) {
  if (!t) return '';
  if (boardSlug === 'roomrent') {
    return t(currentStatus === 'sold' ? 'board.rentChangeToAvailable' : 'board.rentChangeToTaken');
  }
  return t(currentStatus === 'sold' ? 'board.tradeChangeToSelling' : 'board.tradeChangeToSold');
}

export function isTradeBoard(boardSlug) {
  return TRADE_BOARD_SLUGS.includes(boardSlug);
}
