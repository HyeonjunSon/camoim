// Client-side board slug constants — kept in sync with server/constants/boards.js

// Boards where the city filter is meaningful
export const LOCAL_BOARD_SLUGS = [
  'market', 'jobs', 'roomrent', 'car', 'giveaway', 'realestate', 'meetup',
];

// Boards that get the trade-status toggle (for sale / sold)
export const TRADE_BOARD_SLUGS = [
  'market',    // Buy & sell
  'giveaway',  // Giveaway
  'car',       // Cars
  'roomrent',  // Room rentals (available / filled)
];

// Labels come from i18n. roomrent uses available/filled; everything else uses for sale/sold
// status: 'selling' | 'sold'
export function getTradeLabel(boardSlug, status, t) {
  if (!t) return status === 'sold' ? '판매완료' : '판매중'; // fallback
  if (boardSlug === 'roomrent') {
    return t(status === 'sold' ? 'board.rentTaken' : 'board.rentAvailable');
  }
  return t(status === 'sold' ? 'board.tradeSold' : 'board.tradeSelling');
}

// Toggle button labels — "mark as sold" / "back to for sale"
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
