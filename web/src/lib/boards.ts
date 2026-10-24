// Board accent colours, mirroring lightBoardColors in src/constants/colors.js.
//
// `dot` is the app's exact value — it only ever appears as a bare swatch, so its
// contrast does not matter. `fg`/`bg` are the darkened pair used for the badge
// chips, where text sits on a tint and has to clear 4.5:1. They are web-only;
// the app renders its badges differently.
type BoardTone = { dot: string; fg: string; bg: string };

const TONES: Record<string, BoardTone> = {
  intro: { dot: '#EC4899', fg: '#BE185D', bg: '#FCE7F3' },
  free: { dot: '#6366F1', fg: '#4338CA', bg: '#E0E7FF' },
  anonymous: { dot: '#8B5CF6', fg: '#6D28D9', bg: '#EDE9FE' },
  meetup: { dot: '#FB923C', fg: '#C2410C', bg: '#FFEDD5' },
  immigration: { dot: '#0891B2', fg: '#0E7490', bg: '#CFFAFE' },
  study: { dot: '#3B82F6', fg: '#1D4ED8', bg: '#DBEAFE' },
  workingholiday: { dot: '#D97706', fg: '#B45309', bg: '#FEF3C7' },
  market: { dot: '#F97316', fg: '#C2410C', bg: '#FFEDD5' },
  car: { dot: '#94A3B8', fg: '#334155', bg: '#E2E8F0' },
  giveaway: { dot: '#10B981', fg: '#047857', bg: '#D1FAE5' },
  jobs: { dot: '#10B981', fg: '#047857', bg: '#D1FAE5' },
  realestate: { dot: '#F43F5E', fg: '#BE123C', bg: '#FFE4E6' },
  roomrent: { dot: '#EF4444', fg: '#B91C1C', bg: '#FEE2E2' },
  exchange: { dot: '#CA8A04', fg: '#A16207', bg: '#FEF9C3' },
  university: { dot: '#3B82F6', fg: '#1D4ED8', bg: '#DBEAFE' },
};

const DEFAULT_TONE: BoardTone = { dot: '#9CA3AF', fg: '#374151', bg: '#F3F4F6' };

export function boardTone(slug?: string): BoardTone {
  if (!slug) return DEFAULT_TONE;
  // School boards are slugged `<school>-free`, `<school>-anonymous`.
  if (slug.endsWith('-free') || slug.endsWith('-anonymous')) return TONES.university;
  return TONES[slug] ?? DEFAULT_TONE;
}

// Keep in sync with server/constants/boards.js and src/constants/boards.js.
export const TRADE_BOARD_SLUGS = ['market', 'giveaway', 'car', 'roomrent'] as const;
export const LOCAL_BOARD_SLUGS = [
  'market',
  'jobs',
  'roomrent',
  'car',
  'giveaway',
  'realestate',
  'meetup',
] as const;

export function isTradeBoard(slug?: string): boolean {
  return !!slug && (TRADE_BOARD_SLUGS as readonly string[]).includes(slug);
}

export function isLocalBoard(slug?: string): boolean {
  return !!slug && (LOCAL_BOARD_SLUGS as readonly string[]).includes(slug);
}

/** roomrent reads as move-in status rather than sold; mirrors getTradeLabel in the app. */
export function tradeLabel(slug: string | undefined, status: 'selling' | 'sold'): string {
  if (slug === 'roomrent') return status === 'sold' ? '입주완료' : '입주가능';
  if (slug === 'giveaway') return status === 'sold' ? '나눔완료' : '나눔중';
  return status === 'sold' ? '거래완료' : '판매중';
}

// Single source of truth for cities, mirroring src/constants/cities.js.
// These exact strings are what Post.city holds and what the `city` query
// parameter matches, so they are never translated. Metro folding
// (Kitchener -> Toronto) happens on the server in utils/metro.js.
export const CITIES = [
  'Toronto',
  'Vancouver',
  'Montreal',
  'Calgary',
  'Edmonton',
  'Ottawa',
  'Winnipeg',
  'Victoria',
  'Halifax',
  'Saskatoon',
  'London',
  'Windsor',
  'Quebec',
] as const;

export const DEFAULT_CITY = 'Toronto';

// Display-only Korean labels. The English key is what is stored and queried —
// never send a label to the API. A city not listed here (metro folding can
// surface one, e.g. Kitchener) falls back to its English name rather than
// showing nothing.
const CITY_LABELS: Record<string, string> = {
  Toronto: '토론토',
  Vancouver: '밴쿠버',
  Montreal: '몬트리올',
  Calgary: '캘거리',
  Edmonton: '에드먼턴',
  Ottawa: '오타와',
  Winnipeg: '위니펙',
  Victoria: '빅토리아',
  Halifax: '핼리팩스',
  Saskatoon: '서스캐툰',
  London: '런던',
  Windsor: '윈저',
  Quebec: '퀘벡',
};

