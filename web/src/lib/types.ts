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
  /** Group boards sort pinned posts first. */
  pinned?: boolean;
  avatarUrl?: string | null;
  userId?: string;
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

/** GET /api/universities/community — verified members of that school only. */
export type SchoolCommunity = {
  university: string;
  community: CommunityLinks;
  /** The sitting student president, who may edit the card. */
  isLeader: boolean;
  canEdit: boolean;
  hasLeader: boolean;
};

/** GET /api/universities/members — leaderUserId sits beside `data`. */
export type SchoolMembersEnvelope = {
  data: { id: string; nickname: string; avatarUrl?: string | null; role: Role }[];
  leaderUserId: string | null;
  university: string;
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

// ── Groups ───────────────────────────────────────────────────────────────────

export type GroupCategory = 'hobby' | 'study' | 'local' | 'job' | 'workinghol' | 'general';

/** GET /api/groups */
export type GroupSummary = {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  category: GroupCategory;
  city?: string;
  /** Non-empty marks a school club: joinable only by that school's verified members. */
  university?: string;
  ownerId: string;
  memberCount: number;
  postCount: number;
  joinPolicy: 'open' | 'approval';
  createdAt: string;
};

export type GroupMembershipInfo = {
  role: 'owner' | 'manager' | 'member';
  status: 'active' | 'pending' | 'banned';
  notifyPosts: boolean;
  notifyChat: boolean;
};

/** GET /api/groups/:id */
export type GroupDetail = {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  category: GroupCategory;
  city?: string;
  university?: string;
  owner: { id: string; nickname: string; avatarUrl?: string };
  memberCount: number;
  postCount: number;
  joinPolicy: 'open' | 'approval';
  maxMembers: number;
  status: 'pending_review' | 'active' | 'rejected';
  rejectReason?: string;
  createdAt: string;
  myMembership: GroupMembershipInfo | null;
  community: CommunityLinks;
  canEditCommunity: boolean;
};

export type CommunityLinks = {
  instagram: string;
  kakaoOpen: string;
  discord: string;
  homepage: string;
  notice: string;
};

/**
 * GET /api/groups/:id/members — note `id` is the member's **user** id, not the
 * membership record's, which is what every management call takes.
 */
export type GroupMember = {
  id: string;
  nickname: string;
  avatarUrl?: string;
  verified: boolean;
  university?: string;
  role: 'owner' | 'manager' | 'member';
  status: 'active' | 'pending' | 'banned';
  joinedAt: string;
};

// ── Intro board ──────────────────────────────────────────────────────────────
//
// Entirely anonymous: no nickname or avatar appears anywhere, and a declined
// request is never shown to the sender. Posts expire after INTRO_EXPIRY_DAYS.

export type IntroGender = 'male' | 'female';
export type IntroJob = 'student' | 'office' | 'professional' | 'business' | 'workinghol' | '';

/** GET /api/intro, /api/intro/:id — contact fields are blank unless it is yours. */
export type IntroPost = {
  id: string;
  mode: 'self' | 'proxy';
  gender: IntroGender;
  birthYear: number;
  region: string;
  job: IntroJob;
  height: string;
  headline: string;
  bio: string;
  photo: string;
  preferredBirthYearMin: number | null;
  preferredBirthYearMax: number | null;
  preferredRegion: string;
  hasContact: boolean;
  contactType: 'instagram' | 'kakao' | '';
  contactValue: string;
  status: 'active' | 'hidden' | 'closed';
  expired: boolean;
  daysLeft: number;
  isMine: boolean;
  createdAt: string;
  /** Only on /intro/mine */
  pendingCount?: number;
};

/** GET /api/intro/meta */
export type IntroMeta = {
  agreed: boolean;
  dailyRemaining: number;
  defaults: { gender?: IntroGender; birthYear?: number; region?: string; job?: IntroJob };
};

/** GET /api/intro/requests/received — the requester stays anonymous. */
export type IntroRequest = {
  id: string;
  introPostId: string;
  introHeadline: string;
  gender: IntroGender | '';
  birthYear: number | null;
  region: string;
  job: IntroJob;
  /** 'school' for a verified student, 'email' for any other verified account. */
  verificationBadge: 'school' | 'email' | '';
  memberMonths: number;
  message: string;
  createdAt: string;
};

// ── Admin ────────────────────────────────────────────────────────────────────
//
// Every /api/admin route is guarded by requireAuth + requireRole('admin') on
// the server. The web adds its own check in the admin layout, because proxy.ts
// can only see that a session cookie exists, not what role it carries.

/** GET /api/admin/stats */
export type AdminStats = {
  users: { total: number; active: number; suspended: number; banned: number; deleted: number };
  content: { posts: number; comments: number };
  pending: {
    reports: number;
    verify: number;
    inquiry: number;
    groups: number;
    businesses: number;
  };
  signups: { d1: number; d7: number; d30: number };
  posts: { d1: number; d7: number };
  /**
   * Both trends are `{ date, count }`. signupTrend comes out of a `$group`,
   * whose day lives in `_id`, so the server renames it before replying —
   * otherwise toCamel would deliver it as `id` and the two trends from this one
   * endpoint would disagree.
   */
  signupTrend: { date: string; count: number }[];
  dau: { today: number; trend: { date: string; count: number }[] };
};

/** GET /api/admin/verify-requests — the file is a student card in camoim/verify. */
export type VerifyRequest = {
  id: string;
  userId: string;
  nickname: string;
  email: string;
  university: string;
  studentType?: string;
  graduationYear?: number;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
};

/** GET /api/admin/reports */
export type AdminReport = {
  id: string;
  reporterNickname?: string;
  reporterEmail?: string;
  targetType: 'post' | 'comment' | 'user' | 'business' | 'intro';
  targetId: string;
  postId?: string | null;
  /** Already a Korean label from the server, not the raw enum. */
  reason: string;
  detail?: string;
  /** The reported content itself, prefixed with its kind. */
  targetText: string;
  targetAuthor: {
    userId: string | null;
    nickname: string;
    email?: string;
    isAnonymous?: boolean;
    isDeleted?: boolean;
  };
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
};

/** GET /api/admin/groups — raw Group documents, so `_id` arrives as `id`. */
export type AdminGroup = {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  category: GroupCategory;
  city?: string;
  university?: string;
  joinPolicy: 'open' | 'approval';
  memberCount: number;
  postCount: number;
  maxMembers: number;
  status: 'pending_review' | 'active' | 'rejected';
  rejectReason?: string;
  createdAt: string;
  ownerId: { id: string; nickname: string; email?: string; avatarUrl?: string; verified?: boolean } | null;
};

/** GET /api/admin/businesses — counts sit beside `data`. */
export type AdminBusinessEnvelope = {
  data: AdminBusiness[];
  counts: { pending: number; approved: number; rejected: number };
};

export type AdminBusiness = {
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
  /** False means geocoding failed, so it would carry no pin on the map. */
  hasLocation: boolean;
  source: 'google' | 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  bookmarkCount: number;
  reportCount: number;
  submittedBy: string | null;
  submitterNickname: string;
  sourceName: string;
  createdAt: string;
};

/** GET /api/admin/users */
export type AdminUsersPage = {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
};

export type AdminUser = {
  id: string;
  email: string;
  nickname: string;
  role: Role;
  /** Missing on older documents, which the API treats as active. */
  status?: 'active' | 'suspended' | 'banned' | 'deleted';
  verified?: boolean;
  university?: string;
  city?: string;
  createdAt: string;
  suspendedUntil?: string | null;
  shadowBanned?: boolean;
  warningCount?: number;
  deletedAt?: string | null;
};

export type SanctionType = 'warn' | 'suspend' | 'ban' | 'unban' | 'shadow' | 'unshadow';

/** GET /api/admin/settings — each key is written back on its own. */
export type AdminSettings = {
  maintenance: { enabled: boolean; message: string };
  bannedWords: string[];
  blockedIps: string[];
  forceUpdate: { enabled: boolean; minVersion: string };
};
