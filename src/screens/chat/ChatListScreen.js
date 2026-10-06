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
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getToken } from '../../lib/storage';
import { API_BASE_URL } from '../../lib/config';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/EmptyState';
import { useLang } from '../../context/LangContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../lib/time';

export default function ChatListScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const { user: me } = useAuth();
  const { on, off } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  // Open on the 'requests' tab when arriving from a message-request notification
  const [tab, setTab] = useState(route?.params?.initialBox === 'requests' ? 'requests' : 'chats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Keep the tab in sync when the notification sends a fresh param
  useEffect(() => {
    if (route?.params?.initialBox === 'requests') {
      setTab('requests');
    }
  }, [route?.params?.initialBox]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  // Live: a new message refreshes the chat list
  useEffect(() => {
    on('chat_notification', 'chatList', (data) => {
      // Move that room to the top and update its preview
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
        // Reload the whole list when the room is new
        loadAll();
        return prev;
      });
    });

    // Live: when the other party leaves, change the preview to say so
    on('room_left', 'chatList', ({ roomId }) => {
      setRooms(prev => prev.map(r => {
        if (String(r.id) === String(roomId)) {
          return { ...r, lastMessage: t('chat.otherLeft'), otherLeft: true };
        }
        return r;
      }));
    });

    // Live: messages read → zero out that room's unread count
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
    // School-wide chat
    if (item.kind === 'school') {
      const s = item.school || {};
      return (
        <TouchableOpacity
          testID="chat-room-card"
          style={styles.roomCard}
          onPress={() => navigation.navigate('ChatRoom', {
            roomId: item.id,
            kind: 'school',
            group: { id: null, name: s.name, coverImage: '', memberCount: s.memberCount },
          })}
          activeOpacity={0.8}
        >
          <View style={styles.groupAvatarWrap}>
            <LinearGradient
              colors={['#7F77DD', '#5C52CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.groupAvatarGradient}
            >
              <Ionicons name="school" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.groupAvatarBadge}>
              <Ionicons name="school" size={9} color="#fff" />
            </View>
          </View>
          <View style={styles.roomInfo}>
            <View style={styles.roomTop}>
              <Text style={styles.roomNick} numberOfLines={1}>{s.name || '학교 채팅'}</Text>
              <Text style={styles.roomTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.roomBottom}>
              <Text style={styles.roomLast} numberOfLines={1}>
                {item.lastMessage || `${s.memberCount || 0}명의 학교 채팅`}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Group chat
    if (item.kind === 'group') {
      const g = item.group || {};
      // Initial from the first letter of the group name — the fallback when there is no cover
      const initial = (g.name || '').trim().charAt(0).toUpperCase();
      // A stable gradient derived from the group name (the same group always gets the same colours)
      const palettes = [
        ['#A78BFA', '#7C3AED'], // purple
        ['#60A5FA', '#2563EB'], // blue
        ['#34D399', '#059669'], // emerald
        ['#FB7185', '#E11D48'], // rose
        ['#FBBF24', '#D97706'], // amber
        ['#F472B6', '#DB2777'], // pink
        ['#22D3EE', '#0891B2'], // cyan
      ];
      const hash = (g.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const gradient = palettes[hash % palettes.length];

      return (
        <TouchableOpacity
          testID="chat-room-card"
          style={styles.roomCard}
          onPress={() => navigation.navigate('ChatRoom', {
            roomId: item.id, kind: 'group', group: g,
          })}
          activeOpacity={0.8}
        >
          <View style={styles.groupAvatarWrap}>
            {g.coverImage ? (
              <Image source={{ uri: g.coverImage }} style={styles.groupAvatarImg} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.groupAvatarGradient}
              >
                {initial ? (
                  <Text style={styles.groupAvatarInitial}>{initial}</Text>
                ) : (
                  <Ionicons name="people" size={20} color="#fff" />
                )}
              </LinearGradient>
            )}
            {/* Small badge marking a group */}
            <View style={styles.groupAvatarBadge}>
              <Ionicons name="people" size={9} color="#fff" />
            </View>
          </View>
          <View style={styles.roomInfo}>
            <View style={styles.roomTop}>
              <Text style={styles.roomNick} numberOfLines={1}>{g.name || '모임 채팅'}</Text>
              <Text style={styles.roomTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.roomBottom}>
              <Text style={styles.roomLast} numberOfLines={1}>
                {item.lastMessage || `${g.memberCount || 0}명의 모임 채팅방`}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // DM
    return (
      <Swipeable
        ref={ref => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={() => renderRightActions(item.id)}
        overshootRight={false}
      >
        <TouchableOpacity
          testID="chat-room-card"
          style={styles.roomCard}
          onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, other: item.other, status: item.status, isRequester: item.isRequester, otherLeft: item.otherLeft, otherDeleted: item.otherDeleted })}
          activeOpacity={0.8}
        >
          <TouchableOpacity
            onPress={() => {
              if (item.otherDeleted || item.other?.anonymous || !item.other?.id) return;
              navigation.navigate('UserProfile', { userId: item.other.id });
            }}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            disabled={item.otherDeleted || item.other?.anonymous || !item.other?.id}
          >
            <Avatar nickname={item.other?.nickname ?? '?'} uri={item.other?.avatarUrl} size={46} showLetter />
          </TouchableOpacity>
          <View style={styles.roomInfo}>
            <View style={styles.roomTop}>
              <Text style={[styles.roomNick, (item.otherDeleted || item.otherLeft) && { color: colors.textSecondary }]}>
                {item.otherDeleted
                  ? t('chat.deletedUser')
                  : (item.other?.nickname ?? t('chat.deletedUser'))}
              </Text>
              <Text style={styles.roomTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.roomBottom}>
              <Text style={[styles.roomLast, (item.otherLeft || item.otherDeleted) && { color: colors.danger ?? '#E64545' }]} numberOfLines={1}>
                {item.otherDeleted
                  ? t('chat.otherDeleted')
                  : item.otherLeft
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
      {/* Tabs */}
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
          tab === 'chats' ? (
            <EmptyState
              icon="chatbubbles-outline"
              title={t('emptyState.noChats')}
              description={t('emptyState.noChatsCta')}
            />
          ) : (
            <EmptyState
              icon="mail-unread-outline"
              title={t('emptyState.noChatRequests')}
            />
          )
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
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, gap: 4,
  },
  swipeDeleteText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  groupAvatarWrap: {
    width: 46, height: 46, position: 'relative',
  },
  groupAvatarImg: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.inputBg,
  },
  groupAvatarGradient: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  groupAvatarInitial: {
    fontSize: 18, fontWeight: '800', color: '#fff',
    letterSpacing: -0.4,
  },
  groupAvatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
});
