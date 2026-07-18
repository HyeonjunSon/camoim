import Constants from 'expo-constants';
import { getToken } from './storage';
import { API_BASE_URL } from './config';
import { handleResponseCode } from './systemStatus';
import { rt } from './runtimeLang';

const BASE_URL = API_BASE_URL;
const APP_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

// snake_case 객체를 재귀적으로 camelCase로 변환 (_id → id 포함)
function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        const key = k === '_id' ? 'id' : k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        return [key, toCamel(v)];
      })
    );
  }
  return obj;
}

// 공통 요청 함수 - 토큰 자동 첨부, 오류 처리 포함
async function request(method, path, body) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', 'x-app-version': APP_VERSION };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // RN Hermes는 AbortSignal.timeout 미지원 → AbortController로 수동 구현
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(rt('common.timeoutError'));
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json();

  // 응답이 실패인 경우 에러 throw
  if (!res.ok) {
    handleResponseCode(data);
    const err = new Error(data.message || rt('common.requestFailed'));
    err.code = data.code;
    err.debug = data.debug; // 디버그 정보 (서버가 제공한 경우)
    throw err;
  }

  // snake_case → camelCase 자동 변환
  return toCamel(data);
}

// 인증 API
export const register = (email, password, nickname, role, city) =>
  request('POST', '/auth/register', { email, password, nickname, role, city });
export const login = (email, password) =>
  request('POST', '/auth/login', { email, password });
export const logout = () => request('POST', '/auth/logout');
export const getMe = () => request('GET', '/auth/me');
// password (이메일 가입자) OR confirmText (소셜 전용 가입자가 닉네임 재입력)
export const deleteMyAccount = ({ password, reason, confirmText } = {}) =>
  request('DELETE', '/auth/me', { password, reason, confirmText });
export const checkNickname = (nickname) =>
  request('GET', `/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
export const sendEmailCode = (email) =>
  request('POST', '/auth/send-code', { email });

export const sendPasswordResetCode = (email) =>
  request('POST', '/auth/forgot-password', { email });

export const verifyResetCode = (email, code) =>
  request('POST', '/auth/verify-reset-code', { email, code });

export const resetPassword = (email, code, newPassword) =>
  request('POST', '/auth/reset-password', { email, code, newPassword });

// 소셜 로그인 — Apple
export const appleLogin = (identityToken) =>
  request('POST', '/auth/apple', { identityToken });

// 소셜 로그인 — Google
export const googleLogin = (idToken) =>
  request('POST', '/auth/google', { idToken });

// 소셜 가입 onboarding 완료
export const socialComplete = (preRegToken, nickname, role, city) =>
  request('POST', '/auth/social-complete', { preRegToken, nickname, role, city });
export const checkEmailCode = (email, code) =>
  request('POST', '/auth/check-code', { email, code });

// 게시판 API
export const getBoards = () => request('GET', '/boards');
export const getUniversityBoards = () => request('GET', '/boards/university');
export const getBoardPosts = (boardId, page = 1, { search, sort, city, tradeStatus } = {}) => {
  const params = new URLSearchParams({ page });
  if (search) params.append('search', search);
  if (sort) params.append('sort', sort);
  if (city) params.append('city', city);
  if (tradeStatus) params.append('tradeStatus', tradeStatus);
  return request('GET', `/boards/${boardId}/posts?${params}`);
};
// 통합 검색 — 게시글 + 모임 + 사용자
export const unifiedSearch = (q, { type = 'all', limit = 20 } = {}) => {
  const params = new URLSearchParams({ q, type, limit: String(limit) });
  return request('GET', `/search?${params}`);
};
export const createPost = (boardId, data) =>
  request('POST', '/posts', { boardId, ...data });
export const getPost = (postId) => request('GET', `/posts/${postId}`);
export const deletePost = (postId) => request('DELETE', `/posts/${postId}`);
export const pinPost = (postId, pinned) =>
  request('PUT', `/posts/${postId}/pin`, { pinned });
export const setTradeStatus = (postId, status) =>
  request('PUT', `/posts/${postId}/trade-status`, { status });
export const likePost = (postId) => request('POST', `/posts/${postId}/like`);
export const bookmarkPost = (postId) => request('POST', `/posts/${postId}/bookmark`);

// 리치 에디터용 단일 이미지 업로드 → 서버 URL 반환
// 진행률 트래킹을 위해 XHR 사용 (fetch는 upload progress 미지원)
// onProgress: (percent: 0~100) => void
function uploadWithProgress({ url, formData, token, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // RN FormData는 Content-Type을 자동 설정 (boundary 포함)
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable || !onProgress) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) resolve(toCamel(data));
        else reject(new Error(data.message || rt('common.uploadFailed')));
      } catch (e) {
        reject(new Error(rt('common.uploadFailed')));
      }
    };
    xhr.onerror = () => reject(new Error(rt('common.uploadFailed')));
    xhr.send(formData);
  });
}

export const uploadPostImage = async (asset, onProgress) => {
  const token = await getToken();
  const formData = new FormData();
  formData.append('image', {
    uri: asset.uri,
    name: asset.filename ?? `post_img_${Date.now()}.jpg`,
    type: asset.type ?? 'image/jpeg',
  });
  return uploadWithProgress({
    url: `${BASE_URL}/posts/upload-image`,
    formData,
    token,
    onProgress,
  });
};

// 아바타 업로드 → Cloudinary URL 반환
export const uploadAvatar = async (asset) => {
  const token = await getToken();
  const formData = new FormData();
  formData.append('image', {
    uri: asset.uri,
    name: asset.filename ?? `avatar_${Date.now()}.jpg`,
    type: asset.type ?? 'image/jpeg',
  });
  const res = await fetch(`${BASE_URL}/users/me/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '업로드에 실패했습니다.');
  return toCamel(data);
};

