import { useState, useCallback, useMemo } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../lib/api';
import { useLang } from '../../context/LangContext';
import { formatTime } from '../../lib/time';
import EmptyState from '../../components/EmptyState';

// Icon, background and accent per notification type — keeps the design consistent
const buildTypeMeta = (colors) => ({
  comment: {
    iconName: 'chatbubble-ellipses',
    bg: '#DBEAFE',         // Light blue
    color: '#2563EB',
    labelKey: 'notif.catComment',
  },
  reply: {
    iconName: 'arrow-undo',
    bg: '#E0E7FF',         // Light indigo
    color: '#4F46E5',
    labelKey: 'notif.catReply',
  },
  like: {
    iconName: 'heart',
    bg: '#FEE2E2',         // Light red
    color: '#DC2626',
    labelKey: 'notif.catLike',
  },
  chat: {
    iconName: 'mail',
    bg: '#EDE9FE',         // Light purple
    color: '#7C3AED',
    labelKey: 'notif.catChat',
  },
  chat_request: {
    iconName: 'chatbubble-ellipses-outline',
    bg: '#CFFAFE',         // Light cyan
    color: '#0891B2',
    labelKey: 'notif.catChatRequest',
  },
  university_leader: {
    iconName: 'school',
    bg: '#DCFCE7',         // Light green
    color: '#16A34A',
    labelKey: 'notif.catDefault',
  },
  group_approved: {
    iconName: 'people',
    bg: '#FEF3C7',         // Light yellow
    color: '#D97706',
    labelKey: 'notif.catDefault',
  },
  default: {
    iconName: 'notifications',
    bg: '#EDE9FE',         // Light purple
    color: '#7C3AED',
    labelKey: 'notif.catDefault',
  },
});

// Split the quoted part out of a comment message — the "...left a comment: 'xxx'" pattern
function splitCommentMessage(message) {
  if (!message) return { lead: '', quote: '' };
  const m = message.match(/^(.*?:\s*)["'"](.*)["'"]\s*$/s);
  if (m) return { lead: m[1].trim(), quote: m[2] };
  return { lead: message, quote: '' };
}

// Group notifications into today / yesterday / older date sections
function groupNotifications(notifs, t) {
  const todayLabel = t('time.today') || '오늘';
  const yesterdayLabel = t('time.yesterday') || '어제';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const today = [];
  const yesterday = [];
  const older = new Map(); // key: a date label, value: { sortKey, data }

  for (const n of notifs) {
    const ts = new Date(n.createdAt).getTime();
    if (ts >= todayStart) {
      today.push(n);
    } else if (ts >= yesterdayStart) {
      yesterday.push(n);
    } else {
      const d = new Date(n.createdAt);
      const key = `${d.getMonth() + 1}월 ${d.getDate()}일`;
      const sortKey = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      if (!older.has(key)) older.set(key, { sortKey, data: [] });
      older.get(key).data.push(n);
    }
  }

  const sections = [];
  if (today.length) sections.push({ title: todayLabel, data: today });
  if (yesterday.length) sections.push({ title: yesterdayLabel, data: yesterday });
  // Newest dates first
  Array.from(older.entries())
    .sort((a, b) => b[1].sortKey - a[1].sortKey)
    .forEach(([title, { data }]) => sections.push({ title, data }));

  return sections;
}

function NotificationCard({ item, onPress, t, styles, colors }) {
  const TYPE_META = buildTypeMeta(colors);
  const meta = TYPE_META[item.type] ?? TYPE_META.default;
  const { lead, quote } = (item.type === 'comment' || item.type === 'reply')
    ? splitCommentMessage(item.message)
    : { lead: item.message, quote: '' };

  return (
    <TouchableOpacity
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {/* Icon (circular background) */}
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.iconName} size={18} color={meta.color} />
        {!item.isRead && <View style={[styles.unreadDot, { borderColor: colors.surface }]} />}
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.categoryLabel, { color: meta.color }]}>{t(meta.labelKey)}</Text>
          <Text style={styles.cardTime}>{formatTime(item.createdAt, t)}</Text>
        </View>
        {quote ? (
          <Text style={styles.cardMsg} numberOfLines={3}>
            {lead}{' '}
            <Text style={styles.cardQuote}>&ldquo;{quote}&rdquo;</Text>
          </Text>
        ) : (
          <Text style={styles.cardMsg} numberOfLines={3}>{lead}</Text>
        )}
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

    if (notification.type === 'chat_request') {
      // Chat tab → the received-requests box (ChatList's box toggle opens on 'requests')
      navigation.navigate('Chat', { screen: 'ChatList', params: { initialBox: 'requests' } });
    } else if (notification.type === 'chat' && notification.roomId) {
      navigation.navigate('Chat', { screen: 'ChatList' });
    } else if (notification.postId) {
      navigation.navigate('Home', { screen: 'PostDetail', params: { postId: notification.postId } });
    }
  }

  // The 'comments' filter includes replies too
  const matchesFilter = (n, key) =>
    key === 'comment' ? (n.type === 'comment' || n.type === 'reply') : n.type === key;
  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => matchesFilter(n, filter));

  const sections = useMemo(() => groupNotifications(filtered, t), [filtered, t]);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 4 : 16 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('notif.title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7} hitSlop={8}>
          <Text style={styles.markAllText}>{t('notif.markAllRead')}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => {
            const count = f.key === 'all'
              ? notifications.filter(n => !n.isRead).length
              : notifications.filter(n => matchesFilter(n, f.key) && !n.isRead).length;
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
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={handlePress} t={t} styles={styles} colors={colors} />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={t('emptyState.noNotifications')}
              description={t('emptyState.noNotificationsCta')}
            />
          }
          ListFooterComponent={
            sections.length > 0
              ? <Text style={styles.footerText}>{t('notif.footer')}</Text>
              : null
          }
          contentContainerStyle={sections.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
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

  // Filter chips
  filterWrap: { paddingBottom: 12 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  chipDot: {
    position: 'absolute', top: 6, right: 6,
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger,
  },

  // Section header (today / yesterday / date)
  sectionHeader: {
    fontSize: 15, fontWeight: '800', color: colors.text,
    marginTop: 18, marginBottom: 10, paddingHorizontal: 4,
  },

  // Card
  card: {
    flexDirection: 'row', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: colors.surface, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  cardUnread: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '06',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary, borderWidth: 2,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  categoryLabel: { fontSize: 12, fontWeight: '700' },
  cardTime: { fontSize: 11, color: colors.textSecondary },
  cardMsg: { fontSize: 14, color: colors.text, lineHeight: 20 },
  cardQuote: { fontStyle: 'italic', color: colors.textSecondary },

  footerText: { textAlign: 'center', fontSize: 12, color: colors.textSecondary, paddingVertical: 16 },
});
