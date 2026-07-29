// 앱 전역 아이콘 단일 소스 — 이모지 → Ionicons 통일 (iOS/Android 동일 렌더링)
// 사용: <IconTile icon={BOARD_ICONS.free} /> 또는 <Ionicons name={BOARD_ICONS.free.ion} color={BOARD_ICONS.free.color} />
// ⚠️ 텍스트 이모지 신규 추가 금지 — 아이콘이 필요하면 여기에 추가하고 Ionicons로 렌더링

// 게시판 slug별 아이콘 (HomeScreen / BoardListScreen / UniversityBoardScreen 공용)
export const BOARD_ICONS = {
  free: { ion: 'chatbubble-ellipses', color: '#6366F1' },
  anonymous: { ion: 'eye-off', color: '#F97316' },
  meetup: { ion: 'people', color: '#FB923C' },
  immigration: { ion: 'id-card', color: '#3B82F6' },
  study: { ion: 'book', color: '#5B67E8' },
  workingholiday: { ion: 'airplane', color: '#0EA5E9' },
  market: { ion: 'bag-handle', color: '#EC4899' },
  car: { ion: 'car-sport', color: '#22C55E' },
  giveaway: { ion: 'gift', color: '#F43F5E' },
  jobs: { ion: 'briefcase', color: '#10B981' },
  realestate: { ion: 'home', color: '#2563EB' },
  roomrent: { ion: 'bed', color: '#EF4444' },
  exchange: { ion: 'swap-horizontal', color: '#D97706' },
  university: { ion: 'school', color: '#7C3AED' },
  info: { ion: 'bulb', color: '#F59E0B' },
  default: { ion: 'clipboard', color: '#9CA3AF' },
};

// 모임 카테고리 (GroupList / GroupCreate / GroupEdit 공용) — 서버 category 키와 일치
export const GROUP_CATEGORY_ICONS = {
  hobby: { ion: 'color-palette', color: '#EC4899' },
  local: { ion: 'location', color: '#EF4444' },
  study: BOARD_ICONS.study,
  job: BOARD_ICONS.jobs,
  workinghol: BOARD_ICONS.workingholiday,
  general: BOARD_ICONS.free,
};

// 한인업체 지도 카테고리 — constants/businesses.js 키와 일치
export const BIZ_CATEGORY_ICONS = {
  food: { ion: 'restaurant', color: '#FB923C' },
  cafe: { ion: 'cafe', color: '#D97706' },
  mart: { ion: 'cart', color: '#10B981' },
  hair: { ion: 'cut', color: '#8B5CF6' },
  clinic: { ion: 'medkit', color: '#F43F5E' },
  etc: { ion: 'location', color: '#9CA3AF' },
};

// 홈/공통 섹션 제목 아이콘 (i18n 문자열에서 이모지 제거 → 화면에서 아이콘+텍스트 조합)
export const SECTION_ICONS = {
  latest: { ion: 'create', color: '#6366F1' },     // 📝 최신글
  hot: { ion: 'flame', color: '#EF4444' },         // 🔥 지금 인기
  notice: { ion: 'megaphone', color: '#F97316' },  // 📢 공지사항
  bookmark: { ion: 'bookmark', color: '#7F77DD' }, // 🔖
  market: BOARD_ICONS.market,                      // 🛍️ 중고거래
  jobs: BOARD_ICONS.jobs,                          // 💼 구인구직
  chat: BOARD_ICONS.free,                          // 💬 채팅하기
};

// 가입/온보딩 role 선택 아이콘
export const ROLE_ICONS = {
  student: BOARD_ICONS.university,                 // 🎓 유학생
  workingholiday: BOARD_ICONS.workingholiday,      // ✈️ 워홀러
  general: { ion: 'leaf', color: '#E96B5C' },      // 🍁 일반 (브랜드 코랄)
};
