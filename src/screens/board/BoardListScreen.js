import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
  RefreshControl,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getBoards, getLatestByBoard } from '../../lib/api';
import { formatTime } from '../../lib/time';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getBoardName } from '../../lib/i18n';
import { toShortUniversityName } from '../../lib/university';
import { BOARD_ICONS } from '../../lib/icons';
import GroupListScreen from '../group/GroupListScreen';

const PINNED_KEY = '@camoim_pinned_boards';

// Colour and icon per board slug — derived from the single source in lib/icons.js (the soft background is a tint of the icon colour)
const metaFor = (slug) => {
  const ic = BOARD_ICONS[slug] || BOARD_ICONS.default;
  return { bg: ic.color + '1A', text: ic.color, ion: ic.ion };
};

// Filter definitions (slug-based) — labels via t()
const FILTER_DEFS = [
  { key: 'all',       labelKey: 'board.filterAll' },
  { key: 'pinned',    labelKey: 'board.filterPinned' },
  { key: 'community', labelKey: 'board.filterCommunity', slugs: ['free', 'anonymous', 'meetup'] },
  { key: 'qna',       labelKey: 'board.filterQna',       slugs: ['immigration', 'study', 'workingholiday'] },
  { key: 'market',    labelKey: 'board.filterMarket',    slugs: ['market', 'car', 'giveaway'] },
  { key: 'life',      labelKey: 'board.filterLife',      slugs: ['jobs', 'realestate', 'roomrent', 'exchange'] },
];

