import { useState, useCallback, useRef, useEffect } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
  RefreshControl,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getToken } from '../../lib/storage';
import { API_BASE_URL } from '../../lib/config';
import Avatar from '../../components/common/Avatar';
import { useLang } from '../../context/LangContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../lib/time';

export default function ChatListScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const { user: me } = useAuth();
  const { on, off } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('chats'); // chats | requests
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  // 실시간: 새 메시지 → 채팅 목록 갱신
  useEffect(() => {
    on('chat_notification', 'chatList', (data) => {
      // 목록에서 해당 방을 맨 위로 + 미리보기 업데이트
      setRooms(prev => {
        const idx = prev.findIndex(r => String(r.id) === String(data.roomId));
        if (idx >= 0) {
          const updated = { ...prev[idx] };
          updated.lastMessage = data.content;
          updated.lastMessageAt = new Date().toISOString();
          updated.unreadCount = (updated.unreadCount ?? 0) + 1;
          const rest = prev.filter((_, i) => i !== idx);
          return [updated, ...rest];
        }
        // 새 방이면 전체 목록 다시 로드
        loadAll();
        return prev;
      });
    });

    // 실시간: 상대방이 나간 경우 → 미리보기를 "상대방이 나갔습니다"로 변경
    on('room_left', 'chatList', ({ roomId }) => {
      setRooms(prev => prev.map(r => {
        if (String(r.id) === String(roomId)) {
          return { ...r, lastMessage: t('chat.otherLeft'), otherLeft: true };
        }
        return r;
      }));
    });

    // 실시간: 메시지 읽음 → 해당 방의 unread 0으로
    on('messages_read', 'chatList', ({ roomId, readerId }) => {
      if (String(readerId) === String(me?.id)) {
        setRooms(prev => prev.map(r => {
          if (String(r.id) === String(roomId)) {
            return { ...r, unreadCount: 0 };
          }
          return r;
        }));
      }
    });

    return () => {
      off('chat_notification', 'chatList');
      off('room_left', 'chatList');
      off('messages_read', 'chatList');
    };
  }, []);

  async function loadAll() {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [aRes, rRes] = await Promise.all([
        fetch(`${API_BASE_URL}/chats?box=accepted`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/chats?box=requests`, { headers }).then(r => r.json()),
      ]);
      if (aRes.success) setRooms(aRes.data);
      if (rRes.success) setRequests(rRes.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
  }

  const swipeableRefs = useRef({});

  async function deleteRoom(roomId) {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/chats/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        setRequests(prev => prev.filter(r => r.id !== roomId));
      }
    } catch {}
  }

  function confirmDelete(roomId) {
    swipeableRefs.current[roomId]?.close();
    Alert.alert(
      t('chat.deleteTitle'),
      t('chat.deleteAsk'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteRoom(roomId) },
      ]
    );
  }

  function renderRightActions(roomId) {
    return (
      <TouchableOpacity
        style={styles.swipeDelete}
        onPress={() => confirmDelete(roomId)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
      </TouchableOpacity>
    );
  }

  function renderRoom({ item }) {
    return (
      <Swipeable
        ref={ref => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={() => renderRightActions(item.id)}
        overshootRight={false}
      >
        <TouchableOpacity
          style={styles.roomCard}
          onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, other: item.other, status: item.status, isRequester: item.isRequester, otherLeft: item.otherLeft })}
          activeOpacity={0.8}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: item.other?.id })}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Avatar nickname={item.other?.nickname ?? '?'} uri={item.other?.avatarUrl} size={46} showLetter />
          </TouchableOpacity>
          <View style={styles.roomInfo}>
            <View style={styles.roomTop}>
              <Text style={styles.roomNick}>{item.other?.nickname ?? t('common.notFound')}</Text>
              <Text style={styles.roomTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.roomBottom}>
              <Text style={[styles.roomLast, item.otherLeft && { color: colors.danger ?? '#E64545' }]} numberOfLines={1}>
                {item.otherLeft
                  ? t('chat.otherLeft')
                  : item.status === 'pending' && item.isRequester
                    ? t('chat.waitingAccept')
                    : (item.lastMessage || t('chat.startConv'))}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  const data = tab === 'chats' ? rooms : requests;

  return (
    <View style={styles.container}>
      {/* 탭 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'chats' && styles.tabBtnActive]}
          onPress={() => setTab('chats')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'chats' && styles.tabTextActive]}>{t('chat.tabChats')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            {t('chat.tabRequests')}{requests.length > 0 ? ` (${requests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        renderItem={renderRoom}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {tab === 'chats' ? t('chat.empty') : t('chat.requestEmpty')}
            </Text>
            {tab === 'chats' && (
              <Text style={styles.emptySubText}>{t('chat.emptyHint')}</Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  roomInfo: { flex: 1 },
  roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomNick: { fontSize: 15, fontWeight: '700', color: colors.text },
  roomTime: { fontSize: 11, color: colors.textSecondary },
  roomBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roomLast: { flex: 1, fontSize: 13, color: colors.textSecondary },
  unreadBadge: {
    backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8,
  },
  unreadText: { fontSize: 10, fontWeight: '800', color: colors.white },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 74 },
  emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600', marginTop: 20 },
  emptySubText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  swipeDelete: {
    backgroundColor: '#E53935', justifyContent: 'center', alignItems: 'center',
    width: 80, gap: 4,
  },
  swipeDeleteText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});
