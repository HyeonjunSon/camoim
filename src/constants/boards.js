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

// Per-board title prefixes (말머리) — keys mirror BOARD_PREFIXES in server/constants/boards.js
// and web/src/lib/boards.ts. Labels come from i18n (`prefix.<key>`). `want` marks the demand
// side (buying, looking for), where a "for sale" badge would read wrong.
export const BOARD_PREFIXES = {
  market: [{ key: 'sell' }, { key: 'buy', want: true }],
  car: [{ key: 'sell' }, { key: 'buy', want: true }],
  giveaway: [{ key: 'give' }, { key: 'want', want: true }],
  roomrent: [{ key: 'offer' }, { key: 'seek', want: true }],
  jobs: [{ key: 'hiring' }, { key: 'seeking', want: true }],
  realestate: [{ key: 'sale' }, { key: 'lease' }],
};

export function getBoardPrefixes(boardSlug) {
  return BOARD_PREFIXES[boardSlug] || [];
}

// Label for a stored prefix, or '' when the board does not offer it (e.g. a key from a newer server)
export function getPrefixLabel(boardSlug, key, t) {
  if (!key || !getBoardPrefixes(boardSlug).some((p) => p.key === key)) return '';
  return t ? t(`prefix.${key}`) : key;
}

export function isWantPrefix(boardSlug, key) {
  return getBoardPrefixes(boardSlug).some((p) => p.key === key && p.want);
}

// The trade badge to show ('selling' | 'sold'), or null. A demand-side post ("삽니다")
// has nothing for sale, so only its finished state is worth a badge.
export function getTradeBadge(boardSlug, tradeStatus, prefix) {
  if (!isTradeBoard(boardSlug)) return null;
  const status = tradeStatus === 'sold' ? 'sold' : 'selling';
  if (status === 'selling' && isWantPrefix(boardSlug, prefix)) return null;
  return status;
}

// Board list sections — keys are i18n `boardGroup.<key>`. A board not listed lands in `other`,
// so a new board still shows up. Mirrors BOARD_GROUPS in web/src/lib/boards.ts.
export const BOARD_GROUPS = [
  { key: 'talk', slugs: ['free', 'anonymous', 'meetup', 'intro'] },
  { key: 'trade', slugs: ['market', 'giveaway', 'car'] },
  { key: 'living', slugs: ['roomrent', 'realestate', 'jobs'] },
  { key: 'info', slugs: ['immigration', 'study', 'workingholiday', 'exchange'] },
];

// Splits boards into sections, keeping the incoming order inside each; empty sections are dropped
export function groupBoards(boards) {
  const placed = new Set();
  const sections = BOARD_GROUPS.map((g) => {
    const inGroup = boards.filter((b) => g.slugs.includes(b.slug));
    inGroup.forEach((b) => placed.add(b.slug));
    return { key: g.key, boards: inGroup };
  });
  const rest = boards.filter((b) => !placed.has(b.slug));
  return [...sections, { key: 'other', boards: rest }].filter((s) => s.boards.length > 0);
}
