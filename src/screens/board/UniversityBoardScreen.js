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
import { getUniversityBoards } from '../../lib/api';
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

// 학교 전용 게시판 홈 화면 (에브리타임 스타일)
export default function UniversityBoardScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === 'admin';

  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({}); // { [univName]: true }

  useEffect(() => {
    fetchBoards();
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
      {/* ── 헤더 (프리미엄 배너, BoardListScreen과 통일) ── */}
      <LinearGradient
        colors={[colors.primary, colors.primary + 'D0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      >
        <View style={styles.heroShine} pointerEvents="none" />
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
      </LinearGradient>

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
        /* ── 일반 유저: 내 학교 게시판 그리드 ── */
        <View style={styles.gridWrapper}>
          <View style={styles.grid}>{boards.map(renderBoardCard)}</View>
        </View>
      )}

      {/* ── 인증 완료 배지 (일반 유저만) ── */}
      {!isAdmin && (
        <View style={styles.verifiedRow}>
          <Text style={styles.verifiedText}>
            ✓ {user?.university} {t('board.verified')}
          </Text>
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

  // ── 헤더 (프리미엄 배너, BoardListScreen과 통일)
  heroBanner: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  heroShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroIconBadge: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconEmoji: { fontSize: 20 },
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
    color: colors.white + 'B8',
    marginTop: 2,
    fontWeight: '500',
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
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47.5%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    // 카드 그림자
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
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

  // ── 인증 배지
  verifiedRow: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#10B981' + '18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B7EBD0',
  },
  verifiedText: {
    fontSize: 13,
    color: '#2D9E5A',
    fontWeight: '600',
    textAlign: 'center',
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
