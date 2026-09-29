import { useState, useEffect, useLayoutEffect } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Switch,
  ActionSheetIOS,
  Platform,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import CustomHeader from '../../components/CustomHeader';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getToken } from '../../lib/storage';
import { API_BASE_URL, SERVER_HOST } from '../../lib/config';
import Avatar from '../../components/common/Avatar';
import { getBlockStatus, setBlock, reportPost, checkChatStatus } from '../../lib/api';
import { formatTime } from '../../lib/time';

const REPORT_REASONS = ['spam', 'hate', 'illegal', 'adult', 'etc'];

// Body preview, with HTML tags and legacy markers stripped (same logic as PostCard)
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

function formatDate(str) {
  const d = new Date(str);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const roleLabel = (t) => ({
  student: t('profile.r_student'),
  working_holiday: t('profile.r_wh'),
  general: t('profile.r_general'),
  admin: t('profile.r_admin'),
});

export default function UserProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { userId } = route.params;
  const { user: me } = useAuth();
  const { t } = useLang();
  const ROLE_LABEL = roleLabel(t);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [blockStatus, setBlockStatus] = useState({ blocked: false, blockChat: false, hideContent: false });
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [draftChat, setDraftChat] = useState(true);
  const [draftHide, setDraftHide] = useState(true);
  const [blockSaving, setBlockSaving] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [chatStatus, setChatStatus] = useState('none'); // 'none' | 'pending' | 'accepted'
  const [chatIsRequester, setChatIsRequester] = useState(false);

  const isSelf = String(me?.id) === String(userId);

  useEffect(() => {
    fetch(`${API_BASE_URL}/users/${userId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setProfile(d.data); })
      .catch(() => Alert.alert(t('common.error'), t('profile.cannotLoad')))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (isSelf) return;
    getBlockStatus(userId).then(res => {
      if (res.success) setBlockStatus(res.data);
    }).catch(() => {});
    checkChatStatus(userId).then(res => {
      if (res.success) {
        setChatStatus(res.data.status);
        setChatIsRequester(res.data.isRequester ?? false);
      }
    }).catch(() => {});
  }, [userId, isSelf]);

  const openBlockModal = () => {
    // Already blocked → open the modal on the current state; otherwise default both switches on
    setDraftChat(blockStatus.blocked ? blockStatus.blockChat : true);
    setDraftHide(blockStatus.blocked ? blockStatus.hideContent : true);
    setBlockModalOpen(true);
  };

  const showMoreMenu = () => {
    if (isSelf) return;
    const blockLabel = blockStatus.blocked ? t('block.unblock') : t('block.blockUser');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('block.cancel'), t('block.menuReport'), blockLabel],
          destructiveButtonIndex: [1, 2],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) setReportModalOpen(true);
          else if (idx === 2) openBlockModal();
        }
      );
    } else {
      Alert.alert(t('block.menuMore'), '', [
        { text: t('block.cancel'), style: 'cancel' },
        { text: t('block.menuReport'), onPress: () => setReportModalOpen(true) },
        { text: blockLabel, style: 'destructive', onPress: openBlockModal },
      ]);
    }
  };

  const submitReport = async (reason) => {
    setReportSaving(true);
    try {
      const res = await reportPost({ targetType: 'user', targetId: userId, reason });
      if (res.success) {
        setReportModalOpen(false);
        Alert.alert('', t('post.reportDone'));
      } else if (res.message?.includes('이미')) {
        Alert.alert('', t('post.reportDup'));
        setReportModalOpen(false);
      } else {
        throw new Error(res.message);
      }
    } catch (e) {
      if (String(e.message).includes('이미')) {
        Alert.alert('', t('post.reportDup'));
        setReportModalOpen(false);
      } else {
        Alert.alert(t('common.error'), t('post.reportFailed'));
      }
    } finally {
      setReportSaving(false);
    }
  };

  // Uses CustomHeader, matching every other screen
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const applyBlock = async () => {
    setBlockSaving(true);
    try {
      const res = await setBlock(userId, { blockChat: draftChat, hideContent: draftHide });
      if (res.success) {
        setBlockStatus(res.data);
        setBlockModalOpen(false);
        Alert.alert('', res.data.blocked ? t('block.blockedToast') : t('block.unblockedToast'));
        if (res.data.blocked && navigation.canGoBack()) navigation.goBack();
      } else {
        throw new Error(res.message);
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('block.failed'));
    } finally {
      setBlockSaving(false);
    }
  };

  async function handleChat() {
    setChatLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      if (data.success) {
        navigation.navigate('ChatRoom', { roomId: data.data.id, other: data.data.other });
      } else {
        Alert.alert(t('common.error'), data.message);
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.cannotChat'));
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile) {
    return <View style={styles.center}><Text style={styles.emptyText}>{t('profile.notFound')}</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <CustomHeader
      navigation={navigation}
      title={t('nav.profile')}
      rightActions={isSelf ? [] : [
        { icon: 'ellipsis-horizontal', onPress: showMoreMenu, label: t('post.moreActions') },
      ]}
    />
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.header}>
        <Avatar nickname={profile.nickname} uri={profile.avatarUrl} size={64} showLetter />
        <View style={styles.headerInfo}>
          <View style={styles.nicknameRow}>
            <Text style={styles.nickname} numberOfLines={1}>{profile.nickname}</Text>
            {profile.tradeSoldCount > 0 && (
              <View style={styles.trustChip}>
                <Text style={styles.trustChipText}><Ionicons name="swap-horizontal" size={11} color="#92400E" /> {profile.tradeSoldCount}{t('profile.tradeUnit')}</Text>
              </View>
            )}
          </View>
          {profile.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{ROLE_LABEL[profile.role] ?? profile.role}</Text>
            </View>
          )}
          {profile.school && <Text style={styles.subText}><Ionicons name="school" size={12} color={colors.textSecondary} /> {profile.school}</Text>}
          {profile.city && <Text style={styles.subText}><Ionicons name="location" size={12} color={colors.textSecondary} /> {profile.city}</Text>}
          <Text style={styles.subText}>{t('profile.joined')} {formatDate(profile.createdAt)}</Text>
        </View>
      </View>

      {profile.bio ? (
        <Text style={styles.bio}>{profile.bio}</Text>
      ) : null}

      {/* Chat / block buttons */}
      {!isSelf && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.chatBtn,
              { flex: 1 },
              chatStatus === 'pending' && chatIsRequester && styles.chatBtnPending,
            ]}
            onPress={handleChat}
            disabled={chatLoading || (chatStatus === 'pending' && chatIsRequester)}
            activeOpacity={0.8}
          >
            {chatLoading
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={[
                  styles.chatBtnText,
                  chatStatus === 'pending' && chatIsRequester && styles.chatBtnTextPending,
                ]}>
                  {chatStatus === 'accepted'
                    ? t('profile.chatBtn')
                    : chatStatus === 'pending' && chatIsRequester
                      ? t('profile.chatPending')
                      : t('profile.chatRequest')
                  }
                </Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.blockBtn}
            onPress={openBlockModal}
            activeOpacity={0.8}
          >
            <Text style={styles.blockBtnText}>
              {blockStatus.blocked ? t('block.unblock') : t('block.blockUser')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Their posts */}
      <Text style={styles.sectionTitle}>{t('profile.wrotePosts')} {profile.posts?.length ?? 0}</Text>
      {profile.posts?.length === 0 && (
        <Text style={styles.emptyText}>{t('profile.noPosts')}</Text>
      )}
      {profile.posts?.map(post => {
        const preview = getPreview(post.content);
        const hasThumb = !!post.thumbnail;
        const thumbUri = hasThumb
          ? (post.thumbnail.startsWith('http') ? post.thumbnail : `${SERVER_HOST}${post.thumbnail}`)
          : null;
        return (
          <TouchableOpacity
            key={post.id}
            style={styles.postCard}
            onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            activeOpacity={0.8}
          >
            <View style={styles.postTop}>
              <View style={[styles.postTextCol, hasThumb && { flex: 1, marginRight: 10 }]}>
                {post.boardName && <Text style={styles.postBoard}>{post.boardName}</Text>}
                <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
                {preview.length > 0 && (
                  <Text style={styles.postContent} numberOfLines={2}>{preview}</Text>
                )}
              </View>
              {hasThumb && (
                <Image source={{ uri: thumbUri }} style={styles.postThumb} resizeMode="cover" />
              )}
            </View>
            <View style={styles.postMeta}>
              <Text style={styles.postMetaText}><Ionicons name="heart" size={11} color="#FF4444" /> {post.likeCount}</Text>
              <Text style={styles.postMetaText}><Ionicons name="chatbubble" size={11} color={colors.textSecondary} /> {post.commentCount}</Text>
              <Text style={[styles.postMetaText, { marginLeft: 'auto' }]}>{formatTime(post.createdAt, t)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      <Modal visible={blockModalOpen} transparent animationType="fade" onRequestClose={() => setBlockModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('block.confirmTitle')}</Text>

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalRowTitle}>{t('block.optChat')}</Text>
                <Text style={styles.modalRowDesc}>{t('block.optChatDesc')}</Text>
              </View>
              <Switch
                value={draftChat}
                onValueChange={setDraftChat}
                trackColor={{ false: '#D1D5DB', true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalRowTitle}>{t('block.optHide')}</Text>
                <Text style={styles.modalRowDesc}>{t('block.optHideDesc')}</Text>
              </View>
              <Switch
                value={draftHide}
                onValueChange={setDraftHide}
                trackColor={{ false: '#D1D5DB', true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setBlockModalOpen(false)}
                disabled={blockSaving}
              >
                <Text style={styles.modalBtnGhostText}>{t('block.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={applyBlock}
                disabled={blockSaving}
              >
                {blockSaving
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.modalBtnPrimaryText}>{t('block.apply')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reportModalOpen} transparent animationType="fade" onRequestClose={() => setReportModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('post.reportTitle')}</Text>
            {REPORT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={styles.reasonRow}
                onPress={() => submitReport(r)}
                disabled={reportSaving}
              >
                <Text style={styles.reasonText}>{t(`post.r_${r}`)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnGhost, { marginTop: 12 }]}
              onPress={() => setReportModalOpen(false)}
              disabled={reportSaving}
            >
              <Text style={styles.modalBtnGhostText}>{t('block.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: colors.surface,
    padding: 20,
  },
  headerInfo: { flex: 1, gap: 4 },
  nickname: { fontSize: 20, fontWeight: '700', color: colors.text },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  subText: { fontSize: 13, color: colors.textSecondary },

  // Nickname + trade reputation chip (laid out horizontally)
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  trustChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  trustChipText: { fontSize: 11, fontWeight: '800', color: '#92400E' },

  bio: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  actionRow: {
    flexDirection: 'row', gap: 10, margin: 16,
  },
  chatBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  chatBtnPending: { backgroundColor: colors.inputBg ?? '#E5E7EB' },
  chatBtnTextPending: { color: colors.textSecondary },
  blockBtn: {
    paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.danger ?? '#E64545',
    alignItems: 'center', justifyContent: 'center',
  },
  blockBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },

  postCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  postTop: { flexDirection: 'row' },
  postTextCol: { flex: 1 },
  postThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.inputBg },
  postBoard: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  postTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  postContent: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 2 },
  postMeta: { flexDirection: 'row', gap: 10, marginTop: 8 },
  postMetaText: { fontSize: 12, color: colors.textSecondary },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 16 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderTopWidth: 1, borderColor: colors.border,
  },
  modalRowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  modalRowDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: {
    flex: 1, height: 46, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalBtnGhostText: { color: colors.text, fontWeight: '700' },
  modalBtnPrimary: { backgroundColor: colors.danger ?? '#E64545' },
  modalBtnPrimaryText: { color: colors.white, fontWeight: '700' },
  reasonRow: {
    paddingVertical: 14,
    borderTopWidth: 1, borderColor: colors.border,
  },
  reasonText: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
