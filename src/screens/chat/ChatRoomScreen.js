import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useSocket } from '../../context/SocketContext';
import { getToken } from '../../lib/storage';
import { API_BASE_URL } from '../../lib/config';
import Avatar from '../../components/common/Avatar';
import CustomHeader from '../../components/CustomHeader';
import { trackTiming } from '../../lib/perf';

export default function ChatRoomScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, other, group } = route.params;
  // group and school are both N-person rooms, so they share one UI pattern
  const isGroupChat = route.params?.kind === 'group' || route.params?.kind === 'school' || !!group;
  const isSchoolChat = route.params?.kind === 'school';
  const { user: me } = useAuth();
  const pendingSends = useRef(new Map()); // content → emit timestamp (perf_chat_rtt)
  const { t } = useLang();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(isGroupChat ? 'accepted' : (route.params?.status ?? 'accepted'));
  const [isRequester, setIsRequester] = useState(route.params?.isRequester ?? false);
  const [otherLeft, setOtherLeft] = useState(route.params?.otherLeft ?? false);
  const [otherDeleted, setOtherDeleted] = useState(route.params?.otherDeleted ?? false);
  const [schoolLeaderId, setSchoolLeaderId] = useState(null);
  // Track keyboard visibility — with the keyboard up, the safe-area inset is dropped so no gap sits between the input bar and the keyboard
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);
  // Android edgeToEdge sometimes reports insets.bottom as 0, so a 32px floor is enforced
  // (the gesture indicator / system nav bar area, plus visual breathing room)
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 32) : insets.bottom;
  const inputBarBottomPad = 8 + (keyboardVisible ? 0 : safeBottom);
  const { on, off, emit, joinRoom, leaveRoom, setActiveRoom } = useSocket();
  const flatListRef = useRef(null);

  // Header — both DM and group turn the native bar off in favour of CustomHeader (the iOS
  // native bar auto-wraps its left/right buttons in capsules, which collided with ours and showed a double circle)
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, []);

  // Load messages and wire the socket — re-run on every focus, which self-heals stale or empty responses
  useFocusEffect(useCallback(() => {
    let mounted = true;

    async function loadMessages() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/chats/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.warn('[chat] messages fetch failed', res.status);
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        if (data.success) {
          setMessages(Array.isArray(data.data) ? data.data : []);
          setOtherLeft(!!data.otherLeft);
          setOtherDeleted(!!data.otherDeleted);
          if (data.school?.leaderUserId) {
            setSchoolLeaderId(String(data.school.leaderUserId));
          } else {
            setSchoolLeaderId(null);
          }
        } else {
          console.warn('[chat] messages response not success', data?.message);
        }
      } catch (e) {
        console.warn('[chat] messages fetch error:', e?.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMessages();

    // Join the room over the global socket and mark it read
    joinRoom(roomId);
    setActiveRoom(roomId);
    emit('read_messages', { roomId });

    // Incoming message (only this room's)
    on('new_message', `chatRoom_${roomId}`, (msg) => {
      if (String(msg.roomId) !== String(roomId)) return;
      // When it is the echo of my own message, record the send round trip (the server returns trimmed content)
      if (String(msg.senderId) === String(me?.id)) {
        const sentAt = pendingSends.current.get(msg.content);
        if (sentAt != null) {
          pendingSends.current.delete(msg.content);
          trackTiming('perf_chat_rtt', Date.now() - sentAt, { kind: msg.kind || 'dm' });
        }
      }
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      if (String(msg.senderId) !== String(me?.id)) {
        emit('read_messages', { roomId });
      }
    });

    // When the other party reads
    on('messages_read', `chatRoom_${roomId}`, ({ readerId, roomId: rid }) => {
      if (rid && String(rid) !== String(roomId)) return;
      setMessages(prev => prev.map(m => {
        if (!m.readBy?.includes(readerId)) {
          return { ...m, readBy: [...(m.readBy ?? []), readerId] };
        }
        return m;
      }));
    });

    // Detect the other party leaving, live
    on('room_left', `chatRoom_${roomId}`, ({ roomId: rid }) => {
      if (String(rid) !== String(roomId)) return;
      setOtherLeft(true);
    });

    // Send error
    on('send_error', `chatRoom_${roomId}`, (err) => {
      Alert.alert(t('chat.sendFailed'), err?.message ?? t('common.error'));
    });

    return () => {
      mounted = false;
      leaveRoom(roomId);
      setActiveRoom(null);
      off('new_message', `chatRoom_${roomId}`);
      off('messages_read', `chatRoom_${roomId}`);
      off('room_left', `chatRoom_${roomId}`);
      off('send_error', `chatRoom_${roomId}`);
    };
  }, [roomId]));

  function sendMessage() {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    setSending(true);
    // For round-trip timing — identical messages sent back to back match the earliest one (old entries are pruned)
    if (!pendingSends.current.has(content)) pendingSends.current.set(content, Date.now());
    if (pendingSends.current.size > 20) pendingSends.current.delete(pendingSends.current.keys().next().value);
    emit('send_message', { roomId, content });
    setSending(false);
  }

  async function acceptRequest() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/chats/${roomId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatus('accepted');
      } else {
        Alert.alert(t('common.error'), data.message ?? t('chat.acceptFailed'));
      }
    } catch {
      Alert.alert(t('common.error'), t('chat.acceptFailed'));
    }
  }

  async function rejectRequest() {
    Alert.alert(t('chat.rejectTitle'), t('chat.rejectAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.reject'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/chats/${roomId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) navigation.goBack();
            else Alert.alert(t('common.error'), data.message ?? t('common.error'));
          } catch {
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  }

  async function handleRequestAgain() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: other?.id }),
      });
      const data = await res.json();
      if (data.success) {
        // Navigate to the new chat room
        navigation.replace('ChatRoom', { roomId: data.data.id, other: data.data.other, status: data.data.status, isRequester: data.data.isRequester });
      } else {
        Alert.alert(t('common.error'), data.message);
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.cannotChat'));
    }
  }

  function renderMessage({ item, index }) {
    const isMine = String(item.senderId) === String(me?.id);
    const prevItem = messages[index - 1];
    const showAvatar = !isMine && String(prevItem?.senderId) !== String(item.senderId);
    // In a 1:1 chat, show "1" while the other party has not read it (never in groups)
    const unreadCount = (!isGroupChat && isMine && item.readBy)
      ? (item.readBy.some(id => String(id) === String(other?.id)) ? 0 : 1)
      : 0;
    const senderName = item.senderNickname || (other?.nickname ?? '');
    // Sender profiles are tappable only in group and school chats (guarded against deleted and null senders)
    const canTapSender = isGroupChat && !isMine && !!item.senderId;
    const openSenderProfile = () => {
      if (canTapSender) navigation.push('UserProfile', { userId: String(item.senderId) });
    };
    // ⭐ badge when a school chat sender is that school's student president
    const senderIsLeader = isSchoolChat && !!schoolLeaderId && String(item.senderId) === schoolLeaderId;

    // Consecutive messages from one sender collapse their timestamps — only the last message within a minute shows one (KakaoTalk style)
    const nextItem = messages[index + 1];
    const sameMinute = (a, b) => {
      if (!a || !b) return false;
      const da = new Date(a);
      const db = new Date(b);
      return da.getFullYear() === db.getFullYear()
        && da.getMonth() === db.getMonth()
        && da.getDate() === db.getDate()
        && da.getHours() === db.getHours()
        && da.getMinutes() === db.getMinutes();
    };
    const showTime = !nextItem
      || String(nextItem.senderId) !== String(item.senderId)
      || !sameMinute(nextItem.createdAt, item.createdAt);

    const timeStr = new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    // Sender name (group and school chats, only the first time that sender appears)
    const senderHeader = !isMine && showAvatar && (
      canTapSender
        ? <TouchableOpacity onPress={openSenderProfile} activeOpacity={0.7}>
            <View style={styles.senderRow}>
              <Text style={styles.bubbleSender}>{senderName}</Text>
              {senderIsLeader && <Ionicons name="star" size={11} color={colors.primary} style={styles.senderLeader} />}
            </View>
          </TouchableOpacity>
        : <View style={styles.senderRow}>
            <Text style={styles.bubbleSender}>{senderName}</Text>
            {senderIsLeader && <Ionicons name="star" size={11} color={colors.primary} style={styles.senderLeader} />}
          </View>
    );

    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMine && (
          showAvatar
            ? (canTapSender
                ? <TouchableOpacity onPress={openSenderProfile} activeOpacity={0.7}>
                    <Avatar nickname={senderName || '?'} uri={isGroupChat ? null : other?.avatarUrl} size={28} showLetter />
                  </TouchableOpacity>
                : <Avatar nickname={senderName || '?'} uri={isGroupChat ? null : other?.avatarUrl} size={28} showLetter />)
            : <View style={styles.avatarSpacer} />
        )}
        <View style={[styles.bubbleColumn, isMine ? styles.bubbleColumnRight : styles.bubbleColumnLeft]}>
          {senderHeader}
          <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
            {/* My messages: timestamp to the left of the bubble */}
            {isMine && showTime && (
              <View style={styles.timeBox}>
                {unreadCount > 0 && <Text style={styles.unreadBadge}>{unreadCount}</Text>}
                <Text style={styles.bubbleTime}>{timeStr}</Text>
              </View>
            )}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text selectable style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
            </View>
            {/* Their messages: timestamp to the right of the bubble */}
            {!isMine && showTime && (
              <View style={styles.timeBox}>
                <Text style={styles.bubbleTime}>{timeStr}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  // Custom chat header — one design for DMs and groups (centred title plus an iOS 26 glass capsule)
  const headerTitle = isGroupChat
    ? (group?.name || t('chat.tabChats'))
    : (otherDeleted ? t('chat.deletedUser') : (other?.nickname ?? t('chat.tabChats')));
  // School-wide chat has no detail page, so the right action is hidden
  const showRightAction = isSchoolChat
    ? false
    : isGroupChat
      ? !!group?.id
      : !otherDeleted && !!other?.id;
  const rightLabel = isGroupChat ? '그룹' : t('chat.profile');
  const onRightPress = () => {
    if (isGroupChat && group?.id) {
      navigation.navigate('GroupDetail', { groupId: group.id });
    } else if (!isGroupChat && other?.id) {
      navigation.push('UserProfile', { userId: other.id });
    }
  };

  const CustomChatHeader = () => (
    <CustomHeader
      navigation={navigation}
      title={headerTitle}
      rightActions={showRightAction ? [
        { text: rightLabel, onPress: onRightPress, label: rightLabel },
      ] : []}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <CustomChatHeader />
      <FlatList
        testID="chat-messages"
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        // On content size change, and again on the next frame — variable bubble heights meant
        // scrollToEnd could run before layout settled and clip the last message
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          });
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom area: depends on the state */}
      {isGroupChat ? (
        // Group chat — always an input bar
        <View style={[styles.inputBar, { paddingBottom: inputBarBottomPad }]}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            testID="chat-send"
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : status === 'pending' && !isRequester ? (
        // Recipient: accept/decline buttons
        <View style={[styles.requestBar, { paddingBottom: 14 + safeBottom }]}>
          <Text style={styles.requestNotice}>
            {(other?.nickname ?? '') + t('chat.requested')}
          </Text>
          <View style={styles.requestBtnRow}>
            <TouchableOpacity style={[styles.requestBtn, styles.rejectBtn]} onPress={rejectRequest} activeOpacity={0.85}>
              <Text style={styles.rejectBtnText}>{t('chat.reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.requestBtn, styles.acceptBtn]} onPress={acceptRequest} activeOpacity={0.85}>
              <Text style={styles.acceptBtnText}>{t('chat.accept')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : status === 'pending' && isRequester ? (
        // Requester: input bar plus a note before sending, just the waiting note afterwards
        messages.some(m => String(m.senderId) === String(me?.id)) ? (
          <View style={[styles.pendingBar, { paddingBottom: 14 + safeBottom }]}>
            <Text style={styles.pendingText}>
              {t('chat.pendingNotice')}
            </Text>
          </View>
        ) : (
          <View>
            <View style={styles.pendingBar}>
              <Text style={styles.pendingText}>
                {t('chat.onlyOneMsg')}
              </Text>
            </View>
            <View style={[styles.inputBar, { paddingBottom: inputBarBottomPad }]}>
              <TextInput
                testID="chat-input"
                style={styles.input}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                testID="chat-send"
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!text.trim() || sending}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : otherDeleted ? (
        // The other party deleted their account — no new request possible
        <View style={[styles.leftBar, { paddingBottom: 16 + safeBottom }]}>
          <Text style={styles.leftText}>{t('chat.otherDeleted')}</Text>
          <Text style={styles.leftHint}>{t('chat.otherDeletedHint')}</Text>
        </View>
      ) : otherLeft ? (
        // The other party left the room — a new request is possible
        <View style={[styles.leftBar, { paddingBottom: 16 + safeBottom }]}>
          <Text style={styles.leftText}>{t('chat.otherLeft')}</Text>
          <Text style={styles.leftHint}>{t('chat.otherLeftHint')}</Text>
          <TouchableOpacity style={styles.requestAgainBtn} onPress={handleRequestAgain} activeOpacity={0.8}>
            <Text style={styles.requestAgainText}>{t('chat.requestAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Ordinary input bar
        <View style={[styles.inputBar, { paddingBottom: inputBarBottomPad }]}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            testID="chat-send"
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Keeps the last message from being clipped — enough room above the input bar
  listContent: { padding: 12, gap: 6, paddingBottom: 20 },


  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 1 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start', gap: 6 },
  avatarPlaceholder: { width: 8 },
  avatarSpacer: { width: 28 },

  // KakaoTalk style: sender name above the bubble, timestamp beside it (outside)
  bubbleColumn: { maxWidth: '78%' },
  bubbleColumnLeft: { alignItems: 'flex-start' },
  bubbleColumnRight: { alignItems: 'flex-end' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleSender: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4, paddingHorizontal: 4 },
  senderLeader: { marginLeft: 1 },
  bubbleText: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },

  // Timestamp box outside the bubble
  timeBox: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 3,
    marginBottom: 2,
  },
  bubbleTime: { fontSize: 10, color: colors.textSecondary },
  unreadBadge: { fontSize: 10, color: colors.primary, fontWeight: '700' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.primary + '55' },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Message request accept/decline bar
  requestBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestNotice: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  requestBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  requestBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: colors.inputBg,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  pendingBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pendingText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  leftBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  leftText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  leftHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  requestAgainBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  requestAgainText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
