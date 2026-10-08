// Shapes as they arrive after toCamel (so `_id` is already `id`).

// Values as the server stores them (server/constants/roles.js) — snake_case,
// and untouched by toCamel, which only rewrites keys.
export type Role = 'student' | 'working_holiday' | 'general' | 'admin';

export type User = {
  id: string;
  email: string;
  nickname: string;
  location?: string;
  school?: string;
  bio?: string;
  role: Role;
  verified: boolean;
  university?: string;
  city?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  hasPassword?: boolean;
};

export type Board = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  isAnonymousAllowed?: boolean;
  isUniversityBoard?: boolean;
  university?: string;
  sortOrder?: number;
};

export type PostSummary = {
  id: string;
  title: string;
  content: string;
  isAnonymous?: boolean;
  likeCount: number;
  commentCount: number;
  viewCount?: number;
  createdAt: string;
  nickname: string;
  boardName?: string;
  boardSlug?: string;
  thumbnail?: string | null;
  city?: string;
  // Posts carry no price column — sellers write the price into the title or body.
  tradeStatus?: 'selling' | 'sold';
};

/** GET /api/posts/hot-by-board */
export type HotBoardSection = {
  boardId: string;
  boardName: string;
  boardSlug: string;
  posts: PostSummary[];
};

/** GET /api/posts/home-sections */
export type HomeSections = {
  freePosts: PostSummary[];
  marketPosts: PostSummary[];
  jobsPosts: PostSummary[];
};

/** GET /api/notices */
export type Notice = {
  id: string;
  title: string;
  content?: string;
  pinned?: boolean;
  author?: string;
  createdAt: string;
};

/** GET /api/stays — matches formatStay in server/routes/stays.js */
export type Stay = {
  id: string;
  title: string;
  stayType: 'minbak' | 'roomrent' | 'homestay' | 'hasuk';
  city?: string;
  price: number;
  priceUnit: 'month' | 'night';
  images: string[];
  neighborhood?: string;
  moveInDate?: string;
  status: 'active' | 'closed';
};

/** GET /api/universities/community */
export type SchoolCommunity = {
  university?: string;
  fullName?: string;
  canEdit?: boolean;
  isLeader?: boolean;
  community?: {
    instagram?: string;
    kakaoOpen?: string;
    discord?: string;
    homepage?: string;
    notice?: string;
  };
};

export type ExchangeRate = {
  cadToKrw: number;
  date: string;
  source: string;
};
