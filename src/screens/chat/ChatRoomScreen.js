import { useState, useEffect, useRef } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useSocket } from '../../context/SocketContext';
import { getToken } from '../../lib/storage';
import { API_BASE_URL } from '../../lib/config';
import Avatar from '../../components/common/Avatar';

export default function ChatRoomScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, other, group } = route.params;
  const isGroupChat = route.params?.kind === 'group' || !!group;
  const { user: me } = useAuth();
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
  const { on, off, emit, joinRoom, leaveRoom, setActiveRoom } = useSocket();
  const flatListRef = useRef(null);

  // 헤더 — DM은 상대방 이름, 그룹은 모임명
  useEffect(() => {
    if (isGroupChat) {
      navigation.setOptions({
        title: group?.name || t('chat.tabChats'),
        headerRight: () => (
          group?.id ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="그룹 정보 보기"
            >
              <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>그룹</Text>
            </TouchableOpacity>
          ) : null
        ),
      });
    } else {
      navigation.setOptions({
        title: otherDeleted ? t('chat.deletedUser') : (other?.nickname ?? t('chat.tabChats')),
        headerRight: () => (
          otherDeleted || !other?.id ? null : (
            <TouchableOpacity
              onPress={() => navigation.push('UserProfile', { userId: other?.id })}
              activeOpacity={0.7}
              style={{ marginRight: 4 }}
            >
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>{t('chat.profile')}</Text>
            </TouchableOpacity>
          )
        ),
      });
    }
  }, [other, otherDeleted, group, isGroupChat]);

  // 메시지 불러오기 + 글로벌 소켓 이벤트 등록
  useEffect(() => {
    async function loadMessages() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/chats/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.data);
          if (data.otherLeft) setOtherLeft(true);
          if (data.otherDeleted) setOtherDeleted(true);
        }
      } catch {}
      finally { setLoading(false); }
    }

    loadMessages();

    // 글로벌 소켓으로 방 입장 + 읽음 처리
    joinRoom(roomId);
    setActiveRoom(roomId);
    emit('read_messages', { roomId });

    // 새 메시지 수신 (이 방 것만 처리)
    on('new_message', `chatRoom_${roomId}`, (msg) => {
      if (String(msg.roomId) !== String(roomId)) return;
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      if (String(msg.senderId) !== String(me?.id)) {
        emit('read_messages', { roomId });
      }
    });

    // 상대방이 읽었을 때
    on('messages_read', `chatRoom_${roomId}`, ({ readerId, roomId: rid }) => {
      if (rid && String(rid) !== String(roomId)) return;
      setMessages(prev => prev.map(m => {
        if (!m.readBy?.includes(readerId)) {
          return { ...m, readBy: [...(m.readBy ?? []), readerId] };
        }
        return m;
      }));
    });

    // 상대방이 나간 경우 실시간 감지
    on('room_left', `chatRoom_${roomId}`, ({ roomId: rid }) => {
      if (String(rid) !== String(roomId)) return;
      setOtherLeft(true);
    });

    // 전송 에러
    on('send_error', `chatRoom_${roomId}`, (err) => {
      Alert.alert(t('chat.sendFailed'), err?.message ?? t('common.error'));
    });

    return () => {
      leaveRoom(roomId);
      setActiveRoom(null);
      off('new_message', `chatRoom_${roomId}`);
      off('messages_read', `chatRoom_${roomId}`);
      off('room_left', `chatRoom_${roomId}`);
      off('send_error', `chatRoom_${roomId}`);
    };
  }, [roomId]);

  function sendMessage() {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    setSending(true);
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
        // 새 채팅방으로 이동
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
    // 1:1 채팅에서 상대가 아직 안 읽었으면 "1" 표시 (그룹은 표시 안 함)
    const unreadCount = (!isGroupChat && isMine && item.readBy)
      ? (item.readBy.some(id => String(id) === String(other?.id)) ? 0 : 1)
      : 0;
    const senderName = item.senderNickname || (other?.nickname ?? '');

    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMine && (
          showAvatar
            ? <Avatar nickname={senderName || '?'} uri={isGroupChat ? null : other?.avatarUrl} size={30} showLetter />
            : <View style={styles.avatarSpacer} />
        )}
        {isMine && unreadCount > 0 && (
          <Text style={styles.unreadBadge}>{unreadCount}</Text>
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {!isMine && showAvatar && (
            <Text style={styles.bubbleSender}>{senderName}</Text>
          )}
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
            {new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 + insets.bottom : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      />

      {/* 하단 영역: 상태에 따라 다름 */}
      {isGroupChat ? (
        // 그룹 채팅 — 항상 입력 바
        <View style={styles.inputBar}>
          <TextInput
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
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendBtnText}>{t('common.send')}</Text>
          </TouchableOpacity>
        </View>
      ) : status === 'pending' && !isRequester ? (
        // 수신자: 수락/거절 버튼
        <View style={styles.requestBar}>
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
        // 요청자: 아직 메시지 안 보냈으면 입력바 + 안내, 보냈으면 대기 안내만
        messages.some(m => String(m.senderId) === String(me?.id)) ? (
          <View style={styles.pendingBar}>
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
            <View style={styles.inputBar}>
              <TextInput
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
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!text.trim() || sending}
                activeOpacity={0.8}
              >
                <Text style={styles.sendBtnText}>{t('common.send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : otherDeleted ? (
        // 상대방이 계정 탈퇴한 경우 — 재요청 불가
        <View style={styles.leftBar}>
          <Text style={styles.leftText}>{t('chat.otherDeleted')}</Text>
          <Text style={styles.leftHint}>{t('chat.otherDeletedHint')}</Text>
        </View>
      ) : otherLeft ? (
        // 상대방이 채팅방에서 나간 경우 — 재요청 가능
        <View style={styles.leftBar}>
          <Text style={styles.leftText}>{t('chat.otherLeft')}</Text>
          <Text style={styles.leftHint}>{t('chat.otherLeftHint')}</Text>
          <TouchableOpacity style={styles.requestAgainBtn} onPress={handleRequestAgain} activeOpacity={0.8}>
            <Text style={styles.requestAgainText}>{t('chat.requestAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // 일반 입력 바
        <View style={styles.inputBar}>
          <TextInput
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
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendBtnText}>{t('common.send')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, gap: 6, paddingBottom: 8 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start', gap: 6 },
  avatarPlaceholder: { width: 8 },
  avatarSpacer: { width: 30 },

  bubble: {
    maxWidth: '75%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
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
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.textSecondary, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  unreadBadge: {
    fontSize: 11, color: colors.primary, fontWeight: '700',
    alignSelf: 'flex-end', marginRight: 4, marginBottom: 4,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // 메시지 요청 수락/거절 바
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