export function cityLabel(city?: string): string {
  if (!city) return '';
  return CITY_LABELS[city] ?? city;
}

// Per-board title prefixes (말머리). Keys mirror BOARD_PREFIXES in
// server/constants/boards.js and src/constants/boards.js; the labels are the
// app's Korean strings (`prefix.*` in src/lib/i18n.js). `want` marks the demand
// side — buying, looking for — where a "판매중" badge would read wrong.
export const BOARD_PREFIXES: Record<string, { key: string; label: string; want?: boolean }[]> = {
  market: [{ key: 'sell', label: '팝니다' }, { key: 'buy', label: '삽니다', want: true }],
  car: [{ key: 'sell', label: '팝니다' }, { key: 'buy', label: '삽니다', want: true }],
  giveaway: [{ key: 'give', label: '나눔해요' }, { key: 'want', label: '구해요', want: true }],
  roomrent: [{ key: 'offer', label: '방 있어요' }, { key: 'seek', label: '방 구해요', want: true }],
  jobs: [{ key: 'hiring', label: '구인' }, { key: 'seeking', label: '구직', want: true }],
  realestate: [{ key: 'sale', label: '매매' }, { key: 'lease', label: '렌트' }],
};

export function boardPrefixes(slug?: string) {
  return (slug && BOARD_PREFIXES[slug]) || [];
}

/** The label for a stored prefix, or '' when this board does not offer it. */
export function prefixLabel(slug: string | undefined, key: string | undefined): string {
  if (!key) return '';
  return boardPrefixes(slug).find((p) => p.key === key)?.label ?? '';
}

/**
 * The trade badge to show, or null. A buying post has nothing for sale, so only
 * its finished state earns a badge. Mirrors getTradeBadge in the app.
 */
export function tradeBadge(
  slug: string | undefined,
  status: 'selling' | 'sold' | undefined,
  prefix?: string
): 'selling' | 'sold' | null {
  if (!isTradeBoard(slug)) return null;
  const s = status === 'sold' ? 'sold' : 'selling';
  if (s === 'selling' && boardPrefixes(slug).some((p) => p.key === prefix && p.want)) return null;
  return s;
}

// Stand-in for a post without a photo. The app draws the same boards with
// Ionicons (BOARD_ICONS in src/lib/icons.js); the web has no icon font, so emoji.
const BOARD_EMOJI: Record<string, string> = {
  intro: '💘',
  free: '💬',
  anonymous: '🤫',
  meetup: '🙌',
  immigration: '🍁',
  study: '📚',
  workingholiday: '✈️',
  market: '🛍️',
  car: '🚗',
  giveaway: '🎁',
  jobs: '💼',
  realestate: '🏠',
  roomrent: '🛏️',
  exchange: '💱',
  university: '🎓',
};

export function boardEmoji(slug?: string): string {
  if (!slug) return '📝';
  if (slug.endsWith('-free') || slug.endsWith('-anonymous')) return BOARD_EMOJI.university;
  return BOARD_EMOJI[slug] ?? '📝';
}

// Rail sections. A board not listed lands in 기타, so a new board shows up
// without anyone remembering to file it here. School boards keep their own
// 내 학교 section.
export const BOARD_GROUPS: { title: string; slugs: string[] }[] = [
  { title: '소통', slugs: ['free', 'anonymous', 'meetup', 'intro'] },
  { title: '사고팔고', slugs: ['market', 'giveaway', 'car'] },
  { title: '집·일자리', slugs: ['roomrent', 'realestate', 'jobs'] },
  { title: '정보', slugs: ['immigration', 'study', 'workingholiday', 'exchange'] },
];

/** Splits boards into rail sections, keeping the API's order inside each one. */
export function groupBoards<T extends { slug: string }>(boards: T[]): { title: string; boards: T[] }[] {
  const placed = new Set<string>();
  const sections = BOARD_GROUPS.map((g) => {
    const inGroup = boards.filter((b) => g.slugs.includes(b.slug));
    inGroup.forEach((b) => placed.add(b.slug));
    return { title: g.title, boards: inGroup };
  });
  const rest = boards.filter((b) => !placed.has(b.slug));
  return [...sections, { title: '기타', boards: rest }].filter((s) => s.boards.length > 0);
}
