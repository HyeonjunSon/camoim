import { useState, useEffect, useMemo, useCallback } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { Image } from 'expo-image';
import { getUniversityBoards, getGroups, getSchoolChat, getSchoolMemberCount, getSchoolCommunity } from '../../lib/api';
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
  const [memberCount, setMemberCount] = useState(null);
  const [community, setCommunity] = useState(null); // { community, canEdit, isLeader }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({}); // { [univName]: true }

  useEffect(() => {
    fetchBoards();
    fetchSchoolGroups();
    fetchMemberCount();
    fetchCommunity();
  }, []);

  // 편집 화면에서 돌아왔을 때 새 데이터 반영
  useFocusEffect(useCallback(() => { fetchCommunity(); }, []));

  async function fetchCommunity() {
    if (!user?.verified || !user?.university) return;
    try {
      const res = await getSchoolCommunity();
      if (res.success) setCommunity(res.data);
    } catch {}
  }

  async function fetchMemberCount() {
    if (!user?.verified || !user?.university) return;
    try {
      const res = await getSchoolMemberCount();
      if (res.success) setMemberCount(res.data?.count ?? null);
    } catch {}
  }

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
            {/* 인증 회원수 카드 — 탭하면 멤버 목록 화면으로 (모임 패턴) */}
            {!isAdmin && memberCount != null && (
              <TouchableOpacity
                style={styles.heroMemberBadge}
                onPress={() => navigation.navigate('SchoolMembers')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('schoolMembers.title')}
              >
                <Ionicons name="people" size={12} color={colors.white} />
                <Text style={styles.heroMemberCount}>{memberCount}</Text>
                <Text style={styles.heroMemberLabel}>{t('group.member')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* ── 학교 전체 채팅 진입 카드 (인증 회원 전용) ── */}
      {!isAdmin && user?.verified && user?.university && (
        <TouchableOpacity
          style={styles.chatEntryCard}
          onPress={openSchoolChat}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="학교 전체 채팅 입장"
        >
          <View style={styles.chatEntryIcon}>
            <Ionicons name="chatbubbles" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.chatEntryTitleRow}>
              <Text style={styles.chatEntryTitle}>학교 전체 채팅</Text>
              <View style={styles.chatEntryLiveDot}>
                <View style={styles.chatEntryLivePing} />
                <View style={styles.chatEntryLiveCore} />
              </View>
              <Text style={styles.chatEntryLiveText}>LIVE</Text>
            </View>
            <Text style={styles.chatEntrySub}>같은 학교 인증 회원과 지금 바로 대화</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* ── 학교 커뮤니티 카드 — 학생회장이 꾸미는 소셜 링크 + 공지 ── */}
      {!isAdmin && user?.verified && user?.university && community && (
        (() => {
          const c = community.community || {};
          const links = [
            c.instagram && { kind: 'instagram', icon: 'logo-instagram', color: '#E1306C', label: 'Instagram', url: c.instagram },
            c.kakaoOpen && { kind: 'kakaoOpen', icon: 'chatbubble-ellipses', color: '#FAE100', label: '카톡 오픈채팅', url: c.kakaoOpen },
            c.discord && { kind: 'discord', icon: 'logo-discord', color: '#5865F2', label: 'Discord', url: c.discord },
            c.homepage && { kind: 'homepage', icon: 'globe', color: colors.primary, label: '홈페이지', url: c.homepage },
          ].filter(Boolean);
          const hasAny = links.length > 0 || !!c.notice;
          if (!hasAny && !community.canEdit) return null;
          return (
            <View style={styles.communityCard}>
              <View style={styles.communityHeader}>
                <View style={styles.communityTitleRow}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={styles.communityTitle}>{t('board.communityTitle')}</Text>
                  {community.isLeader && (
                    <View style={styles.leaderBadge}>
                      <Text style={styles.leaderBadgeText}>{t('board.leaderBadge')}</Text>
                    </View>
                  )}
                </View>
                {community.canEdit && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('SchoolCommunityEdit')}
                    style={styles.communityEditBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('board.communityEdit')}
                  >
                    <Ionicons name="create-outline" size={14} color={colors.primary} />
                    <Text style={styles.communityEditText}>{t('board.communityEdit')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!c.notice && (
                <View style={styles.communityNotice}>
                  <Ionicons name="megaphone" size={13} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={styles.communityNoticeText}>{c.notice}</Text>
                </View>
              )}

              {links.length > 0 && (
                <View style={styles.communityLinksRow}>
                  {links.map(l => (
                    <TouchableOpacity
                      key={l.kind}
                      style={styles.communityLinkChip}
                      onPress={() => Linking.openURL(/^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`).catch(() => {})}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={l.icon} size={14} color={l.color} />
                      <Text style={styles.communityLinkText}>{l.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!hasAny && community.canEdit && (
                <TouchableOpacity
                  style={styles.communityEmptyCta}
                  onPress={() => navigation.navigate('SchoolCommunityEdit')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.communityEmptyText}>{t('board.communityEmpty')}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()
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
              onPress={() => navigation.navigate('GroupCreate', { schoolOnly: true })}
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
              <Text style={styles.clubsEmptyEmoji}>🎪</Text>
              <Text style={styles.clubsEmptyText}>아직 동아리가 없어요</Text>
              <Text style={styles.clubsEmptyHint}>같은 학교 친구들과 첫 동아리를 만들어보세요</Text>
              <TouchableOpacity
                style={styles.clubsEmptyCta}
                onPress={() => navigation.navigate('GroupCreate', { schoolOnly: true })}
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
  // 우측 회원수 배지 — 모임 metaTag 톤, 작고 컴팩트
  heroMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginLeft: 6,
  },
  heroMemberCount: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.2,
  },
  heroMemberLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 1,
  },

  // ── 학교 전체 채팅 진입 카드 — Hero(그라데이션)와 차별화: primary tint 채움 + 라이브 도트
  chatEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primary + '10',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  chatEntryIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chatEntryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatEntryTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  chatEntryLiveDot: {
    width: 8, height: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  chatEntryLivePing: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444',
    opacity: 0.4,
  },
  chatEntryLiveCore: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  chatEntryLiveText: {
    fontSize: 9, fontWeight: '900', color: '#EF4444',
    letterSpacing: 0.5,
  },
  chatEntrySub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, fontWeight: '500' },

  // ── 학교 커뮤니티 카드 (학생회장 편집 영역)
  communityCard: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  communityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  communityTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  leaderBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.primary + '18',
  },
  leaderBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  communityEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primary + '12',
  },
  communityEditText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  communityNotice: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.primary + '08',
    borderRadius: 10,
  },
  communityNoticeText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
  communityLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  communityLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  communityLinkText: { fontSize: 11, fontWeight: '700', color: colors.text },
  communityEmptyCta: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  communityEmptyText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

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
