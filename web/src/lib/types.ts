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
  /** School boards only: marks the student president, shown as a star. */
  authorIsLeader?: boolean;
  /** Set on a group post, which is readable by that group's members only. */
  groupId?: string | null;
  boardId?: string;
};

/** GET /api/posts/latest-by-board */
export type LatestByBoard = {
  boardId: string;
  latest: {
    id: string;
    title: string;
    createdAt: string;
    likeCount: number;
    commentCount: number;
    nickname: string;
    thumbnail: string | null;
  } | null;
};

/** GET /api/posts/:id */
export type PostDetail = {
  id: string;
  title: string;
  content: string;
  isAnonymous: boolean;
  viewCount: number;
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
  commentCount: number;
  createdAt: string;
  boardName?: string;
  boardSlug?: string;
  boardId?: string;
  groupId?: string;
  groupName?: string;
  pinned: boolean;
  tradeStatus: 'selling' | 'sold';
  city: string;
  userId: string | null;
  authorId: string | null;
  nickname: string;
  role: Role | null;
  avatarUrl: string | null;
  authorIsLeader: boolean;
  images: string[];
};

/** GET /api/posts/:id/comments — already a tree, replies nested one level deep */
export type CommentNode = {
  id: string;
  content?: string;
  isAnonymous?: boolean;
  isSecret?: boolean;
  /** Set instead of `content` when a locked comment is not yours to read. */
  isSecretMasked?: boolean;
  likeCount?: number;
  createdAt: string;
  edited?: boolean;
  parentId: string | null;
  userId?: string;
  nickname?: string;
  avatarUrl?: string | null;
  isPinned?: boolean;
  replies: CommentNode[];
};

/** GET /api/search */
export type SearchResults = {
  posts: PostSummary[];
  groups: { id: string; name: string; description?: string; category?: string; memberCount?: number }[];
  users: { id: string; nickname: string; avatarUrl?: string | null; university?: string }[];
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
