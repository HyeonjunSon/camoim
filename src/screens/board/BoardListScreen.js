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
import { Ionicons } from '@expo/vector-icons';
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
import GroupListScreen from '../group/GroupListScreen';

const PINNED_KEY = '@camoim_pinned_boards';

// 게시판 slug별 색·아이콘
const BOARD_META = {
  free:           { bg: '#EEF2FF', text: '#6366F1', icon: '💬' },
  anonymous:      { bg: '#F5F3FF', text: '#8B5CF6', icon: '🎭' },
  meetup:         { bg: '#FFF4ED', text: '#FB923C', icon: '🤝' },
  immigration:    { bg: '#ECFEFF', text: '#0891B2', icon: '🛂' },
  study:          { bg: '#EFF6FF', text: '#3B82F6', icon: '📚' },
  workingholiday: { bg: '#FEF3C7', text: '#D97706', icon: '✈️' },
  market:         { bg: '#FFF7ED', text: '#F97316', icon: '🛍️' },
  car:            { bg: '#F1F5F9', text: '#475569', icon: '🚗' },
  giveaway:       { bg: '#ECFDF5', text: '#10B981', icon: '🎁' },
  jobs:           { bg: '#ECFDF5', text: '#10B981', icon: '💼' },
  realestate:     { bg: '#FFF1F2', text: '#F43F5E', icon: '🏠' },
  roomrent:       { bg: '#FEF2F2', text: '#EF4444', icon: '🛏️' },
  exchange:       { bg: '#FEFCE8', text: '#CA8A04', icon: '💱' },
};
const DEFAULT_META = { bg: '#F3F4F6', text: '#6B7280', icon: '📋' };

// 필터 정의 (slug 기반) - labels via t()
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

  // ── 핀 로드/저장
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

  const generalBoards = boards.filter(b => !b.isUniversityBoard);

  // 필터링된 게시판 목록 계산
  const getFilteredBoards = () => {
    if (filter === 'all') return generalBoards;
    if (filter === 'pinned') return generalBoards.filter(b => pinned.includes(String(b.id)));
    const f = FILTERS.find(x => x.key === filter);
    return generalBoards.filter(b => f?.slugs?.includes(b.slug));
  };

  const filteredBoards = getFilteredBoards();
  // 'all' 필터에서 핀된 항목 우선 정렬
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

  // ── 컴팩트 게시판 행
  function renderBoardRow(board) {
    const meta = BOARD_META[board.slug] ?? DEFAULT_META;
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
          <Text style={styles.icon}>{meta.icon}</Text>
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

  // 학교 커뮤니티 컴팩트 배너 (프리미엄 카드 느낌)
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
          {/* 상단 하이라이트 선 (유리광택) */}
          <View style={styles.schoolBannerShine} pointerEvents="none" />
          <View style={styles.schoolIconBadge}>
            <Text style={styles.schoolIconEmoji}>{isAdmin ? '🛡️' : '🎓'}</Text>
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

  // ── 상단 [게시판 | 모임] 토글
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
      {/* ── 필터 칩 (고정 헤더) */}
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
        {/* 학교 커뮤니티 — student 인증자만 배너, student 미인증만 인증 카드 */}
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
                  <Text style={styles.verifyCardTitle}>🎓 {t('board.verifyTitle')}</Text>
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

        {/* 게시판 목록 (컴팩트 카드 그룹) */}
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
            <Text style={styles.emptyEmoji}>
              {filter === 'pinned' ? '⭐' : '📭'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'pinned' ? t('board.pinnedEmpty') : t('board.empty')}
            </Text>
            {filter === 'pinned' && (
              <Text style={styles.emptySub}>{t('board.pinHint')}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* 플로팅 글쓰기 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setWriteModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={22} color={colors.white} />
      </TouchableOpacity>

      {/* 게시판 선택 모달 */}
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
                const meta = BOARD_META[board.slug] ?? DEFAULT_META;
                return (
                  <TouchableOpacity
                    key={String(board.id)}
                    style={[styles.modalRow, idx < generalBoards.length - 1 && styles.modalRowBorder]}
                    onPress={() => handleWriteSelect(board)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalIconBox, { backgroundColor: meta.bg }]}>
                      <Text style={styles.modalIcon}>{meta.icon}</Text>
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

  // ── 게시판/모임 토글
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

  // ── 필터 칩
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

  // ── 학교 커뮤니티 배너 (프리미엄)
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
  schoolIconEmoji: { fontSize: 18 },
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

  // ── 인증 유도 카드
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

  // ── 컴팩트 리스트 카드
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

  // ── 컴팩트 행
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
  icon: { fontSize: 19 },
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

  // ── 빈 상태
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 6,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 4 },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 12, color: colors.textSecondary },

  // ── 에러
  errorText: { fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
  retryBtn:  { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary },
  retryText: { color: colors.white, fontWeight: '600', fontSize: 14 },

  // ── 플로팅 글쓰기
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

  // ── 모달
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
  modalIcon: { fontSize: 20 },
  modalBoardName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  modalCancel: {
    marginTop: 8, marginHorizontal: 20,
    paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
