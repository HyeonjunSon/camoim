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

module.exports = { LOCAL_BOARD_SLUGS };
