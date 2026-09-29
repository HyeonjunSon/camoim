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

module.exports = { LOCAL_BOARD_SLUGS, TRADE_BOARD_SLUGS };
