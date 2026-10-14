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

/**
 * GET /api/stays — matches formatStay in server/routes/stays.js.
 *
 * lat/lng are the *approximate* coordinates: the exact point is jittered before
 * it leaves the server, and the exact address never does at all.
 */
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
  lat: number | null;
  lng: number | null;
  /** Only when the request passed `near` */
  distanceKm?: number | null;
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

// ── Chat ─────────────────────────────────────────────────────────────────────

/** GET /api/chats — the three kinds come back with different shapes. */
export type ChatRoomSummary = {
  id: string;
  kind: 'dm' | 'group' | 'school';
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  status: 'pending' | 'accepted';
  /** DM only */
  other?: { id: string | null; nickname: string; avatarUrl?: string; anonymous?: boolean } | null;
  requesterId?: string;
  isRequester?: boolean;
  otherLeft?: boolean;
  otherDeleted?: boolean;
  /** Group chat only */
  group?: { id: string; name: string; coverImage?: string; memberCount: number };
  /** School lounge only */
  school?: { university: string; name: string; memberCount: number };
};

/** GET /api/chats/:roomId/messages — fields sit beside `data`, so read the envelope. */
export type ChatMessagesEnvelope = {
  data: ChatMessage[];
  otherLeft: boolean;
  otherDeleted: boolean;
  kind: 'dm' | 'group' | 'school';
  group?: { id: string; name: string; coverImage?: string; memberCount: number };
  school?: { university: string; name: string; memberCount: number; leaderUserId: string | null };
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderNickname: string;
  content: string;
  readBy: string[];
  createdAt: string;
};

// ── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'comment'
  | 'reply'
  | 'like'
  | 'chat_request'
  | 'verify'
  | 'report'
  | 'notice'
  | 'group'
  | 'university_leader'
  | 'intro';

/** GET /api/notifications */
export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  postId?: string | null;
  roomId?: string | null;
  createdAt: string;
};

// ── Profile, blocks and reports ──────────────────────────────────────────────

/** GET /api/users/:userId */
export type PublicProfile = {
  id: string;
  nickname: string;
  bio?: string;
  role: Role;
  school?: string;
  city?: string;
  avatarUrl?: string | null;
  createdAt: string;
  verified: boolean;
  university?: string;
  tradeSoldCount: number;
  posts: PostSummary[];
};

/** GET /api/users/me/blocks */
export type BlockEntry = {
  id: string;
  blockedId: string;
  nickname: string;
  avatarUrl?: string | null;
  blockChat: boolean;
  hideContent: boolean;
  createdAt: string;
};

export type BlockStatus = { blocked: boolean; blockChat: boolean; hideContent: boolean };

/** POST /api/reports — reasons as server/routes/reports.js names them. */
export const REPORT_REASONS = [
  { value: 'spam', label: '스팸/도배' },
  { value: 'hate', label: '욕설/혐오' },
  { value: 'illegal', label: '불법정보' },
  { value: 'adult', label: '음란물' },
  { value: 'etc', label: '기타' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

// ── Korean business map ──────────────────────────────────────────────────────

/** GET /api/businesses — `city` here is a lowercase slug, not an English name. */
export type Business = {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  description: string;
  images: string[];
  lat: number | null;
  lng: number | null;
  source: 'google' | 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  bookmarkCount: number;
  ratingAvg: number;
  ratingCount: number;
  submitterNickname: string;
  sourceName: string;
  createdAt: string;
  bookmarked: boolean;
  /** Only when the request passed `near` */
  distanceKm?: number | null;
  /** Only on /businesses/trending */
  rank?: number;
  weeklyViews?: number;
};

export type BusinessReview = {
  id: string;
  rating: number;
  text: string;
  nickname: string;
  createdAt: string;
  mine: boolean;
};

/** GET /api/stays/:id — the exact address is never in a response. */
export type StayDetail = Stay & {
  deposit: number;
  conditions: string[];
  description: string;
  address: string;
  availableUntil?: string;
  minLeaseMonths: number;
  includes?: string;
  host: { id: string; nickname: string; verified: boolean };
  isMine: boolean;
  bookmarkCount: number;
  bookmarked: boolean;
  createdAt: string;
};
