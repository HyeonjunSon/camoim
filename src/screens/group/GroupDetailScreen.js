import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, StyleSheet, Modal, Switch, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import {
  getGroup, joinGroup, leaveGroup, closeGroup, getGroupPosts, getGroupChat,
  setGroupNotifications, uploadGroupCover,
} from '../../lib/api';
import { formatTime } from '../../lib/time';

const CATEGORY_LABEL = {
  hobby: 'group.catHobby', study: 'group.catStudy', local: 'group.catLocal',
  job: 'group.catJob', workinghol: 'group.catWorkinghol', general: 'group.catGeneral',
};

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params || {};
  const { colors } = useTheme();
  const { t } = useLang();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getGroup(groupId);
      if (res.success) {
        setGroup(res.data);
        // 멤버일 때만 게시글 로드
        if (res.data.myMembership?.status === 'active') {
          try {
            const pr = await getGroupPosts(groupId, { page: 1, limit: 30 });
            if (pr.success) setPosts(pr.data?.posts || []);
          } catch {}
        }
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 커스텀 헤더 사용 — native bar의 좌/우 너비 차이로 제목이 중앙에서
  // 밀려나는 문제 회피
  const isActiveMember = group?.myMembership?.status === 'active';
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onJoin = async () => {
    setBusy(true);
    try {
      const res = await joinGroup(groupId);
      if (res.success) load();
      else Alert.alert('', res.message || t('common.serverError'));
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    Alert.alert('', t('group.leaveConfirm'), [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: t('group.leave'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await leaveGroup(groupId);
            if (res.success) {
              Alert.alert('', t('group.leaveOk'));
              load();
            } else if (res.message?.includes('그룹장') || /owner/i.test(res.message || '')) {
              Alert.alert('', t('group.ownerCantLeave'));
            } else {
              Alert.alert('', res.message || t('common.serverError'));
            }
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // 모임 커버 사진 변경 — 그룹장 전용. 채팅방의 캐시된 cover도 서버에서 함께 동기화됨
  const onChangeCover = async () => {
    if (uploadingCover) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('post.permRequired'), t('post.permPhotoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 1],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingCover(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadGroupCover(groupId, { uri: manipulated.uri });
      if (res.success) {
        // 즉시 화면 반영
        setGroup(g => g ? { ...g, coverImage: res.data.coverImage } : g);
      } else {
        Alert.alert('', res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    } finally {
      setUploadingCover(false);
    }
  };

  const onClose = () => {
    Alert.alert('', t('group.closeConfirm'), [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: t('group.closeGroup'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await closeGroup(groupId);
            if (res.success) {
              Alert.alert('', t('group.closeOk'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } else {
              Alert.alert('', res.message || t('common.serverError'));
            }
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!group) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>{t('common.serverError')}</Text>
      </View>
    );
  }

  const my = group.myMembership;
  const isOwner = my?.role === 'owner';
  const isManager = my?.role === 'manager';
  const isMember = my?.status === 'active';
  const isPendingMember = my?.status === 'pending';
  const isBanned = my?.status === 'banned';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <CustomHeader
      navigation={navigation}
      title={group?.name || t('nav.groupDetail')}
      rightActions={isActiveMember ? [
        { icon: 'ellipsis-horizontal', onPress: () => setSettingsOpen(true), label: '모임 설정' },
      ] : []}
    />

    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* 커버 + 헤더 — 그룹장은 사진 탭으로 변경 가능 */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={isOwner ? 0.85 : 1}
          onPress={isOwner ? onChangeCover : undefined}
          disabled={!isOwner || uploadingCover}
        >
          {group.coverImage ? (
            <Image source={{ uri: group.coverImage }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 56 }}>👥</Text>
            </View>
          )}
          {isOwner && (
            <View style={styles.coverEditBadge}>
              {uploadingCover ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="camera" size={13} color={colors.white} />
                  <Text style={styles.coverEditBadgeText}>변경</Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.name}>{group.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>{t(CATEGORY_LABEL[group.category] || 'group.catGeneral')}</Text>
            </View>
            {!!group.city && (
              <View style={styles.metaTag}>
                <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaTagText}>{group.city}</Text>
              </View>
            )}
            <View style={styles.metaTag}>
              <Ionicons name="people-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.metaTagText}>{group.memberCount} {t('group.member')}</Text>
            </View>
          </View>
          {!!group.description && <Text style={styles.desc}>{group.description}</Text>}

          {group.status === 'pending_review' && (
            <View style={[styles.statusBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statusText, { color: '#92400E' }]}>⏳ {t('group.statusPending')}</Text>
            </View>
          )}
          {group.status === 'rejected' && (
            <View style={[styles.statusBox, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.statusText, { color: '#991B1B' }]}>{t('group.statusRejected')}</Text>
              {!!group.rejectReason && (
                <Text style={[styles.statusSub, { color: '#991B1B' }]}>{t('group.rejectReason')}: {group.rejectReason}</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actions}>
        {!my && group.status === 'active' && !isBanned && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={onJoin}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {group.joinPolicy === 'approval' ? t('group.joinApproval') : t('group.joinOpen')}
            </Text>
          </TouchableOpacity>
        )}
        {isPendingMember && (
          <View style={[styles.actionBtn, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ color: '#92400E', fontWeight: '700' }}>⏳ {t('group.pending')}</Text>
          </View>
        )}
        {isMember && !isOwner && (
          <TouchableOpacity style={[styles.actionBtn, styles.outlineBtn]} onPress={onLeave} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.outlineBtnText}>{t('group.leave')}</Text>
          </TouchableOpacity>
        )}
        {isMember && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={async () => {
              try {
                const res = await getGroupChat(groupId);
                if (res.success) {
                  navigation.navigate('ChatRoom', {
                    roomId: res.data.id,
                    kind: 'group',
                    group: {
                      id: res.data.groupId,
                      name: res.data.groupName,
                      coverImage: res.data.groupCoverImage,
                      memberCount: res.data.participantCount,
                    },
                  });
                } else {
                  Alert.alert('', res.message || t('common.serverError'));
                }
              } catch (e) {
                Alert.alert('', e?.message || t('common.serverError'));
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubbles" size={16} color={colors.white} />
            <Text style={styles.primaryBtnText}>그룹 채팅 입장</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 회원 보기 — 모든 가입자 동일. owner/manager는 들어가서 관리 가능. */}
      {isMember && (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('GroupMembers', { groupId, isOwner, isManager })}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={18} color={colors.text} />
          <Text style={styles.linkText}>{t('group.tabMembers')}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.linkCount}>{group.memberCount}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* 모임 커뮤니티 카드 — 그룹장/부그룹장이 꾸미는 소셜·공지 */}
      {isMember && (() => {
        const c = group.community || {};
        const links = [
          c.instagram && { kind: 'instagram', icon: 'logo-instagram', color: '#E1306C', label: 'Instagram', url: c.instagram },
          c.kakaoOpen && { kind: 'kakaoOpen', icon: 'chatbubble-ellipses', color: '#FAE100', label: '카톡 오픈채팅', url: c.kakaoOpen },
          c.discord && { kind: 'discord', icon: 'logo-discord', color: '#5865F2', label: 'Discord', url: c.discord },
          c.homepage && { kind: 'homepage', icon: 'globe', color: colors.primary, label: '홈페이지', url: c.homepage },
        ].filter(Boolean);
        const hasAny = links.length > 0 || !!c.notice;
        if (!hasAny && !group.canEditCommunity) return null;
        return (
          <View style={styles.communityCard}>
            <View style={styles.communityHeader}>
              <View style={styles.communityTitleRow}>
                <Ionicons name="sparkles" size={14} color={colors.primary} />
                <Text style={styles.communityTitle}>{t('board.communityTitle')}</Text>
              </View>
              {group.canEditCommunity && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('GroupCommunityEdit', { groupId })}
                  style={styles.communityEditBtn}
                  accessibilityRole="button"
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

            {!hasAny && group.canEditCommunity && (
              <TouchableOpacity
                style={styles.communityEmptyCta}
                onPress={() => navigation.navigate('GroupCommunityEdit', { groupId })}
                activeOpacity={0.85}
              >
                <Text style={styles.communityEmptyText}>{t('board.communityEmpty')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}

      {/* 모임 게시판 — 멤버 전용 */}
      {isMember && (
        <View style={styles.postsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('group.tabPosts')}</Text>
            <Text style={styles.sectionCount}>{group.postCount || 0}</Text>
          </View>
          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>아직 글이 없어요</Text>
              <Text style={styles.emptyPostsHint}>첫 글을 작성해보세요!</Text>
            </View>
          ) : (
            <View style={styles.postsCard}>
              {posts.map((p, idx) => (
                <View key={String(p.id)}>
                  <TouchableOpacity
                    style={styles.postRow}
                    onPress={() => navigation.navigate('BoardPostDetail', { postId: p.id })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.postTitle} numberOfLines={1}>
                        {p.pinned ? '📌 ' : ''}{p.title}
                      </Text>
                      {!!p.content && (
                        <Text style={styles.postPreview} numberOfLines={1}>{p.content}</Text>
                      )}
                      <View style={styles.postMeta}>
                        <Text style={styles.postMetaText}>{p.nickname}</Text>
                        <Text style={styles.postMetaDot}>·</Text>
                        <Text style={styles.postMetaText}>{formatTime(p.createdAt, t)}</Text>
                        {p.commentCount > 0 && (
                          <>
                            <Text style={styles.postMetaDot}>·</Text>
                            <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
                            <Text style={styles.postMetaText}>{p.commentCount}</Text>
                          </>
                        )}
                        {p.likeCount > 0 && (
                          <>
                            <Text style={styles.postMetaDot}>·</Text>
                            <Ionicons name="heart-outline" size={11} color={colors.textSecondary} />
                            <Text style={styles.postMetaText}>{p.likeCount}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    {p.thumbnail && (
                      <Image source={{ uri: p.thumbnail }} style={styles.postThumb} contentFit="cover" />
                    )}
                  </TouchableOpacity>
                  {idx < posts.length - 1 && <View style={styles.postDivider} />}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 그룹장: 정보 수정 / 폐쇄는 헤더의 ⋯ 메뉴로 이동 (settings sheet) */}
    </ScrollView>

    {/* 글쓰기 FAB — 멤버 전용 */}
    {isMember && (
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost', {
          groupId,
          groupName: group.name,
        })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="글쓰기"
      >
        <Ionicons name="create-outline" size={22} color={colors.white} />
      </TouchableOpacity>
    )}

    {/* 설정 바텀시트 — 알림 등 */}
    <Modal
      visible={settingsOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setSettingsOpen(false)}
    >
      <View style={styles.sheetOverlay}>
        <TouchableOpacity
          style={styles.sheetBg}
          activeOpacity={1}
          onPress={() => setSettingsOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>알림 설정</Text>

          {my && (
            <>
              <View style={styles.sheetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemLabel}>{t('group.notifyPosts')}</Text>
                  <Text style={styles.sheetItemHint}>새 글이 올라오면 알려줘요</Text>
                </View>
                <Switch
                  value={!!my.notifyPosts}
                  onValueChange={(val) => {
                    setGroup(g => g ? { ...g, myMembership: { ...g.myMembership, notifyPosts: val } } : g);
                    setGroupNotifications(groupId, { notifyPosts: val }).catch(() => {
                      setGroup(g => g ? { ...g, myMembership: { ...g.myMembership, notifyPosts: !val } } : g);
                    });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              <View style={styles.sheetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemLabel}>{t('group.notifyChat')}</Text>
                  <Text style={styles.sheetItemHint}>그룹 채팅 메시지를 알려줘요</Text>
                </View>
                <Switch
                  value={my.notifyChat !== false}
                  onValueChange={(val) => {
                    setGroup(g => g ? { ...g, myMembership: { ...g.myMembership, notifyChat: val } } : g);
                    setGroupNotifications(groupId, { notifyChat: val }).catch(() => {
                      setGroup(g => g ? { ...g, myMembership: { ...g.myMembership, notifyChat: !val } } : g);
                    });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </>
          )}

          {/* 그룹장 전용 — 정보 수정 / 폐쇄 */}
          {isOwner && (
            <>
              <Text style={[styles.sheetTitle, { marginTop: 12 }]}>모임 관리</Text>
              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  setSettingsOpen(false);
                  navigation.navigate('GroupEdit', { groupId });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={styles.sheetActionText}>{t('group.editGroup')}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  setSettingsOpen(false);
                  // 다음 프레임에서 폐쇄 다이얼로그 — 모달 닫힘과 충돌 방지
                  setTimeout(() => onClose(), 250);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.sheetActionText, { color: colors.danger }]}>{t('group.closeGroup')}</Text>
                <View style={{ flex: 1 }} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.sheetCloseBtn}
            onPress={() => setSettingsOpen(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.sheetCloseText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, marginBottom: 12 },
  cover: { width: '100%', height: 180 },
  coverEditBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverEditBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
  headerBody: { padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.inputBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  metaTagText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  desc: { fontSize: 14, color: colors.text, marginTop: 12, lineHeight: 21 },
  statusBox: { marginTop: 12, padding: 10, borderRadius: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusSub: { fontSize: 12, marginTop: 4 },

  actions: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  actionBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  primaryBtn: { backgroundColor: colors.primary },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  outlineBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  outlineBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12,
  },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.text },
  linkCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  sheetActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  sheetActionText: { fontSize: 15, color: colors.text, fontWeight: '500' },

  // 설정 바텀시트
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30, paddingTop: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 20, marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  sheetItemLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  sheetItemHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sheetCloseBtn: {
    marginTop: 12, marginHorizontal: 20, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
  },
  sheetCloseText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },

  // 커뮤니티 카드 (그룹장 편집)
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
  communityLinksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
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

  // 게시판 섹션
  postsSection: { marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  emptyPosts: {
    backgroundColor: colors.surface, marginHorizontal: 14, borderRadius: 14,
    paddingVertical: 32, alignItems: 'center',
  },
  emptyPostsText: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyPostsHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  postsCard: {
    backgroundColor: colors.surface, marginHorizontal: 14, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  postRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  postTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  postPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  postMetaText: { fontSize: 11, color: colors.textSecondary },
  postMetaDot: { fontSize: 11, color: colors.textSecondary },
  postThumb: { width: 56, height: 56, borderRadius: 8 },
  postDivider: { height: 1, backgroundColor: colors.border, marginLeft: 14 },

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
});
