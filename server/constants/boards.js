// 지역(도시)이 의미 있는 보드 slug 목록.
// 이 목록에 포함된 보드의 글만 city 필드를 가진다.
// 클라이언트(src/screens/board/CreatePostScreen.js)의 LOCAL_BOARD_SLUGS와 반드시 일치시킬 것.
const LOCAL_BOARD_SLUGS = [
  'market',
  'jobs',
  'roomrent',
  'car',
  'giveaway',
  'realestate',
  'meetup',
];

// 거래 상태(판매중/판매완료) 토글이 적용되는 보드 slug 목록
const TRADE_BOARD_SLUGS = [
  'market',    // 사고팔고
  'giveaway',  // 나눔
  'car',       // 자동차
  'roomrent',  // 룸렌트 (입주가능/입주완료)
];

module.exports = { LOCAL_BOARD_SLUGS, TRADE_BOARD_SLUGS };