// 홈 최신 피드
export const getHomeFeed = (page = 1, city = '') =>
  request('GET', `/posts/feed?page=${page}${city ? `&city=${encodeURIComponent(city)}` : ''}`);

// 홈 인기 피드 (최근 48시간 기준)
export const getHotFeed = (page = 1, city = '') =>
  request('GET', `/posts/hot?page=${page}${city ? `&city=${encodeURIComponent(city)}` : ''}`);

// 게시판별 인기글 (인기 탭 섹션용)
export const getHotByBoard = (city = '') =>
  request('GET', `/posts/hot-by-board?limit=4${city ? `&city=${encodeURIComponent(city)}` : ''}`);

// 게시판별 최근 글 1개 (게시판 목록 미리보기용)
export const getLatestByBoard = () =>
  request('GET', '/posts/latest-by-board');

// 홈 섹션별 데이터 (자유/장터/구인 최신글)
export const getHomeSections = (city = '') =>
  request('GET', `/posts/home-sections${city ? `?city=${encodeURIComponent(city)}` : ''}`);

// 댓글 API
export const getComments = (postId) =>
  request('GET', `/posts/${postId}/comments`);
export const addComment = (postId, data) =>
  request('POST', `/posts/${postId}/comments`, data);
export const pinComment = (postId, commentId) =>
  request('PUT', `/posts/${postId}/comments/${commentId}/pin`);
export const deleteComment = (postId, commentId) =>
  request('DELETE', `/posts/${postId}/comments/${commentId}`);
export const editComment = (postId, commentId, content) =>
  request('PATCH', `/posts/${postId}/comments/${commentId}`, { content });

// 유저 API
export const getMyPosts = (page = 1) =>
  request('GET', `/users/me/posts?page=${page}`);
export const getLikedPosts = (page = 1) =>
  request('GET', `/users/me/liked-posts?page=${page}`);
export const getBookmarkedPosts = (page = 1) =>
  request('GET', `/users/me/bookmarks?page=${page}`);
export const updateProfile = (data) => request('PUT', '/users/me', data);
export const getUserProfile = (userId) => request('GET', `/users/${userId}`);

// 알림 API
export const getNotifications = () => request('GET', '/notifications');
export const getUnreadCount = () => request('GET', '/notifications/unread-count');
export const markNotificationRead = (id) =>
  request('PUT', `/notifications/${id}/read`);
export const markAllNotificationsRead = () =>
  request('PUT', '/notifications/read-all');

// 학교 리스트
export const getUniversities = () => request('GET', '/auth/universities');

