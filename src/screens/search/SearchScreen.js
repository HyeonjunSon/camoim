import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  TouchableOpacity,
  View,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SERVER_HOST } from '../../lib/config';
import { getBoards, unifiedSearch } from '../../lib/api';
import { track } from '../../lib/analytics';
import { formatTime } from '../../lib/time';
import { useLang } from '../../context/LangContext';

const RECENT_SEARCHES_KEY = '@camoim_recent_searches';
const MAX_RECENT_SEARCHES = 8;

// 인기 급상승 목 데이터 (i18n 키 참조)
const TRENDING_KEYS = [
  { id: 1, key: 'searchScreen.t1', trend: 'up' },
  { id: 2, key: 'searchScreen.t2', trend: 'up' },
  { id: 3, key: 'searchScreen.t3', trend: 'same' },
  { id: 4, key: 'searchScreen.t4', trend: 'up' },
  { id: 5, key: 'searchScreen.t5', trend: 'down' },
  { id: 6, key: 'searchScreen.t6', trend: 'up' },
  { id: 7, key: 'searchScreen.t7', trend: 'same' },
  { id: 8, key: 'searchScreen.t8', trend: 'down' },
];

// 추천 게시판 (slug + 카테고리 색상, i18n 키 참조)
const RECOMMENDED_BOARD_SLUGS = [
  { slug: 'free',      nameKey: 'searchScreen.recFree',   icon: 'chatbubbles', accent: '#6366F1', descKey: 'searchScreen.recFreeDesc' },
  { slug: 'anonymous', nameKey: 'searchScreen.recAnon',   icon: 'eye-off',     accent: '#8B5CF6', descKey: 'searchScreen.recAnonDesc' },
  { slug: 'market',    nameKey: 'searchScreen.recMarket', icon: 'pricetag',    accent: '#10B981', descKey: 'searchScreen.recMarketDesc' },
  { slug: 'jobs',      nameKey: 'searchScreen.recJobs',   icon: 'briefcase',   accent: '#F59E0B', descKey: 'searchScreen.recJobsDesc' },
];

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useLang();

  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [results, setResults] = useState({ posts: [], groups: [], users: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendedBoards, setRecommendedBoards] = useState([]);
  const [searchTab, setSearchTab] = useState('all'); // all | posts | groups | users

  const trendingTime = useRef(
    (() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    })()
  ).current;

  useEffect(() => {
    loadRecentSearches();
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const res = await getBoards();
      const boards = res?.data ?? [];
      const mapped = RECOMMENDED_BOARD_SLUGS.map(rec => {
        const found = boards.find(b => b.slug === rec.slug);
        return { ...rec, boardId: found?.id ?? null };
      }).filter(b => b.boardId);
      setRecommendedBoards(mapped);
    } catch {}
  };

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  };

  const saveRecentSearch = async (keyword) => {
    try {
      const filtered = recentSearches.filter((k) => k !== keyword);
      const updated = [keyword, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const deleteRecentSearch = async (keyword) => {
    try {
      const updated = recentSearches.filter((k) => k !== keyword);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearAllRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  const handleSearch = useCallback(
    async (searchQuery) => {
      const trimmed = (searchQuery || query).trim();
      if (!trimmed) return;

      setIsSearching(true);
      setLoading(true);
      setResults({ posts: [], groups: [], users: [] });
      await saveRecentSearch(trimmed);
      track('search_submit', { length: trimmed.length });

      try {
        const res = await unifiedSearch(trimmed, { type: 'all' });
        if (res.success) {
          setResults(res.data ?? { posts: [], groups: [], users: [] });
        }
      } catch {
        setResults({ posts: [], groups: [], users: [] });
      } finally {
        setLoading(false);
      }
    },
    [query, recentSearches]
  );

  const handleQueryChange = (text) => {
    setQuery(text);
    if (!text.trim()) {
      setIsSearching(false);
      setResults({ posts: [], groups: [], users: [] });
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsSearching(false);
    setResults({ posts: [], groups: [], users: [] });
    setSearchTab('all');
  };

  const handleKeywordTap = (keyword) => {
    setQuery(keyword);
    handleSearch(keyword);
  };

  const handleBoardTap = (boardId, boardName) => {
    navigation.navigate('Board', {
      screen: 'BoardFeed',
      params: { boardId, boardName, isUniversityBoard: false },
    });
  };

  const handlePostTap = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  const handleGroupTap = (groupId) => {
    navigation.navigate('Board', { screen: 'GroupDetail', params: { groupId } });
  };

  const handleUserTap = (userId) => {
    navigation.navigate('UserProfile', { userId });
  };

  // 결과 탭에 들어갈 데이터 (검색 후만 사용)
  const currentTabData = (() => {
    if (searchTab === 'posts') return results.posts;
    if (searchTab === 'groups') return results.groups;
    if (searchTab === 'users') return results.users;
    // all: 묶어서 (타입 표시 위해 _kind 첨가)
    return [
      ...(results.groups || []).map(g => ({ ...g, _kind: 'group' })),
      ...(results.users || []).map(u => ({ ...u, _kind: 'user' })),
      ...(results.posts || []).map(p => ({ ...p, _kind: 'post' })),
    ];
  })();

  const totalCount = (results.posts?.length ?? 0) + (results.groups?.length ?? 0) + (results.users?.length ?? 0);

  // 트렌드 화살표
  const TrendArrow = ({ trend }) => {
    if (trend === 'up') return <Ionicons name="caret-up" size={12} color="#EF4444" />;
    if (trend === 'down') return <Ionicons name="caret-down" size={12} color="#3B82F6" />;
    return <Text style={styles.trendSame}>–</Text>;
  };

  // 모임 카드
  const GroupCard = ({ item, onPress }) => {
    const hasThumb = !!item.coverImage;
    return (
      <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.resultIconWrap}>
          {hasThumb ? (
            <Image source={{ uri: item.coverImage }} style={styles.resultIcon} />
          ) : (
            <View style={[styles.resultIcon, styles.resultIconPlaceholder]}>
              <Ionicons name="people" size={20} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.resultBody}>
          <View style={styles.resultTopRow}>
            <Text style={styles.resultKindBadge}>{t('search.kindGroup')}</Text>
            {!!item.university && <Text style={styles.resultMetaSmall}>🎓 {item.university}</Text>}
          </View>
          <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
          {!!item.description && (
            <Text style={styles.resultDesc} numberOfLines={1}>{item.description}</Text>
          )}
          <Text style={styles.resultMetaSmall}>👥 {item.memberCount}{!!item.city ? ` · ${item.city}` : ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 사용자 카드
  const UserCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultIconWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.resultIcon} />
        ) : (
          <View style={[styles.resultIcon, styles.resultIconPlaceholder]}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultKindBadge}>{t('search.kindUser')}</Text>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.nickname}{item.verified ? ' ✓' : ''}
        </Text>
        {!!item.university && <Text style={styles.resultDesc} numberOfLines={1}>🎓 {item.university}</Text>}
      </View>
    </TouchableOpacity>
  );

  // 검색 결과 카드
  const PostCard = ({ item, onPress }) => {
    const hasThumb = !!item.thumbnail;
    const thumbUri = hasThumb
      ? (item.thumbnail.startsWith('http') ? item.thumbnail : `${SERVER_HOST}${item.thumbnail}`)
      : null;
    return (
      <TouchableOpacity style={styles.postCard} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.postMeta}>
          <Text style={styles.postBoardName}>{item.boardName || t('home.boardFallback')}</Text>
          <Text style={styles.postMetaDot}>·</Text>
          <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
        </View>
        <View style={styles.postCardBody}>
          <View style={[styles.postCardText, hasThumb && { flex: 1, marginRight: 10 }]}>
            <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          </View>
          {hasThumb && (
            <Image source={{ uri: thumbUri }} style={styles.postThumb} resizeMode="cover" />
          )}
        </View>
        <View style={styles.postFooter}>
          <Text style={styles.postNickname}>{item.nickname || t('common.anonymous')}</Text>
          <View style={styles.postCounts}>
            <View style={styles.countItem}>
              <Ionicons name="heart-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.postCountText}>{item.likeCount ?? 0}</Text>
            </View>
            <View style={styles.countItem}>
              <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.postCountText}>{item.commentCount ?? 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyResults = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>{t('search.noResult')}</Text>
        <Text style={styles.emptySubText}>{t('search.noResultSub')}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero 헤더 + 검색바 */}
      <View style={styles.hero}>
        {!isSearching && (
          <Text style={styles.heroTitle}>{t('search.title')}</Text>
        )}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={() => handleSearch()}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t('search.searching')}</Text>
          </View>
        ) : (
          <>
            {/* 결과 카테고리 탭 */}
            <View style={styles.tabRow}>
              {[
                { key: 'all', label: t('search.tabAll'), count: totalCount },
                { key: 'posts', label: t('search.tabPosts'), count: results.posts?.length ?? 0 },
                { key: 'groups', label: t('search.tabGroups'), count: results.groups?.length ?? 0 },
                { key: 'users', label: t('search.tabUsers'), count: results.users?.length ?? 0 },
              ].map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, searchTab === tab.key && styles.tabBtnActive]}
                  onPress={() => setSearchTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, searchTab === tab.key && styles.tabTextActive]}>
                    {tab.label}{tab.count > 0 ? ` ${tab.count}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={currentTabData}
              keyExtractor={(item, idx) => `${item._kind || searchTab}_${item.id || idx}`}
              renderItem={({ item }) => {
                const kind = item._kind || searchTab;
                if (kind === 'group' || kind === 'groups') {
                  return <GroupCard item={item} onPress={() => handleGroupTap(item.id)} />;
                }
                if (kind === 'user' || kind === 'users') {
                  return <UserCard item={item} onPress={() => handleUserTap(item.id)} />;
                }
                return <PostCard item={item} onPress={() => handlePostTap(item.id)} />;
              }}
              ListEmptyComponent={renderEmptyResults}
              contentContainerStyle={
                currentTabData.length === 0 ? styles.flatListEmpty : styles.flatListContent
              }
              refreshControl={<RefreshControl refreshing={loading} onRefresh={() => handleSearch()} />}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          </>
        )
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {/* 최근 검색 */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('search.recent')}</Text>
                <TouchableOpacity onPress={clearAllRecentSearches} activeOpacity={0.7}>
                  <Text style={styles.linkText}>{t('search.clearAll')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipRow}>
                {recentSearches.map((keyword) => (
                  <View key={keyword} style={styles.chip}>
                    <TouchableOpacity
                      onPress={() => handleKeywordTap(keyword)}
                      activeOpacity={0.7}
                      style={styles.chipMain}
                    >
                      <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.chipText}>{keyword}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteRecentSearch(keyword)}
                      activeOpacity={0.7}
                      hitSlop={6}
                      style={styles.chipDelete}
                    >
                      <Ionicons name="close" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 실시간 인기 검색어 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.sectionTitle}>{t('search.trending')}</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.timeText}>{trendingTime}</Text>
            </View>

            <View style={styles.trendingCard}>
              {TRENDING_KEYS.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.trendingItem, idx === TRENDING_KEYS.length - 1 && styles.trendingItemLast]}
                  onPress={() => handleKeywordTap(t(item.key))}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.trendingRank, idx < 3 && styles.trendingRankTop]}>
                    {String(item.id).padStart(2, '0')}
                  </Text>
                  <Text style={styles.trendingKeyword} numberOfLines={1}>
                    {t(item.key)}
                  </Text>
                  <TrendArrow trend={item.trend} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 추천 게시판 (큰 컬러 카드) */}
          {recommendedBoards.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('search.recommendedBoard')}</Text>
              </View>
              <View style={styles.boardGrid}>
                {recommendedBoards.map((board) => (
                  <TouchableOpacity
                    key={board.boardId}
                    style={styles.boardCard}
                    onPress={() => handleBoardTap(board.boardId, t(board.nameKey))}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.boardIconWrap, { backgroundColor: board.accent + '18' }]}>
                      <Ionicons name={board.icon} size={22} color={board.accent} />
                    </View>
                    <Text style={styles.boardName} numberOfLines={1}>{t(board.nameKey)}</Text>
                    <Text style={styles.boardDescription} numberOfLines={1}>
                      {t(board.descKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 14, letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14,
    paddingHorizontal: 14, height: 48,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1, borderColor: colors.border + '40',
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  // 로딩/빈 상태
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  flatListEmpty: { flexGrow: 1 },
  flatListContent: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 15, color: colors.text, fontWeight: '700', marginTop: 8 },
  emptySubText: { fontSize: 13, color: colors.textSecondary },

  // Section
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  timeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  // 최근 검색 칩
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20, paddingLeft: 10, paddingRight: 4, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border + '40',
  },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  chipDelete: { marginLeft: 4, padding: 4 },

  // LIVE 배지
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EF4444' + '15',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#EF4444', letterSpacing: 0.6 },

  // 트렌딩 카드
  trendingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border + '40',
  },
  trendingItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border + '40',
  },
  trendingItemLast: { borderBottomWidth: 0 },
  trendingRank: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, width: 22 },
  trendingRankTop: { color: colors.primary, fontWeight: '800' },
  trendingKeyword: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  trendSame: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },

  // 추천 게시판 카드
  boardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  boardCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border + '40',
  },
  boardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  boardName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  boardDescription: { fontSize: 12, color: colors.textSecondary },

  // 결과 카테고리 탭
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 6, paddingBottom: 10, paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.white },

  // 통합 카드 (Group / User 공용)
  resultCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border + '40',
  },
  resultIconWrap: { width: 48, height: 48 },
  resultIcon: { width: 48, height: 48, borderRadius: 12 },
  resultIconPlaceholder: {
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  resultBody: { flex: 1, minWidth: 0 },
  resultTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  resultKindBadge: {
    fontSize: 10, fontWeight: '800', color: colors.primary,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  resultTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  resultDesc: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  resultMetaSmall: { fontSize: 11, color: colors.textSecondary },

  // 검색 결과 카드
  postCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border + '40',
  },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  postBoardName: { fontSize: 11, fontWeight: '700', color: colors.primary },
  postMetaDot: { fontSize: 11, color: colors.textSecondary },
  postTime: { fontSize: 11, color: colors.textSecondary },
  postCardBody: { flexDirection: 'row' },
  postCardText: { flex: 1 },
  postThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.inputBg },
  postTitle: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 22 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  postNickname: { fontSize: 12, color: colors.textSecondary },
  postCounts: { flexDirection: 'row', gap: 12 },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postCountText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});
