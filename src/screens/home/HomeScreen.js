import { useState, useCallback, useEffect, useRef } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  getHotByBoard, getUnreadCount, getBoards, getHomeSections, getNotices,
} from '../../lib/api';
import { SERVER_HOST } from '../../lib/config';
import { formatTime } from '../../lib/time';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useSocket } from '../../context/SocketContext';
import { getBoardName } from '../../lib/i18n';
import CurrencyWidget from '../../components/CurrencyWidget';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 주요 캐나다 도시 목록 (city 필터용)
const CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton',
  'Ottawa', 'Winnipeg', 'Victoria', 'Halifax', 'Saskatoon',
  'London', 'Quebec',
];

// HTML/마커 제거 후 본문 미리보기
function getPreview(content) {
  if (!content) return '';
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h\d|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\u200B/g, '')
    .replace(/\[IMG:\d+\]/g, '')
    .replace(/\[\/?[BHC]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 게시판 slug별 아이콘 — 색은 테마(boardColors)에서 가져옴
const BOARD_ICONS = {
  free: '💬', anonymous: '🎭', meetup: '🤝', immigration: '🛂',
  study: '📚', workingholiday: '✈️', market: '🛍️', car: '🚗',
  giveaway: '🎁', jobs: '💼', realestate: '🏠', roomrent: '🛏️',
  exchange: '💱', university: '🎓',
};
const BOARD_BG_ALPHA = '22'; // ~13% — 라이트/다크 둘 다 자연스럽게 깔림
const buildBoardMeta = (themeColors) => (slug) => {
  const text = themeColors.boardColors?.[slug] || themeColors.boardColors?.default || themeColors.textSecondary;
  return { bg: text + BOARD_BG_ALPHA, text, icon: BOARD_ICONS[slug] || '📋' };
};

const MARKET_CARD_WIDTH = SCREEN_WIDTH * 0.42;

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();
  const { on, off, getActiveRoom } = useSocket();

  const [unreadCount, setUnreadCount] = useState(0);
  const [boards, setBoards] = useState([]);
  const [notices, setNotices] = useState([]);
  const [hotPosts, setHotPosts] = useState([]);
  const [freePosts, setFreePosts] = useState([]);
  const [marketPosts, setMarketPosts] = useState([]);
  const [jobsPosts, setJobsPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef(null);

  const loadAll = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    const myCity = user?.city || '';
    try {
      const [hotRes, boardsRes, sectionsRes, unreadRes, noticesRes] = await Promise.all([
        getHotByBoard(),
        getBoards(),
        getHomeSections(myCity),
        getUnreadCount(),
        getNotices(),
      ]);

      if (noticesRes.success) {
        setNotices((noticesRes.data ?? []).slice(0, 5));
      }

      // 인기글: 모든 게시판에서 평탄화 → hotScore 순 상위 5개
      if (hotRes.success) {
        const all = (hotRes.data ?? [])
          .flatMap(s => (s.posts ?? []).map(p => ({
            ...p, boardName: s.boardName, boardSlug: s.boardSlug,
          })))
          .sort((a, b) =>
            (b.likeCount ?? 0) * 3 + (b.commentCount ?? 0) -
            ((a.likeCount ?? 0) * 3 + (a.commentCount ?? 0))
          )
          .slice(0, 5);
        setHotPosts(all);
      }

      if (boardsRes.success) setBoards((boardsRes.data ?? []).slice(0, 8));

      if (sectionsRes.success) {
        setFreePosts(sectionsRes.data.freePosts ?? []);
        setMarketPosts(sectionsRes.data.marketPosts ?? []);
        setJobsPosts(sectionsRes.data.jobsPosts ?? []);
      }

      if (unreadRes.success) setUnreadCount(unreadRes.data.count ?? 0);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  // 실시간 채팅 알림
  useEffect(() => {
    on('chat_notification', 'home', (data) => {
      const activeRoom = getActiveRoom();
      if (activeRoom && String(activeRoom) === String(data.roomId)) return;
      setUnreadCount(prev => prev + 1);
    });
    on('messages_read', 'home', ({ readerId }) => {
      if (String(readerId) === String(user?.id)) {
        getUnreadCount().then(res => {
          if (res.success) setUnreadCount(res.data.count ?? 0);
        }).catch(() => {});
      }
    });
    return () => {
      off('chat_notification', 'home');
      off('messages_read', 'home');
    };
  }, []);

  // 배너 자동 슬라이드 (3초)
  useEffect(() => {
    if (notices.length <= 1) return;
    const timer = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % notices.length;
        bannerRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [notices.length]);

  // 게시판으로 이동
  const goToBoard = (board) => {
    navigation.navigate('BoardFeed', {
      boardId: board.id,
      boardSlug: board.slug,
      boardName: board.name,
      isUniversityBoard: !!board.isUniversityBoard,
    });
  };

  const goToBoardBySlug = (slug) => {
    const board = boards.find(b => b.slug === slug);
    if (board) goToBoard(board);
  };

  const bannerWidth = SCREEN_WIDTH - 32;

  // ── 섹션 헤더 컴포넌트
  const SectionHeader = ({ title, onPress, icon, iconColor }) => (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionTitleRow}>
        {icon && <Ionicons name={icon} size={18} color={iconColor || colors.primary} />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onPress && (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.viewAllText}>{t('home.seeMore')} ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Hot Topics 섹션
  const HotTopicsSection = () => {
    if (hotPosts.length === 0) return null;
    return (
      <View style={styles.sectionWrap}>
        <SectionHeader
          title={t('home.popular')}
          onPress={() => navigation.navigate('Board')}
        />
        <View style={styles.hotCard}>
          {hotPosts.map((p, idx) => {
            const preview = getPreview(p.content);
            return (
              <TouchableOpacity
                key={String(p.id)}
                style={[styles.hotRow, idx < hotPosts.length - 1 && styles.hotRowBorder]}
                onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
                activeOpacity={0.7}
              >
                <View style={[styles.hotRankBadge, idx < 3 ? styles.hotRankBadgeTop : styles.hotRankBadgeNormal]}>
                  <Text style={[styles.hotRankText, idx < 3 && styles.hotRankTextTop]}>
                    {String(idx + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={styles.hotContent}>
                  <Text style={styles.hotTitle} numberOfLines={1}>{p.title}</Text>
                  {preview.length > 0 && (
                    <Text style={styles.hotPreview} numberOfLines={1}>{preview}</Text>
                  )}
                  <View style={styles.hotMetaRow}>
                    <Text style={styles.hotMetaBoardTag}>{p.boardName}</Text>
                    <View style={styles.hotStats}>
                      <Ionicons name="heart" size={10} color={colors.danger} />
                      <Text style={styles.hotMetaText}>{p.likeCount ?? 0}</Text>
                      <Ionicons name="chatbubble" size={10} color={colors.textSecondary} />
                      <Text style={styles.hotMetaText}>{p.commentCount ?? 0}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── 자유게시판 최신글 섹션
  const FreePostsSection = () => {
    if (freePosts.length === 0) return null;
    return (
      <View style={styles.sectionWrap}>
        <SectionHeader
          title={t('home.freeLatest')}
          icon="clipboard-outline"
          onPress={() => goToBoardBySlug('free')}
        />
        {freePosts.map((post, idx) => {
          const preview = getPreview(post.content);
          const hasThumbnail = !!post.thumbnail;
          return (
            <TouchableOpacity
              key={String(post.id)}
              style={[styles.freeCard, idx < freePosts.length - 1 && styles.freeCardBorder]}
              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
              activeOpacity={0.7}
            >
              <View style={styles.freeCardContent}>
                <Text style={styles.freeTitle} numberOfLines={1}>{post.title}</Text>
                {preview.length > 0 && (
                  <Text style={styles.freePreview} numberOfLines={2}>{preview}</Text>
                )}
                <View style={styles.freeMetaRow}>
                  <Text style={styles.freeMeta}>{post.nickname}</Text>
                  <Text style={styles.freeMetaDot}>·</Text>
                  <Text style={styles.freeMeta}>{formatTime(post.createdAt, t)}</Text>
                  <View style={styles.freeStats}>
                    <Ionicons name="heart-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.freeStatText}>{post.likeCount ?? 0}</Text>
                    <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.freeStatText}>{post.commentCount ?? 0}</Text>
                  </View>
                </View>
              </View>
              {hasThumbnail && (
                <Image
                  source={{ uri: post.thumbnail.startsWith('http') ? post.thumbnail : `${SERVER_HOST}${post.thumbnail}` }}
                  style={styles.freeThumbnail}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                  accessibilityLabel={t('a11y.postImage')}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── 장터 하이라이트 섹션
  const MarketSection = () => {
    if (marketPosts.length === 0) return null;
    const cityLabel = user?.city ? t(`city.${user.city}`) : '';
    return (
      <View style={[styles.sectionWrap, { paddingHorizontal: 0 }]}>
        <View style={{ paddingHorizontal: 16 }}>
          <SectionHeader
            title={cityLabel ? `🛍️ ${cityLabel} ${t('home.marketLocal')}` : t('home.marketHighlight')}
            onPress={() => goToBoardBySlug('market')}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.marketScroll}
        >
          {marketPosts.map((post) => {
            const preview = getPreview(post.content);
            return (
              <TouchableOpacity
                key={String(post.id)}
                style={styles.marketCard}
                onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                activeOpacity={0.7}
              >
                {post.thumbnail ? (
                  <Image
                    source={{ uri: post.thumbnail.startsWith('http') ? post.thumbnail : `${SERVER_HOST}${post.thumbnail}` }}
                    style={styles.marketImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                    accessibilityLabel={t('a11y.postImage')}
                  />
                ) : (
                  <View style={[styles.marketImage, styles.marketImagePlaceholder]}>
                    <Text style={styles.marketImagePlaceholderIcon}>🛍️</Text>
                  </View>
                )}
                <View style={styles.marketCardBody}>
                  <Text style={styles.marketTitle} numberOfLines={2}>{post.title}</Text>
                  {preview.length > 0 && (
                    <Text style={styles.marketPreview} numberOfLines={1}>{preview}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ── 구인구직 하이라이트 섹션
  const JobsSection = () => {
    if (jobsPosts.length === 0) return null;
    const cityLabel = user?.city ? t(`city.${user.city}`) : '';
    return (
      <View style={styles.sectionWrap}>
        <SectionHeader
          title={cityLabel ? `💼 ${cityLabel} ${t('home.jobsLocal')}` : t('home.jobsHighlight')}
          onPress={() => goToBoardBySlug('jobs')}
        />
        <View style={styles.jobsCard}>
          {jobsPosts.map((post, idx) => {
            const preview = getPreview(post.content);
            return (
              <TouchableOpacity
                key={String(post.id)}
                style={[styles.jobRow, idx < jobsPosts.length - 1 && styles.jobRowBorder]}
                onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                activeOpacity={0.7}
              >
                <View style={styles.jobIconBox}>
                  <Text style={styles.jobIcon}>💼</Text>
                </View>
                <View style={styles.jobContent}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{post.title}</Text>
                  {preview.length > 0 && (
                    <Text style={styles.jobPreview} numberOfLines={1}>{preview}</Text>
                  )}
                  <Text style={styles.jobTime}>{formatTime(post.createdAt, t)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── 카테고리 칩 (수평 스크롤)
  const CategorySection = () => {
    if (boards.length === 0) return null;
    const getMeta = buildBoardMeta(colors);
    return (
      <View style={styles.sectionWrap}>
        <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>{t('home.category')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {boards.map(board => {
            const meta = getMeta(board.slug);
            return (
              <TouchableOpacity
                key={String(board.id)}
                style={styles.chip}
                onPress={() => goToBoard(board)}
                activeOpacity={0.7}
              >
                <View style={[styles.chipIconBox, { backgroundColor: meta.bg }]}>
                  <Text style={styles.chipIcon}>{meta.icon}</Text>
                </View>
                <Text style={styles.chipLabel} numberOfLines={1}>{getBoardName(board.slug, board.name, t)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ── 전체 레이아웃
  const renderContent = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.primary} />
      }
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* 공지 배너 */}
      {notices.length > 0 && (
        <View style={styles.bannerWrap}>
          <View style={styles.bannerHeader}>
            <Text style={styles.bannerHeaderText}>{t('home.notices')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notices')} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>{t('home.viewAll')} ›</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
              setBannerIndex(idx);
            }}
          >
            {notices.map(item => (
              <TouchableOpacity
                key={String(item.id)}
                style={[styles.bannerCard, { width: bannerWidth }]}
                onPress={() => navigation.navigate('NoticeDetail', { noticeId: item.id })}
                activeOpacity={0.85}
              >
                <View style={styles.bannerIconBox}>
                  <Ionicons name="megaphone" size={18} color={colors.white} />
                </View>
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.bannerSub} numberOfLines={1}>{getPreview(item.content)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.white + '80'} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {notices.length > 1 && (
            <View style={styles.bannerDots}>
              {notices.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.bannerDot, idx === bannerIndex && styles.bannerDotActive]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* 카테고리 */}
      <CategorySection />

      {/* 💱 환율 위젯 (KRW ↔ CAD) */}
      <CurrencyWidget />

      {/* 🔥 Hot Topics */}
      <HotTopicsSection />

      {/* 자유게시판 최신글 */}
      <FreePostsSection />

      {/* 🛍️ 장터 */}
      <MarketSection />

      {/* 💼 구인구직 */}
      <JobsSection />

      {/* 글이 하나도 없는 경우 */}
      {hotPosts.length === 0 && freePosts.length === 0 && marketPosts.length === 0 && jobsPosts.length === 0 && !loading && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>{t('home.noPostYet')}</Text>
          <Text style={styles.emptySubText}>{t('home.writeFirst')}</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.appName}>CaMoim</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.push('Notification')}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('a11y.notification')}
          accessibilityRole="button"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : renderContent()}
    </View>
  );
}

// ── 스타일
const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // 헤더
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  appName: { fontSize: 22, fontWeight: '800', color: colors.primary },
  headerBtn: { padding: 6, position: 'relative' },
  badge: {
    position: 'absolute', top: 2, right: 0,
    backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: colors.white },

  // 공지 배너
  bannerWrap: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  bannerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  bannerHeaderText: { fontSize: 15, fontWeight: '700', color: colors.text },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  bannerIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  bannerContent: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: colors.white },
  bannerSub: { fontSize: 11, color: colors.white + 'CC', marginTop: 2 },
  bannerDots: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 5, marginTop: 8,
  },
  bannerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.border,
  },
  bannerDotActive: {
    width: 16, borderRadius: 3,
    backgroundColor: colors.primary,
  },

  // 환영 배너 (미사용)
  welcomeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary + '10', borderRadius: 16,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4, padding: 18,
  },
  welcomeHi: { fontSize: 17, fontWeight: '700', color: colors.text },
  welcomeSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  welcomeEmoji: { fontSize: 36, marginLeft: 12 },

  // 공통 섹션
  sectionWrap: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  viewAllText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  // 🔥 Hot Topics
  hotCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  hotRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12 },
  hotRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hotRankBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
  },
  hotRankBadgeTop: { backgroundColor: colors.primary + '15' },
  hotRankBadgeNormal: { backgroundColor: colors.inputBg },
  hotRankText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  hotRankTextTop: { color: colors.primary },
  hotContent: { flex: 1 },
  hotTitle: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  hotPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  hotMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hotMetaBoardTag: {
    fontSize: 10, fontWeight: '600', color: colors.primary,
    backgroundColor: colors.primary + '10', paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  hotStats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 },
  hotMetaText: { fontSize: 10, color: colors.textSecondary, marginLeft: 2 },

  // 자유게시판 최신글
  freeCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, marginBottom: 8,
  },
  freeCardBorder: { marginBottom: 8 },
  freeCardContent: { flex: 1 },
  freeTitle: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  freePreview: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  freeMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  freeMeta: { fontSize: 11, color: colors.textSecondary },
  freeMetaDot: { fontSize: 11, color: colors.textSecondary, marginHorizontal: 3 },
  freeStats: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 3 },
  freeStatText: { fontSize: 10, color: colors.textSecondary, marginLeft: 2 },
  freeThumbnail: {
    width: 56, height: 56, borderRadius: 10, backgroundColor: colors.inputBg, marginLeft: 12,
  },

  // 🛍️ 장터 하이라이트
  marketScroll: { paddingHorizontal: 16, gap: 10 },
  marketCard: {
    width: MARKET_CARD_WIDTH, backgroundColor: colors.surface,
    borderRadius: 14, overflow: 'hidden',
  },
  marketImage: {
    width: '100%', height: MARKET_CARD_WIDTH * 0.75,
    backgroundColor: colors.inputBg,
  },
  marketImagePlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  marketImagePlaceholderIcon: { fontSize: 32 },
  marketCardBody: { padding: 10 },
  marketTitle: { fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 18 },
  marketPreview: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },

  // 💼 구인구직
  jobsCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  jobRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  jobRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  jobIconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.successSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  jobIcon: { fontSize: 18 },
  jobContent: { flex: 1 },
  jobTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  jobPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  jobTime: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },

  // 카테고리 칩
  chipsRow: { gap: 10, paddingRight: 16 },
  chip: { alignItems: 'center', width: 70 },
  chipIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  chipIcon: { fontSize: 22 },
  chipLabel: { fontSize: 11, color: colors.text, fontWeight: '600', textAlign: 'center' },

  // 빈 상태
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },

});
