import { useState, useEffect, useCallback } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminListUsers } from '../../lib/api';
import { useLang } from '../../context/LangContext';

const STATUS_COLOR = {
  active:    { bg: '#E8FFF1', text: '#2D9E5A' },
  suspended: { bg: '#FFF8E1', text: '#F59E0B' },
  banned:    { bg: '#FFF0F0', text: '#EF4444' },
  deleted:   { bg: '#F3F4F6', text: '#9CA3AF' },
};

export default function AdminUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const STATUS_TABS = [
    { key: '',          label: t('admin.usAll') },
    { key: 'active',    label: t('admin.usActive') },
    { key: 'suspended', label: t('admin.usSuspended') },
    { key: 'banned',    label: t('admin.usBanned') },
    { key: 'deleted',   label: t('admin.usDeleted') },
  ];

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // pageToLoad를 명시적으로 받아 stale 클로저/루프 방지
  const load = useCallback(async (pageToLoad, reset) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const res = await adminListUsers({ q, status, page: pageToLoad });
      if (res.success) {
        setItems(prev => (reset ? res.data.users : [...prev, ...res.data.users]));
        setPages(res.data.pages);
        setPage(pageToLoad);
        setTotal(res.data.total ?? 0);
      }
    } catch {} finally {
      if (reset) setLoading(false); else setLoadingMore(false);
    }
  }, [q, status]);

  useEffect(() => {
    const id = setTimeout(() => load(1, true), 300);
    return () => clearTimeout(id);
  }, [q, status, load]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder={t('admin.usSearchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.tabBar}>
        {STATUS_TABS.map(tb => (
          <TouchableOpacity
            key={tb.key || 'all'}
            style={[styles.tab, status === tb.key && styles.tabActive]}
            onPress={() => setStatus(tb.key)}
          >
            <Text style={[styles.tabText, status === tb.key && styles.tabTextActive]}>{tb.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.countText}>{total}{t('admin.usTotal')}</Text>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(1, true)} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && !loadingMore && page < pages) {
            load(page + 1, false);
          }
        }}
        ListEmptyComponent={!loading && <Text style={styles.empty}>{t('admin.usNoUsers')}</Text>}
        ListFooterComponent={(loading || loadingMore) && <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />}
        renderItem={({ item }) => {
          const sc = STATUS_COLOR[item.status] ?? STATUS_COLOR.active;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('AdminUserDetail', { userId: item.id })}
              activeOpacity={0.8}
            >
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nickRow}>
                    <Text style={styles.nick}>{item.nickname}</Text>
                    {item.role === 'admin' && <Text style={styles.adminTag}>ADMIN</Text>}
                    {item.shadowBanned && <Text style={styles.shadowTag}>SHADOW</Text>}
                  </View>
                  <Text style={styles.email}>{item.email}</Text>
                  <Text style={styles.meta}>
                    {item.role} · {item.city || '-'} · {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                  {item.status === 'deleted' && item.deletedAt && (
                    <Text style={styles.meta}>
                      {t('admin.usDeleted')}: {new Date(item.deletedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.text }]}>{item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, marginBottom: 4, paddingHorizontal: 12, height: 42,
    backgroundColor: colors.surface, borderRadius: 10,
  },
  search: { flex: 1, fontSize: 14, color: colors.text },
  tabBar: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 6, gap: 6,
  },
  countText: {
    paddingHorizontal: 16, paddingBottom: 6,
    fontSize: 12, color: colors.textSecondary, textAlign: 'right',
  },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary + '18', borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nick: { fontSize: 14, fontWeight: '700', color: colors.text },
  adminTag: {
    fontSize: 10, fontWeight: '800', color: colors.primary,
    backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  shadowTag: {
    fontSize: 10, fontWeight: '800', color: '#F59E0B',
    backgroundColor: '#F59E0B' + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  email: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