export default function BoardListScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { user } = useAuth();
  const { t } = useLang();
  const FILTERS = FILTER_DEFS.map(f => ({ ...f, label: t(f.labelKey) }));
  const [mode, setMode] = useState('boards'); // boards | groups
  const [boards, setBoards] = useState([]);
  const [latestMap, setLatestMap] = useState({});
  const [pinned, setPinned] = useState([]); // pinned board IDs
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [writeModalVisible, setWriteModalVisible] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const hasSchoolAccess = isAdmin || (isStudent && user?.verified === true && !!user?.university);
  const showVerifyCard = isStudent && !hasSchoolAccess;

  // ── Load and save pins
  const loadPinned = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PINNED_KEY);
      if (raw) setPinned(JSON.parse(raw));
    } catch {}
  }, []);

  const togglePin = async (boardId) => {
    const id = String(boardId);
    const next = pinned.includes(id)
      ? pinned.filter(x => x !== id)
      : [...pinned, id];
    setPinned(next);
    try { await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(next)); } catch {}
  };

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [boardsRes, latestRes] = await Promise.all([
        getBoards(),
        getLatestByBoard(),
      ]);
      if (boardsRes.success) setBoards(boardsRes.data ?? []);
      else setError(t('common.serverError'));

      if (latestRes.success) {
        const map = {};
        (latestRes.data ?? []).forEach(item => {
          map[String(item.boardId)] = item.latest;
        });
        setLatestMap(map);
      }
    } catch {
      setError(t('common.serverError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchAll();
    loadPinned();
  }, [fetchAll, loadPinned]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  // 'intro' has its own entry point (the home screen's category row) and its own screen/FAB,
  // so it's left out of this generic board list entirely
  const generalBoards = boards.filter(b => !b.isUniversityBoard && b.slug !== 'intro');

  // Compute the filtered board list
  const getFilteredBoards = () => {
    if (filter === 'all') return generalBoards;
    if (filter === 'pinned') return generalBoards.filter(b => pinned.includes(String(b.id)));
    const f = FILTERS.find(x => x.key === filter);
    return generalBoards.filter(b => f?.slugs?.includes(b.slug));
  };

  const filteredBoards = getFilteredBoards();
  // Under the 'all' filter, pinned entries sort first
  const sortedBoards = filter === 'all'
    ? [...filteredBoards].sort((a, b) => {
        const ap = pinned.includes(String(a.id));
        const bp = pinned.includes(String(b.id));
        if (ap && !bp) return -1;
        if (!ap && bp) return 1;
        return 0;
      })
    : filteredBoards;

  function goToBoard(item) {
    navigation.navigate('BoardFeed', {
      boardId: item.id,
      boardSlug: item.slug,
      boardName: getBoardName(item.slug, item.name, t),
      isUniversityBoard: false,
    });
  }

  function handleWriteSelect(board) {
    setWriteModalVisible(false);
    navigation.navigate('CreatePost', { boardId: board.id, boardSlug: board.slug, boardName: getBoardName(board.slug, board.name, t) });
  }

  // ── Compact board row
  function renderBoardRow(board) {
    const meta = metaFor(board.slug);
    const latest = latestMap[String(board.id)];
    const isPinned = pinned.includes(String(board.id));

    return (
      <TouchableOpacity
        key={String(board.id)}
        style={styles.row}
        onPress={() => goToBoard(board)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.ion} size={20} color={meta.text} />
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTopLine}>
            <Text style={styles.boardName} numberOfLines={1}>{getBoardName(board.slug, board.name, t)}</Text>
            {latest && <Text style={styles.rowTime}>{formatTime(latest.createdAt, t)}</Text>}
          </View>
          <Text style={styles.rowPreview} numberOfLines={1}>
            {latest ? latest.title : t('board.noPost')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.pinBtn}
          onPress={() => togglePin(board.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isPinned ? 'star' : 'star-outline'}
            size={20}
            color={isPinned ? '#F59E0B' : colors.textSecondary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // Compact school community banner (a premium-card feel)
  const SchoolBanner = () => {
    const uniShort = isAdmin ? t('board.schoolAll') : (toShortUniversityName(user?.university) || t('mypage.school'));
    const subText = isAdmin ? t('board.schoolBoardAdmin') : `Community · ${t('board.forStudents')}`;
    return (
      <TouchableOpacity onPress={() => navigation.navigate('UniversityBoard')} activeOpacity={0.85}>
        <LinearGradient
          colors={[colors.primary, colors.primary + 'D0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.schoolBanner}
        >
          {/* Top highlight line (glass sheen) */}
          <View style={styles.schoolBannerShine} pointerEvents="none" />
          <View style={styles.schoolIconBadge}>
            <Ionicons name={isAdmin ? 'shield' : 'school'} size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.schoolTitleRow}>
              <Text style={styles.schoolTitleLarge} numberOfLines={1} ellipsizeMode="tail">
                {uniShort}
              </Text>
              {!isAdmin && (
                <Ionicons name="checkmark-circle" size={14} color="#FFD66B" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.schoolSub} numberOfLines={1} ellipsizeMode="tail">
              {subText}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.white + 'CC'} />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
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
        <TouchableOpacity style={styles.retryBtn} onPress={fetchAll}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── The [Boards | Groups] toggle at the top
  const ModeToggle = () => (
    <View style={styles.modeToggleBar}>
      <TouchableOpacity
        style={[styles.modeBtn, mode === 'boards' && styles.modeBtnActive]}
        onPress={() => setMode('boards')}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'boards' }}
      >
        <Text style={[styles.modeText, mode === 'boards' && styles.modeTextActive]}>
          {t('board.tabBoards')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modeBtn, mode === 'groups' && styles.modeBtnActive]}
        onPress={() => setMode('groups')}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'groups' }}
      >
        <Text style={[styles.modeText, mode === 'groups' && styles.modeTextActive]}>
          {t('board.tabGroups')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (mode === 'groups') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ModeToggle />
        <GroupListScreen navigation={navigation} embedded />
      </View>
    );
  }

  return (
    <>
      <ModeToggle />
      {/* ── Filter chips (pinned header) */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* School community — verified students get the banner, unverified ones get the verification card */}
        {filter === 'all' && hasSchoolAccess && (
          <View style={{ paddingHorizontal: 14, marginTop: 14 }}>
            <SchoolBanner />
          </View>
        )}
        {filter === 'all' && showVerifyCard && (
          <View style={{ paddingHorizontal: 14, marginTop: 14 }}>
            <View style={styles.verifyCard}>
              <View style={styles.verifyRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name={BOARD_ICONS.university.ion} size={15} color={BOARD_ICONS.university.color} />
                    <Text style={styles.verifyCardTitle}>{t('board.verifyTitle')}</Text>
                  </View>
                  <Text style={styles.verifyCardDesc}>{t('board.verifyDesc')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={() => navigation.navigate('VerifyStudent')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.verifyBtnText}>{t('board.verifyBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Board list (compact card groups) */}
        {sortedBoards.length > 0 ? (
          <View style={styles.listCard}>
            {sortedBoards.map((board, idx) => (
              <View key={String(board.id)}>
                {renderBoardRow(board)}
                {idx < sortedBoards.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons
              name={filter === 'pinned' ? 'star-outline' : 'mail-open-outline'}
              size={36}
              color={colors.textSecondary}
              style={{ marginBottom: 4 }}
            />
            <Text style={styles.emptyText}>
              {filter === 'pinned' ? t('board.pinnedEmpty') : t('board.empty')}
            </Text>
            {filter === 'pinned' && (
              <Text style={styles.emptySub}>{t('board.pinHint')}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating compose */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setWriteModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={22} color={colors.white} />
      </TouchableOpacity>

      {/* Board picker modal */}
      <Modal
        visible={writeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWriteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayBg}
            activeOpacity={1}
            onPress={() => setWriteModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('board.writeWhere')}</Text>
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {generalBoards.map((board, idx) => {
                const meta = metaFor(board.slug);
                return (
                  <TouchableOpacity
                    key={String(board.id)}
                    style={[styles.modalRow, idx < generalBoards.length - 1 && styles.modalRowBorder]}
                    onPress={() => handleWriteSelect(board)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalIconBox, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.ion} size={21} color={meta.text} />
                    </View>
                    <Text style={styles.modalBoardName}>{getBoardName(board.slug, board.name, t)}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setWriteModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 100, paddingTop: 4 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // ── Boards/groups toggle
  modeToggleBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.white,
  },

  // ── Filter chips
  filterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  chipTextActive: {
    color: colors.white,
  },

  // ── School community banner (premium)
  schoolBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  schoolBannerShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  schoolIconBadge: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolTitleLarge: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  schoolSub: { fontSize: 11, color: colors.white + 'B8', marginTop: 1, fontWeight: '500' },

  // ── Verification prompt card
  verifyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifyCardTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 2 },
  verifyCardDesc:  { fontSize: 12, color: colors.textSecondary },
  verifyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  // ── Compact list card
  listCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },

  // ── Compact row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowTime: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  rowPreview: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pinBtn: {
    padding: 4,
  },

  // ── Empty state
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 6,
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 12, color: colors.textSecondary },

  // ── Error
  errorText: { fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
  retryBtn:  { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary },
  retryText: { color: colors.white, fontWeight: '600', fontSize: 14 },

  // ── Floating compose
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },

  // ── Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '70%',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 20, marginBottom: 8,
  },
  modalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
  },
  modalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  modalIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBoardName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  modalCancel: {
    marginTop: 8, marginHorizontal: 20,
    paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
