import { useState, useCallback } from 'react';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getAdminVerifyRequests } from '../../lib/api';

const TABS = [
  { key: 'pending',  label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '거절' },
];

const STATUS_COLOR = {
  pending:  { bg: '#FFF8E1', text: '#F59E0B' },
  approved: { bg: '#E8FFF1', text: '#2D9E5A' },
  rejected: { bg: '#FFF0F0', text: '#EF4444' },
};

export default function AdminVerifyScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminVerifyRequests(tab);
      if (res.success) setItems(res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
          ListEmptyComponent={<Text style={styles.empty}>요청 없음</Text>}
          renderItem={({ item }) => {
            const sc = STATUS_COLOR[item.status] ?? STATUS_COLOR.pending;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('AdminDetail', { request: item })}
                activeOpacity={0.8}
              >
                <View style={styles.row}>
                  <View>
                    <Text style={styles.nick}>{item.nickname}</Text>
                    <Text style={styles.sub}>{item.email}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.text }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.meta}><Ionicons name="business" size={11} color={colors.textSecondary} /> {item.university} · {item.studentType}</Text>
                <Text style={styles.meta}><Ionicons name="calendar" size={11} color={colors.textSecondary} /> {new Date(item.createdAt).toLocaleDateString()}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nick: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