// 서류 인증 신청 API (multipart/form-data)
export const applyVerify = async (formData) => {
  const token = await getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Content-Type 헤더 직접 지정하지 않음 - fetch가 boundary 자동 설정
  const res = await fetch(`${BASE_URL}/verify/apply`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청에 실패했습니다.');
  return toCamel(data);
};

// 내 인증 신청 상태 조회
export const getVerifyStatus = () => request('GET', '/verify/status');

// 신고 API
export const reportPost = (data) => request('POST', '/reports', data);

// 관리자 API
export const getAdminVerifyRequests = (status = 'pending') =>
  request('GET', `/admin/verify-requests?status=${status}`);
export const approveVerifyRequest = (id) =>
  request('PUT', `/admin/verify-requests/${id}/approve`);
export const rejectVerifyRequest = (id, adminNote = '') =>
  request('PUT', `/admin/verify-requests/${id}/reject`, { adminNote });
export const getAdminReports = (status = 'pending') =>
  request('GET', `/admin/reports?status=${status}`);
export const resolveReport = (id) =>
  request('PUT', `/admin/reports/${id}/resolve`);
export const dismissReport = (id) =>
  request('PUT', `/admin/reports/${id}/dismiss`);

// 관리자 - 유저
export const adminListUsers = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.append(k, v); });
  const s = q.toString();
  return request('GET', `/admin/users${s ? `?${s}` : ''}`);
};
export const adminGetUser = (id) => request('GET', `/admin/users/${id}`);
export const adminSanctionUser = (id, data) => request('PUT', `/admin/users/${id}/sanction`, data);
export const adminSetUserRole = (id, role) => request('PUT', `/admin/users/${id}/role`, { role });
export const adminEditUserProfile = (id, data) => request('PUT', `/admin/users/${id}/profile`, data);
export const adminDeleteUser = (id, reason = '') => request('DELETE', `/admin/users/${id}`, { reason });

// 관리자 - 콘텐츠
export const adminListPosts = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.append(k, v); });
  const s = q.toString();
  return request('GET', `/admin/posts${s ? `?${s}` : ''}`);
};
export const adminHidePost = (id, hidden, reason = '') => request('PUT', `/admin/posts/${id}/hide`, { hidden, reason });
export const adminPinPost = (id, pinned) => request('PUT', `/admin/posts/${id}/pin`, { pinned });
export const adminMovePost = (id, boardId) => request('PUT', `/admin/posts/${id}/move`, { boardId });
export const adminDeletePost = (id, reason = '') => request('DELETE', `/admin/posts/${id}`, { reason });
export const adminDeleteComment = (id) => request('DELETE', `/admin/comments/${id}`);

// 관리자 - 게시판
export const adminListBoards = () => request('GET', '/admin/boards');
export const adminCreateBoard = (data) => request('POST', '/admin/boards', data);
export const adminUpdateBoard = (id, data) => request('PUT', `/admin/boards/${id}`, data);
export const adminDeleteBoard = (id) => request('DELETE', `/admin/boards/${id}`);

export const adminListUniversities = () => request('GET', '/admin/universities');
export const adminCreateUniversity = (data) => request('POST', '/admin/universities', data);
export const adminUpdateUniversity = (id, data) => request('PUT', `/admin/universities/${id}`, data);
export const adminDeleteUniversity = (id) => request('DELETE', `/admin/universities/${id}`);
export const adminSetUniversityLeader = (userId, isLeader) =>
  request('PUT', `/admin/users/${userId}/university-leader`, { isLeader });

// 관리자 - 통계 / 시스템 / 로그 / 푸시
export const adminGetStats = () => request('GET', '/admin/stats');
export const adminGetSettings = () => request('GET', '/admin/settings');
export const adminUpdateSetting = (key, value) => request('PUT', `/admin/settings/${key}`, { value });
export const adminGetLogs = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.append(k, v); });
  const s = q.toString();
  return request('GET', `/admin/logs${s ? `?${s}` : ''}`);
};
export const adminBroadcastPush = (data) => request('POST', '/admin/push', data);

// 푸시 토큰 등록
export const registerPushToken = (pushToken) =>
  request('PUT', '/users/me/push-token', { pushToken });

// 알림 설정
export const getNotificationSettings = () =>
  request('GET', '/users/me/notifications');
export const updateNotificationSettings = (patch) =>
  request('PATCH', '/users/me/notifications', patch);

