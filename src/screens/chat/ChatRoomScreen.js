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
import CustomHeader from '../../components/CustomHeader';

export default function ChatRoomScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, other, group } = route.params;
  // group/school 모두 N명 채팅이라 동일 UI 패턴 사용
  const isGroupChat = route.params?.kind === 'group' || route.params?.kind === 'school' || !!group;
  const isSchoolChat = route.params?.kind === 'school';
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
  const [schoolLeaderId, setSchoolLeaderId] = useState(null);
  // 키보드 가시성 추적 — 키보드 열렸을 때는 safe-area inset 제외해서 입력바와 키보드 사이 여백 제거
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);
  const inputBarBottomPad = 8 + (keyboardVisible ? 0 : insets.bottom);
  const { on, off, emit, joinRoom, leaveRoom, setActiveRoom } = useSocket();
  const flatListRef = useRef(null);

  // 헤더 — DM/그룹 모두 native 끄고 커스텀 헤더 사용 (iOS native bar의
  // 좌/우 버튼 자동 캡슐 래핑이 우리 캡슐과 충돌해 이중 동그라미가 보였음)
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, []);

  // 메시지 불러오기 + 소켓 — 포커스마다 재실행해 stale/empty 응답 자동 복구
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
    // 그룹/학교 채팅에서만 sender 프로필 탭 허용 (탈퇴/null sender 가드)
    const canTapSender = isGroupChat && !isMine && !!item.senderId;
    const openSenderProfile = () => {
      if (canTapSender) navigation.push('UserProfile', { userId: String(item.senderId) });
    };
    // 학교 채팅에서 발신자가 그 학교 학생회장이면 ⭐ 배지
    const senderIsLeader = isSchoolChat && !!schoolLeaderId && String(item.senderId) === schoolLeaderId;

    // 같은 발신자가 연속 메시지면 시간 표시 압축 — 같은 분 안의 마지막 메시지에만 시간 노출 (카톡 스타일)
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

    // 발신자 이름 (그룹/학교 채팅, 같은 발신자가 처음 등장할 때만)
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
            {/* 내 메시지: 시간이 버블 좌측 */}
            {isMine && showTime && (
              <View style={styles.timeBox}>
                {unreadCount > 0 && <Text style={styles.unreadBadge}>{unreadCount}</Text>}
                <Text style={styles.bubbleTime}>{timeStr}</Text>
              </View>
            )}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text selectable style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
            </View>
            {/* 상대 메시지: 시간이 버블 우측 */}
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

  // 커스텀 채팅 헤더 — DM/그룹 모두 동일 디자인 (정중앙 제목 + iOS 26 글래스 캡슐)
  const headerTitle = isGroupChat
    ? (group?.name || t('chat.tabChats'))
    : (otherDeleted ? t('chat.deletedUser') : (other?.nickname ?? t('chat.tabChats')));
  // 학교 전체 채팅은 별도 detail 페이지 없음 → 우측 액션 숨김
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
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        // 콘텐츠 크기 변할 때 + 다음 frame에서 한번 더 — 변동성 있는 bubble 높이로
        // scrollToEnd가 layout 잡히기 전에 실행돼 마지막 메시지가 잘리는 문제 회피
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          });
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* 하단 영역: 상태에 따라 다름 */}
      {isGroupChat ? (
        // 그룹 채팅 — 항상 입력 바
        <View style={[styles.inputBar, { paddingBottom: inputBarBottomPad }]}>
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
            <Ionicons name="arrow-up" size={22} color={colors.white} />
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
            <View style={[styles.inputBar, { paddingBottom: inputBarBottomPad }]}>
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
                <Ionicons name="arrow-up" size={22} color={colors.white} />
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
        <View style={[styles.inputBar, { paddingBottom: inputBarBottomPad }]}>
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
  // 마지막 메시지 잘림 방지 — 입력바 위에 충분한 여백
  listContent: { padding: 12, gap: 6, paddingBottom: 20 },


  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 1 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start', gap: 6 },
  avatarPlaceholder: { width: 8 },
  avatarSpacer: { width: 28 },

  // 카톡 스타일: 발신자 이름은 버블 위, 시간은 버블 옆 (밖)
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

  // 버블 밖 시간 박스
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
