import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getBoardPosts } from '../../lib/api';
import PostCard from '../../components/PostCard';
import CustomHeader from '../../components/CustomHeader';
import { useLang } from '../../context/LangContext';
import { isTradeBoard, getTradeLabel } from '../../constants/boards';

const SORT_OPTIONS = [
  { key: 'latest', icon: 'time-outline' },
  { key: 'popular', icon: 'heart-outline' },
  { key: 'comments', icon: 'chatbubble-outline' },
];

// Local boards: the slugs that show a city filter
const LOCAL_BOARD_SLUGS = ['market', 'jobs', 'roomrent', 'car', 'giveaway', 'realestate', 'meetup'];

import { CITIES } from '../../constants/cities';


export default function BoardFeedScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { boardId, boardName, boardSlug } = route.params ?? {};
  const { t } = useLang();

  // Whether this is a local board
  const isLocalBoard = LOCAL_BOARD_SLUGS.includes(boardSlug);
  // City filter, defaulting to "all"
  const [cityFilter, setCityFilter] = useState('');

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);
  const isFirstFocusRef = useRef(true);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const searchInputRef = useRef(null);
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Sort state
  const [sortBy, setSortBy] = useState('latest');
  // Trade status filter (marketplace boards) — all | selling | sold
  const [tradeFilter, setTradeFilter] = useState('all');
  const showTradeFilter = isTradeBoard(boardSlug);

  // Uses CustomHeader, matching the boards, groups and chat screens
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const toggleSearch = () => {
    if (searchOpen) {
      // Close search
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      setSearchOpen(false);
      setSearchText('');
      if (activeSearch) {
        setActiveSearch('');
        loadPosts(1, true, '', sortBy);
      }
    } else {
      // Open search
      setSearchOpen(true);
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        searchInputRef.current?.focus();
      });
    }
  };

  const handleSearch = () => {
    const q = searchText.trim();
    setActiveSearch(q);
    loadPosts(1, true, q, sortBy);
  };

  const handleSortChange = (newSort) => {
    if (newSort === sortBy) return;
    setSortBy(newSort);
    loadPosts(1, true, activeSearch, newSort);
  };

  const handleTradeFilterChange = (next) => {
    if (next === tradeFilter) return;
    setTradeFilter(next);
    loadPosts(1, true, activeSearch, sortBy, cityFilter, next);
  };

  // On first load and whenever the city filter changes
  useEffect(() => {
    loadPosts(1, true, '', 'latest', cityFilter);
  }, [boardId, cityFilter]);

  // Auto-refresh on returning from the compose screen
  useEffect(() => {
    isFirstFocusRef.current = true;
    const unsubscribe = navigation.addListener('focus', () => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      loadPosts(1, true, activeSearch, sortBy);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation, boardId]);

  async function loadPosts(targetPage, reset = false, search = activeSearch, sort = sortBy, city = cityFilter, trade = tradeFilter) {
    if (reset) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await getBoardPosts(boardId, targetPage, {
        search: search || undefined,
        sort: sort !== 'latest' ? sort : undefined,
        city: city || undefined,
        tradeStatus: trade !== 'all' ? trade : undefined,
      });
      if (result.success) {
        const newPosts = result.data.posts ?? [];
        setPosts(reset ? newPosts : (prev) => [...prev, ...newPosts]);
        setTotal(result.data.total ?? 0);
        setPage(targetPage);
      } else {
        if (reset) setError(t('common.serverError'));
      }
    } catch (e) {
      if (reset) setError(e.message || t('common.serverError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts(1, true);
  }, [boardId, activeSearch, sortBy]);

  function onEndReached() {
    if (loadingMore || loading) return;
    if (posts.length >= total) return;
    setLoadingMore(true);
    loadPosts(page + 1, false);
  }

  function renderItem({ item }) {
    return (
      <PostCard
        post={item}
        onPress={() => navigation.navigate('BoardPostDetail', { postId: item.id })}
      />
    );
  }

  function renderFooter() {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={activeSearch ? 'search-outline' : 'document-text-outline'} size={40} color={colors.textSecondary} />
        <Text style={styles.emptyText}>
          {activeSearch ? t('search.noResult') : t('home.noPostYet')}
        </Text>
        {!activeSearch && <Text style={styles.emptySubText}>{t('home.writeFirst')}</Text>}
      </View>
    );
  }

  // Search bar height animation
  const searchBarHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  const handleCityChange = (city) => {
    setCityFilter(city);
  };

  // Sort chips + city filter (used as the FlatList header)
  const renderSortHeader = () => (
    <View>
      {/* City filter (local boards only) */}
      {isLocalBoard && (
        <View style={styles.cityFilterRow}>
          <Ionicons name="location" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              style={[styles.cityChip, !cityFilter && styles.cityChipActive]}
              onPress={() => handleCityChange('')}
              activeOpacity={0.7}
            >
              <Text style={[styles.cityChipText, !cityFilter && styles.cityChipTextActive]}>
                {t('home.regionAll')}
              </Text>
            </TouchableOpacity>
            {CITIES.map(city => (
              <TouchableOpacity
                key={city}
                style={[styles.cityChip, cityFilter === city && styles.cityChipActive]}
                onPress={() => handleCityChange(city)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cityChipText, cityFilter === city && styles.cityChipTextActive]}>
                  {t(`city.${city}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter row — (trade status |) sort, on one line */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {showTradeFilter && (
          <>
            {[
              { key: 'all', label: t('board.tradeAll') },
              { key: 'selling', label: getTradeLabel(boardSlug, 'selling', t) },
              { key: 'sold', label: getTradeLabel(boardSlug, 'sold', t) },
            ].map(opt => {
              const active = tradeFilter === opt.key;
              return (
                <TouchableOpacity
                  key={`trade-${opt.key}`}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                  onPress={() => handleTradeFilterChange(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.filterDivider} />
          </>
        )}

        {SORT_OPTIONS.map(opt => {
          const active = sortBy === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, active && styles.sortChipActive]}
              onPress={() => handleSortChange(opt.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={opt.icon} size={13} color={active ? colors.white : colors.textSecondary} />
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                {t(`board.sort_${opt.key}`) || opt.key}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Searching indicator */}
        {activeSearch ? (
          <View style={styles.searchTag}>
            <Text style={styles.searchTagText} numberOfLines={1}>"{activeSearch}"</Text>
            <TouchableOpacity onPress={() => { setActiveSearch(''); setSearchText(''); loadPosts(1, true, '', sortBy); }}>
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );

  if (loading && posts.length === 0 && !searchOpen) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadPosts(1, true)}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        navigation={navigation}
        title={boardName || ''}
        rightActions={[
          {
            icon: searchOpen ? 'close' : 'search',
            onPress: toggleSearch,
            label: searchOpen ? t('a11y.close') : t('a11y.search'),
          },
        ]}
      />
      {/* Search bar — pinned outside the FlatList so focus survives */}
      <Animated.View style={[styles.searchBarWrap, { height: searchBarHeight, opacity: searchAnim }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); searchInputRef.current?.focus(); }}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderSortHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Floating compose button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost', { boardId, boardSlug, boardName })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  listContent: { paddingBottom: 8 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40, gap: 8 },
  emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: colors.textSecondary },
  errorText: { fontSize: 14, color: colors.danger, marginBottom: 12 },
  retryBtn: {
    backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10,
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Search bar
  searchBarWrap: {
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },

  // Divider between trade status and sort
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: 6,
    alignSelf: 'center',
  },

  // Sort chips
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: colors.white,
  },

  // Search tag
  searchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    maxWidth: 140,
  },
  searchTagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },

  // City filter
  cityFilterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  cityChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.inputBg,
  },
  cityChipActive: {
    backgroundColor: colors.primary,
  },
  cityChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  cityChipTextActive: { color: colors.white },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: { color: colors.white, fontSize: 28, fontWeight: '400', lineHeight: 30 },
});