// 고객센터 / 문의
export const createInquiry = (data) => request('POST', '/inquiries', data);
export const getMyInquiries = () => request('GET', '/inquiries/me');
export const getMyInquiry = (id) => request('GET', `/inquiries/me/${id}`);
export const adminListInquiries = (type = 'all', status = 'all') => {
  const params = new URLSearchParams();
  if (type !== 'all') params.append('type', type);
  if (status !== 'all') params.append('status', status);
  const q = params.toString();
  return request('GET', `/inquiries/admin${q ? `?${q}` : ''}`);
};
export const adminAnswerInquiry = (id, answer) =>
  request('PUT', `/inquiries/admin/${id}/answer`, { answer });

// 공지사항
export const getNotices = () => request('GET', '/notices');
export const getNotice = (id) => request('GET', `/notices/${id}`);
export const createNotice = (data) => request('POST', '/notices', data);
export const updateNotice = (id, data) => request('PUT', `/notices/${id}`, data);
export const deleteNotice = (id) => request('DELETE', `/notices/${id}`);

// 채팅 상태 확인
export const checkChatStatus = (userId) =>
  request('GET', `/chats/check/${userId}`);

// DM 방 생성 or 기존 방 반환 (targetUserId와의 1:1)
export const startChat = (targetUserId) =>
  request('POST', '/chats', { targetUserId });

// 차단
export const getMyBlocks = () =>
  request('GET', '/users/me/blocks');
export const getBlockStatus = (userId) =>
  request('GET', `/users/${userId}/block-status`);
export const setBlock = (userId, { blockChat, hideContent }) =>
  request('PUT', `/users/${userId}/block`, { blockChat, hideContent });
export const unblockUser = (userId) =>
  request('DELETE', `/users/${userId}/block`);

// 모임 (Groups)
export const getGroups = ({ box = 'all', category, city, q, sort = 'popular', page = 1, university, excludeUniversity } = {}) => {
  const params = new URLSearchParams({ box, sort, page: String(page) });
  if (category) params.set('category', category);
  if (city) params.set('city', city);
  if (q) params.set('q', q);
  if (university) params.set('university', university);
  if (excludeUniversity) params.set('excludeUniversity', 'true');
  return request('GET', `/groups?${params.toString()}`);
};
export const getGroup = (groupId) => request('GET', `/groups/${groupId}`);
export const createGroup = (data) => request('POST', '/groups', data);
export const updateGroup = (groupId, data) => request('PUT', `/groups/${groupId}`, data);
export const closeGroup = (groupId) => request('DELETE', `/groups/${groupId}`);
export const joinGroup = (groupId) => request('POST', `/groups/${groupId}/join`);
export const leaveGroup = (groupId) => request('DELETE', `/groups/${groupId}/leave`);
export const getGroupMembers = (groupId, status = 'active') =>
  request('GET', `/groups/${groupId}/members?status=${status}`);
export const approveGroupMember = (groupId, userId) =>
  request('PUT', `/groups/${groupId}/members/${userId}/approve`);
export const rejectGroupMember = (groupId, userId) =>
  request('DELETE', `/groups/${groupId}/members/${userId}/reject`);
export const kickGroupMember = (groupId, userId, { ban = false, reason } = {}) =>
  request(
    'DELETE',
    `/groups/${groupId}/members/${userId}${ban ? '?ban=true' : ''}`,
    ban && reason ? { reason } : undefined
  );
export const setGroupMemberRole = (groupId, userId, role) =>
  request('PUT', `/groups/${groupId}/members/${userId}/role`, { role });
export const transferGroupOwner = (groupId, newOwnerId) =>
  request('POST', `/groups/${groupId}/transfer`, { newOwnerId });
export const setGroupNotifications = (groupId, { notifyPosts, notifyChat }) =>
  request('PUT', `/groups/${groupId}/notifications`, { notifyPosts, notifyChat });
export const updateGroupCommunity = (groupId, data) =>
  request('PUT', `/groups/${groupId}/community`, data);

// 글쓰기 임시저장 (드래프트)
export const listDrafts = () => request('GET', '/drafts');
export const createDraft = (data) => request('POST', '/drafts', data);
export const updateDraft = (id, data) => request('PUT', `/drafts/${id}`, data);
export const deleteDraft = (id) => request('DELETE', `/drafts/${id}`);
export const getGroupPosts = (groupId, { page = 1, limit = 20 } = {}) =>
  request('GET', `/groups/${groupId}/posts?page=${page}&limit=${limit}`);
