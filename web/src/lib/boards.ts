import type { Lang } from './i18n/lang';

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
export function tradeLabel(slug: string | undefined, status: 'selling' | 'sold', lang: Lang = 'ko'): string {
  const sold = status === 'sold';
  if (lang === 'en') {
    if (slug === 'roomrent') return sold ? 'Taken' : 'Available';
    if (slug === 'giveaway') return sold ? 'Given' : 'Available';
    return sold ? 'Sold' : 'For Sale';
  }
  if (slug === 'roomrent') return sold ? '입주완료' : '입주가능';
  if (slug === 'giveaway') return sold ? '나눔완료' : '나눔중';
  return sold ? '거래완료' : '판매중';
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

/** Korean display name for a city key; English shows the key itself, as the app does. */
export function cityLabel(city?: string, lang: Lang = 'ko'): string {
  if (!city) return '';
  if (lang === 'en') return city;
  return CITY_LABELS[city] ?? city;
}

// Per-board title prefixes (말머리). Keys mirror BOARD_PREFIXES in
// server/constants/boards.js and src/constants/boards.js; the labels are the
// app's Korean strings (`prefix.*` in src/lib/i18n.js). `want` marks the demand
// side — buying, looking for — where a "판매중" badge would read wrong.
type Prefix = { key: string; label: string; labelEn: string; want?: boolean };

export const BOARD_PREFIXES: Record<string, Prefix[]> = {
  market: [
    { key: 'sell', label: '팝니다', labelEn: 'Selling' },
    { key: 'buy', label: '삽니다', labelEn: 'Buying', want: true },
  ],
  car: [
    { key: 'sell', label: '팝니다', labelEn: 'Selling' },
    { key: 'buy', label: '삽니다', labelEn: 'Buying', want: true },
  ],
  giveaway: [
    { key: 'give', label: '나눔해요', labelEn: 'Free' },
    { key: 'want', label: '구해요', labelEn: 'Wanted', want: true },
  ],
  roomrent: [
    { key: 'offer', label: '방 있어요', labelEn: 'Room available' },
    { key: 'seek', label: '방 구해요', labelEn: 'Looking for room', want: true },
  ],
  jobs: [
    { key: 'hiring', label: '구인', labelEn: 'Hiring' },
    { key: 'seeking', label: '구직', labelEn: 'Seeking work', want: true },
  ],
  realestate: [
    { key: 'sale', label: '매매', labelEn: 'For sale' },
    { key: 'lease', label: '렌트', labelEn: 'For rent' },
  ],
};

export function prefixText(p: Prefix, lang: Lang = 'ko'): string {
  return lang === 'en' ? p.labelEn : p.label;
}

export function boardPrefixes(slug?: string) {
  return (slug && BOARD_PREFIXES[slug]) || [];
}

/** The label for a stored prefix, or '' when this board does not offer it. */
export function prefixLabel(slug: string | undefined, key: string | undefined, lang: Lang = 'ko'): string {
  if (!key) return '';
  const p = boardPrefixes(slug).find((x) => x.key === key);
  return p ? prefixText(p, lang) : '';
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
export const BOARD_GROUPS: { title: string; titleEn: string; slugs: string[] }[] = [
  { title: '소통', titleEn: 'Community', slugs: ['free', 'anonymous', 'meetup', 'intro'] },
  { title: '사고팔고', titleEn: 'Buy & Sell', slugs: ['market', 'giveaway', 'car'] },
  { title: '집·일자리', titleEn: 'Housing & Jobs', slugs: ['roomrent', 'realestate', 'jobs'] },
  { title: '정보', titleEn: 'Info', slugs: ['immigration', 'study', 'workingholiday', 'exchange'] },
];

/** Splits boards into rail sections, keeping the API's order inside each one. */
export function groupBoards<T extends { slug: string }>(
  boards: T[],
  lang: Lang = 'ko'
): { title: string; boards: T[] }[] {
  const placed = new Set<string>();
  const sections = BOARD_GROUPS.map((g) => {
    const inGroup = boards.filter((b) => g.slugs.includes(b.slug));
    inGroup.forEach((b) => placed.add(b.slug));
    return { title: lang === 'en' ? g.titleEn : g.title, boards: inGroup };
  });
  const rest = boards.filter((b) => !placed.has(b.slug));
  return [...sections, { title: lang === 'en' ? 'Other' : '기타', boards: rest }].filter(
    (s) => s.boards.length > 0
  );
}

// English board names and descriptions, copied from the app (boardName / boardDesc in
// src/lib/i18n.js). Korean comes from the API's own `name`, so only English lives here.
const BOARD_NAMES_EN: Record<string, string> = {
  intro: 'Intro',
  free: 'Free Board',
  anonymous: 'Anonymous Board',
  meetup: 'Meetups & Hangouts',
  immigration: 'Immigration & PR',
  study: 'Education & Study',
  workingholiday: 'Working Holiday',
  market: 'Buy & Sell',
  car: 'Cars & Vehicles',
  giveaway: 'Free Giveaways',
  jobs: 'Jobs & Part-time',
  realestate: 'Real Estate',
  roomrent: 'Room Rent & Stays',
  exchange: 'Currency & Scam Alert',
};
const BOARD_DESC_EN: Record<string, string> = {
  intro: 'Introductions, open to any member 19+',
  free: 'Talk freely about anything',
  anonymous: 'Share your thoughts anonymously',
  meetup: 'Find travel buddies & companions',
  immigration: 'Immigration & PR tips and questions',
  study: 'Education, school & study abroad info',
  workingholiday: 'Working holiday tips & questions',
  market: 'Buy and sell items',
  car: 'Buy and sell used cars',
  giveaway: 'Give away items for free',
  jobs: 'Find or post jobs',
  realestate: 'Home buying & leasing info',
  roomrent: 'Room rentals, homestays & boarding',
  exchange: 'Currency exchange & scam alerts',
};
// School boards are slugged `<school>-free` / `<school>-anonymous`.
const SCHOOL_SUFFIX_EN: Record<string, [string, string]> = {
  free: ['Free Board', 'Chat freely with schoolmates'],
  anonymous: ['Anonymous Board', 'Chat anonymously with schoolmates'],
};

/**
 * A board's display name. Korean is the API's name; English falls back to it when unknown.
 * School boards keep the API name in both languages — it carries the school, and an admin
 * sees every school's boards, where a bare "Free Board" would be ambiguous.
 */
export function boardName(slug: string | undefined, name: string | undefined, lang: Lang = 'ko'): string {
  if (lang !== 'en' || !slug) return name ?? slug ?? '';
  const suffix = slug.slice(slug.lastIndexOf('-') + 1);
  if (slug.includes('-') && SCHOOL_SUFFIX_EN[suffix]) return name ?? SCHOOL_SUFFIX_EN[suffix][0];
  return BOARD_NAMES_EN[slug] ?? name ?? slug;
}

export function boardDescription(slug: string | undefined, desc: string | undefined, lang: Lang = 'ko'): string {
  if (lang !== 'en' || !slug) return desc ?? '';
  const suffix = slug.slice(slug.lastIndexOf('-') + 1);
  if (slug.includes('-') && SCHOOL_SUFFIX_EN[suffix]) return SCHOOL_SUFFIX_EN[suffix][1];
  return BOARD_DESC_EN[slug] ?? desc ?? '';
}
