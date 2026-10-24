// Board slugs where a city is meaningful.
// Only posts on these boards carry a city field.
// Must stay in sync with LOCAL_BOARD_SLUGS in src/screens/board/CreatePostScreen.js.
const LOCAL_BOARD_SLUGS = [
  'market',
  'jobs',
  'roomrent',
  'car',
  'giveaway',
  'realestate',
  'meetup',
];

// Board slugs that get the trade-status (for sale / sold) toggle
const TRADE_BOARD_SLUGS = [
  'market',    // Buy & sell
  'giveaway',  // Giveaway
  'car',       // Cars
  'roomrent',  // Room rentals (available / filled)
];

// Per-board title prefixes (말머리). Optional — a post may carry none.
// Keys are what Post.prefix stores; labels live in each client so the app can
// translate them. `want` marks the demand side (buying, looking for), where a
// "for sale" trade badge would read wrong.
// Keep in sync with src/constants/boards.js and web/src/lib/boards.ts.
const BOARD_PREFIXES = {
  market: [{ key: 'sell' }, { key: 'buy', want: true }],
  car: [{ key: 'sell' }, { key: 'buy', want: true }],
  giveaway: [{ key: 'give' }, { key: 'want', want: true }],
  roomrent: [{ key: 'offer' }, { key: 'seek', want: true }],
  jobs: [{ key: 'hiring' }, { key: 'seeking', want: true }],
  realestate: [{ key: 'sale' }, { key: 'lease' }],
};

// The stored value for a requested prefix: the key if this board offers it, else ''.
// Unknown values are dropped rather than rejected so an older client never fails a post.
function normalizePrefix(boardSlug, value) {
  if (typeof value !== 'string' || !value) return '';
  const allowed = BOARD_PREFIXES[boardSlug] || [];
  return allowed.some((p) => p.key === value) ? value : '';
}

module.exports = { LOCAL_BOARD_SLUGS, TRADE_BOARD_SLUGS, BOARD_PREFIXES, normalizePrefix };