export const getGroupChat = (groupId) => request('GET', `/groups/${groupId}/chat`);
export const getSchoolChat = () => request('GET', '/universities/chat');
export const getSchoolMemberCount = () => request('GET', '/universities/members/count');
export const getSchoolCommunity = () => request('GET', '/universities/community');
export const updateSchoolCommunity = (data) => request('PUT', '/universities/community', data);
export const searchSchoolMembers = (search = '', limit = 50) =>
  request('GET', `/universities/members?search=${encodeURIComponent(search)}&limit=${limit}`);
export const listSchoolMembers = (search = '') =>
  request('GET', `/universities/members?search=${encodeURIComponent(search)}&limit=200&includeSelf=true`);
export const transferSchoolLeader = (newUserId) =>
  request('PUT', '/universities/leader/transfer', { newUserId });
export const resignSchoolLeader = () => request('DELETE', '/universities/leader');

export const uploadGroupCover = async (groupId, asset) => {
  const token = await getToken();
  const form = new FormData();
  const filename = asset.uri.split('/').pop() || `cover_${Date.now()}.jpg`;
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  form.append('image', { uri: asset.uri, name: filename, type });
  const res = await fetch(`${BASE_URL}/groups/${groupId}/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return toCamel(await res.json());
};

// 관리자 — 모임 승인
export const adminGetGroups = (status = 'pending_review') =>
  request('GET', `/admin/groups?status=${encodeURIComponent(status)}`);
export const adminApproveGroup = (groupId) =>
  request('PUT', `/admin/groups/${groupId}/approve`);
export const adminRejectGroup = (groupId, reason) =>
  request('PUT', `/admin/groups/${groupId}/reject`, { reason });
export const adminCloseGroup = (groupId) =>
  request('DELETE', `/admin/groups/${groupId}`);

// 한인 업체 지도 (Businesses)
export const getBusinesses = ({ city, category, near } = {}) => {
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (category && category !== 'all') params.set('category', category);
  if (near) params.set('near', near); // "lng,lat"
  const q = params.toString();
  return request('GET', `/businesses${q ? `?${q}` : ''}`);
};
export const getBusiness = (id) => request('GET', `/businesses/${id}`);
export const createBusiness = (data) => request('POST', '/businesses', data);
export const toggleBusinessBookmark = (id) => request('POST', `/businesses/${id}/bookmark`);
export const reportBusiness = (id, reason) => request('POST', `/businesses/${id}/report`, { reason });
// 오늘 방문자 수 (공개 지표)
export const getTodayVisitors = () => request('GET', '/stats/today-visitors');
// 이번 주 인기 TOP 5 (주간 조회수 기준)
export const getTrendingBusinesses = (city) =>
  request('GET', `/businesses/trending${city ? `?city=${city}` : ''}`);
// 리뷰 — 별점(1~5) + 한줄평, 업체당 1인 1리뷰
export const getBusinessReviews = (id) => request('GET', `/businesses/${id}/reviews`);
export const upsertBusinessReview = (id, { rating, text }) =>
  request('POST', `/businesses/${id}/reviews`, { rating, text });
export const deleteBusinessReview = (id) => request('DELETE', `/businesses/${id}/reviews`);
export const reportBusinessReview = (id, reviewId) =>
  request('POST', `/businesses/${id}/reviews/${reviewId}/report`);

export const uploadBusinessImage = async (asset, onProgress) => {
  const token = await getToken();
  const formData = new FormData();
  formData.append('image', {
    uri: asset.uri,
    name: asset.filename ?? `biz_img_${Date.now()}.jpg`,
    type: asset.type ?? 'image/jpeg',
  });
  return uploadWithProgress({
    url: `${BASE_URL}/businesses/upload-image`,
    formData,
    token,
    onProgress,
  });
};

// 관리자 — 업체 승인/관리
export const adminListBusinesses = (status) =>
  request('GET', `/admin/businesses${status ? `?status=${status}` : ''}`);
export const adminUpdateBusiness = (id, data) => request('PUT', `/admin/businesses/${id}`, data);
export const adminDeleteBusiness = (id) => request('DELETE', `/admin/businesses/${id}`);
