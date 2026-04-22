import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../lib/api';
import { useLang } from '../../context/LangContext';
import { formatTime } from '../../lib/time';

const TYPE_META = {
  comment: { icon: '💬', labelKey: 'notif.catComment', color: '#6366F1', bg: '#EEF2FF' },
  like:    { icon: '❤️', labelKey: 'notif.catLike',    color: '#EF4444', bg: '#FEF2F2' },
  chat:    { icon: '✉️', labelKey: 'notif.catChat',    color: '#8B5CF6', bg: '#F5F3FF' },
};

function NotificationCard({ item, onPress, t, styles }) {
  const meta = TYPE_META[item.type] ?? { icon: '🔔', labelKey: 'notif.catDefault', color: '#6B7280', bg: '#F3F4F6' };

  return (
    <TouchableOpacity
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* 아이콘 */}
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Text style={styles.iconText}>{meta.icon}</Text>
      </View>

      {/* 본문 */}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.categoryLabel, { color: meta.color }]}>{t(meta.labelKey)}</Text>
          <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
          {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
        </View>
        <Text style={[styles.cardMsg, !item.isRead && styles.cardMsgBold]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const FILTERS = [
    { key: 'all',     label: t('notif.filterAll') },
    { key: 'comment', label: t('notif.filterComment') },
    { key: 'like',    label: t('notif.filterLike') },
    { key: 'chat',    label: t('notif.filterChat') },
  ];
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await getNotifications();
      if (res.success) setNotifications(res.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadNotifications(); }, [loadNotifications]));

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  }

  async function handlePress(notification) {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      } catch {}
    }

    if (notification.type === 'chat' && notification.roomId) {
      navigation.navigate('Chat', { screen: 'ChatList' });
    } else if (notification.postId) {
      navigation.navigate('Home', { screen: 'PostDetail', params: { postId: notification.postId } });
    }
  }

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* 헤더 — 탭바에서 직접 접근 시만 표시 (스택에서 열리면 네이티브 헤더 사용) */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 4 : 16 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('notif.title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
          <Text style={styles.markAllText}>{t('notif.markAllRead')}</Text>
        </TouchableOpacity>
      </View>

      {/* 필터 칩 */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => {
            const count = f.key === 'all'
              ? notifications.filter(n => !n.isRead).length
              : notifications.filter(n => n.type === f.key && !n.isRead).length;
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                {count > 0 && !active && (
                  <View style={styles.chipDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <NotificationCard item={item} onPress={handlePress} t={t} styles={styles} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('notif.empty')}</Text>
            </View>
          }
          ListFooterComponent={
            filtered.length > 0
              ? <Text style={styles.footerText}>{t('notif.footer')}</Text>
              : null
          }
          contentContainerStyle={filtered.length === 0 ? { flexGrow: 1 } : { paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerBadge: {
    backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  headerBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
  markAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  filterWrap: { paddingBottom: 8 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },
  chipDot: {
    position: 'absolute', top: 6, right: 6,
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger,
  },
  card: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  cardUnread: { backgroundColor: colors.primary + '06' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryLabel: { fontSize: 11, fontWeight: '700' },
  cardTime: { fontSize: 11, color: colors.textSecondary },
  unreadDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 'auto' },
  cardMsg: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  cardMsgBold: { fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  footerText: { textAlign: 'center', fontSize: 12, color: colors.textSecondary, paddingVertical: 16 },
});
