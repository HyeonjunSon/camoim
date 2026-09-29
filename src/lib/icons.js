// The single source for app-wide icons — emoji replaced by Ionicons so iOS and Android render alike
// Use: <IconTile icon={BOARD_ICONS.free} /> or <Ionicons name={BOARD_ICONS.free.ion} color={BOARD_ICONS.free.color} />
// ⚠️ Do not add new text emoji — add the icon here and render it through Ionicons instead

// Icon per board slug (shared by HomeScreen, BoardListScreen and UniversityBoardScreen)
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

// Group categories (shared by GroupList, GroupCreate and GroupEdit) — matches the server's category keys
export const GROUP_CATEGORY_ICONS = {
  hobby: { ion: 'color-palette', color: '#EC4899' },
  local: { ion: 'location', color: '#EF4444' },
  study: BOARD_ICONS.study,
  job: BOARD_ICONS.jobs,
  workinghol: BOARD_ICONS.workingholiday,
  general: BOARD_ICONS.free,
};

// Korean business map categories — matches the keys in constants/businesses.js
export const BIZ_CATEGORY_ICONS = {
  food: { ion: 'restaurant', color: '#FB923C' },
  cafe: { ion: 'cafe', color: '#D97706' },
  mart: { ion: 'cart', color: '#10B981' },
  hair: { ion: 'cut', color: '#8B5CF6' },
  clinic: { ion: 'medkit', color: '#F43F5E' },
  etc: { ion: 'location', color: '#9CA3AF' },
};

// Icons for home and shared section titles (emoji are stripped from the i18n strings and paired with an icon on screen)
export const SECTION_ICONS = {
  latest: { ion: 'create', color: '#6366F1' },     // Latest posts
  hot: { ion: 'flame', color: '#EF4444' },         // Trending now
  notice: { ion: 'megaphone', color: '#F97316' },  // Announcements
  bookmark: { ion: 'bookmark', color: '#7F77DD' }, // 🔖
  market: BOARD_ICONS.market,                      // Buy & sell
  jobs: BOARD_ICONS.jobs,                          // Jobs
  chat: BOARD_ICONS.free,                          // Chat
};

// Role selection icons for signup and onboarding
export const ROLE_ICONS = {
  student: BOARD_ICONS.university,                 // International student
  workingholiday: BOARD_ICONS.workingholiday,      // Working holiday
  general: { ion: 'leaf', color: '#E96B5C' },      // General (brand coral)
};
