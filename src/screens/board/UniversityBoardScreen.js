import { useState, useEffect, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { Image } from 'expo-image';
import { getUniversityBoards, getGroups, getSchoolChat } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getBoardName, getBoardDescription } from '../../lib/i18n';
import { toShortUniversityName } from '../../lib/university';

// 게시판 slugSuffix별 아이콘·색상 매핑
const BOARD_META = {
  free:      { icon: '💬', color: '#7F77DD' },
  anonymous: { icon: '🎭', color: '#888888' },
  meetup:    { icon: '🤝', color: '#FF8A65' },
  info:      { icon: '💡', color: '#4ECDC4' },
};

// slug에서 마지막 suffix 추출 (예: 'uoft-free' → 'free')
function getSuffix(slug = '') {
  return slug.split('-').pop();
}

// 학교 페이지에서 더 이상 노출하지 않는 게시판 (글로벌 모임/유학정보로 대체)
const HIDDEN_SCHOOL_BOARD_SUFFIXES = new Set(['meetup', 'info']);

// 학교 전용 게시판 홈 화면 (에브리타임 스타일)
export default function UniversityBoardScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === 'admin';

  const [boards, setBoards] = useState([]);
  const [schoolGroups, setSchoolGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({}); // { [univName]: true }

  useEffect(() => {
    fetchBoards();
    fetchSchoolGroups();
  }, []);

  async function fetchBoards() {
    setLoading(true);
    setError(null);
    try {
      const result = await getUniversityBoards();
      if (result.success) {
        setBoards(result.data);
      } else {
        setError(t('common.serverError'));
      }
    } catch (e) {
      setError(e.message ?? t('common.serverError'));
    } finally {
      setLoading(false);
    }
  }

  // 학교 전체 채팅 진입 — 첫 진입 시 lazy create + 자동 참여
  async function openSchoolChat() {
    try {
      const res = await getSchoolChat();
      if (res.success) {
        navigation.navigate('ChatRoom', {
          roomId: res.data.id,
          kind: 'school',
          group: {
            id: null,
            name: res.data.groupName || res.data.university,
            coverImage: '',
            memberCount: res.data.participantCount,
          },
        });
      } else {
        // optional toast/Alert
      }
    } catch {}
  }

  // 학교 한정 동아리 — 인증 회원만 (admin은 전체 학교 다 보이는데 일단 본인 학교 또는 빈 배열)
  async function fetchSchoolGroups() {
    if (!user?.university || !user?.verified) {
      setSchoolGroups([]);
      return;
    }
    try {
      const res = await getGroups({ university: user.university, sort: 'popular' });
      if (res.success) setSchoolGroups(res.data || []);
    } catch {}
  }

  // admin용: 학교별로 게시판 그룹핑 + 검색 필터
  const groupedByUniversity = useMemo(() => {
    if (!isAdmin) return null;
    const s = search.trim().toLowerCase();
    const acc = {};
    boards.forEach((board) => {
      const key = board.university || t('board.other');
      const matched = !s || key.toLowerCase().includes(s) || board.name.toLowerCase().includes(s);
      if (!matched) return;
      if (!acc[key]) acc[key] = [];
      acc[key].push(board);
    });
    return acc;
  }, [boards, isAdmin, search]);

  const sortedUnivNames = useMemo(
    () => (groupedByUniversity ? Object.keys(groupedByUniversity).sort() : []),
    [groupedByUniversity]
  );

  // 검색 중이면 자동 펼침, 아니면 expanded 상태 사용
  const isSearching = search.trim().length > 0;
  const isOpen = (uni) => isSearching || !!expanded[uni];
  const toggle = (uni) => setExpanded((e) => ({ ...e, [uni]: !e[uni] }));

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
        <TouchableOpacity style={styles.retryBtn} onPress={fetchBoards}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 게시판 카드 렌더링 헬퍼
  function renderBoardCard(board) {
    const suffix = getSuffix(board.slug);
    const meta = BOARD_META[suffix] ?? { icon: '📋', color: colors.primary };
    return (
      <TouchableOpacity
        key={String(board.id)}
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('BoardFeed', { boardId: board.id, boardName: getBoardName(board.slug, board.name, t), isUniversityBoard: true })}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: meta.color + '22' }]}>
          <Text style={styles.cardIcon}>{meta.icon}</Text>
        </View>
        <Text style={styles.cardName} numberOfLines={2}>{getBoardName(board.slug, board.name, t)}</Text>
        {board.description ? <Text style={styles.cardDesc} numberOfLines={2}>{getBoardDescription(board.slug, board.description, t)}</Text> : null}
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero — 카드형 그라데이션 + 통계 칩 ── */}
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={[colors.primary, colors.primary + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroShine} pointerEvents="none" />
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBadge}>
              <Text style={styles.heroIconEmoji}>{isAdmin ? '🛡️' : '🎓'}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle} numberOfLines={1} ellipsizeMode="tail">
                  {isAdmin ? t('board.schoolAll') : (toShortUniversityName(user?.university) || t('mypage.school'))}
                </Text>
                {!isAdmin && (
                  <Ionicons name="checkmark-circle" size={16} color="#FFD66B" style={{ marginLeft: 5 }} />
                )}
              </View>
              <Text style={styles.heroSub} numberOfLines={1} ellipsizeMode="tail">
                {isAdmin ? t('board.schoolBoardAdmin') : `Community · ${t('board.forStudents')}`}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── 학교 전체 채팅 진입 버튼 (인증 회원 전용) ── */}
      {!isAdmin && user?.verified && user?.university && (
        <TouchableOpacity
          style={styles.chatEntryCard}
          onPress={openSchoolChat}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="학교 전체 채팅 입장"
        >
          <View style={styles.chatEntryIcon}>
            <Ionicons name="chatbubbles" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chatEntryTitle}>학교 전체 채팅</Text>
            <Text style={styles.chatEntrySub}>같은 학교 인증 회원과 대화</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* ── admin: 검색 + 학교별 접기/펼치기 ── */}
      {isAdmin && groupedByUniversity ? (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('board.searchSchool')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
          </View>
          {sortedUnivNames.length === 0 ? (
            <Text style={styles.empty}>{t('search.noResult')}</Text>
          ) : (
            sortedUnivNames.map((univName) => {
              const univBoards = groupedByUniversity[univName];
              const open = isOpen(univName);
              return (
                <View key={univName}>
                  <TouchableOpacity
                    style={styles.univGroupHeader}
                    onPress={() => toggle(univName)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={open ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color={colors.text}
                    />
                    <Text style={styles.univGroupTitle}>🏫 {univName}</Text>
                    <Text style={styles.univGroupCount}>{univBoards.length}</Text>
                  </TouchableOpacity>
                  {open && (
                    <View style={styles.gridWrapper}>
                      <View style={styles.grid}>{univBoards.map(renderBoardCard)}</View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      ) : (
        /* ── 일반 유저: 내 학교 게시판 그리드 (모임/정보는 동아리/글로벌로 대체되어 숨김) ── */
        (() => {
          const visibleBoards = boards.filter(b => !HIDDEN_SCHOOL_BOARD_SUFFIXES.has(getSuffix(b.slug)));
          return (
            <View>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>게시판</Text>
                <Text style={styles.sectionCount}>{visibleBoards.length}</Text>
              </View>
              <View style={styles.gridWrapper}>
                <View style={styles.grid}>{visibleBoards.map(renderBoardCard)}</View>
              </View>
            </View>
          );
        })()
      )}

      {/* ── 우리 학교 동아리 (인증된 일반 유저만) ── */}
      {!isAdmin && user?.verified && user?.university && (
        <View>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>동아리</Text>
            {schoolGroups.length > 0 && <Text style={styles.sectionCount}>{schoolGroups.length}</Text>}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => navigation.navigate('GroupCreate')}
              activeOpacity={0.7}
              style={styles.sectionAction}
              accessibilityRole="button"
              accessibilityLabel="동아리 만들기"
            >
              <Ionicons name="add" size={15} color={colors.primary} />
              <Text style={styles.sectionActionText}>만들기</Text>
            </TouchableOpacity>
          </View>

          {schoolGroups.length === 0 ? (
            <View style={styles.clubsEmpty}>
              <Text style={styles.clubsEmptyEmoji}>🎯</Text>
              <Text style={styles.clubsEmptyText}>아직 동아리가 없어요</Text>
              <Text style={styles.clubsEmptyHint}>같은 학교 친구들과 첫 동아리를 만들어보세요</Text>
              <TouchableOpacity
                style={styles.clubsEmptyCta}
                onPress={() => navigation.navigate('GroupCreate')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={14} color={colors.white} />
                <Text style={styles.clubsEmptyCtaText}>동아리 만들기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.clubsList}>
              {schoolGroups.map((g, idx) => (
                <TouchableOpacity
                  key={String(g.id)}
                  style={[styles.clubCard, idx === schoolGroups.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
                >
                  {g.coverImage ? (
                    <Image source={{ uri: g.coverImage }} style={styles.clubCover} contentFit="cover" />
                  ) : (
                    <View style={[styles.clubCover, { backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 22 }}>👥</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.clubName} numberOfLines={1}>{g.name}</Text>
                    {!!g.description && (
                      <Text style={styles.clubDesc} numberOfLines={1}>{g.description}</Text>
                    )}
                    <View style={styles.clubMetaRow}>
                      <Ionicons name="people-outline" size={11} color={colors.textSecondary} />
                      <Text style={styles.clubMeta}>{g.memberCount}명</Text>
                      {g.joinPolicy === 'approval' && (
                        <>
                          <Text style={styles.clubMetaDot}>·</Text>
                          <Text style={[styles.clubMeta, { color: colors.primary, fontWeight: '700' }]}>승인 필요</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  // ── Hero (카드형, 더 풍성한 느낌)
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  heroBanner: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  heroShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBadge: {
    width: 44, height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconEmoji: { fontSize: 22 },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
    fontWeight: '500',
  },
  heroChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  heroChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },

  // ── 학교 전체 채팅 진입 카드
  chatEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chatEntryIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  chatEntryTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  chatEntrySub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // ── 섹션 헤더 (게시판/동아리 공통)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 22,
    marginBottom: 8,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
  },
  sectionActionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },

  // ── admin 검색바
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    paddingHorizontal: 12, height: 42,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },

  // ── admin 학교 그룹 헤더 (탭 가능)
  univGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 14, height: 44,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  univGroupTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  univGroupCount: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: colors.inputBg, borderRadius: 8,
  },

  // ── 카드 그리드 (2열)
  gridWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47.5%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  anonBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.inputBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  anonBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // ── 동아리 빈 상태 / 카드 / 메타
  clubsEmpty: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  clubsEmptyEmoji: { fontSize: 36, marginBottom: 8 },
  clubsEmptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  clubsEmptyHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  clubsEmptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  clubsEmptyCtaText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  clubsList: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  clubCover: { width: 46, height: 46, borderRadius: 12 },
  clubName: { fontSize: 14, fontWeight: '700', color: colors.text },
  clubDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  clubMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  clubMeta: { fontSize: 11, color: colors.textSecondary },
  clubMetaDot: { fontSize: 11, color: colors.textSecondary },

  // ── 인증 완료 풋터 카드
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#10B981' + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedTitle: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '800',
  },
  verifiedSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
    fontWeight: '500',
  },

  // ── 에러
  errorText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});
