import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { Text, TextInput } from '../../components/StyledText';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminGetLogs } from '../../lib/api';

export default function AdminLogsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const nextPage = reset ? 1 : page;
      const res = await adminGetLogs({ action: q, page: nextPage });
      if (res.success) {
        setItems(reset ? res.data.logs : [...items, ...res.data.logs]);
        setPages(res.data.pages);
        setPage(nextPage);
      }
    } catch {} finally { setLoading(false); }
  }, [q, page, items]);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(true); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [q]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="액션 필터 (예: user.suspend)"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && page < pages) {
            setPage(page + 1);
            load(false);
          }
        }}
        ListEmptyComponent={!loading && <Text style={styles.empty}>로그 없음</Text>}
        ListFooterComponent={loading && <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.action}>{item.action}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={styles.meta}>by {item.adminName || item.adminId}</Text>
            {item.targetType ? (
              <Text style={styles.meta}>{item.targetType}: {item.targetId}</Text>
            ) : null}
            {item.meta && Object.keys(item.meta).length > 0 ? (
              <Text style={styles.metaJson}>{JSON.stringify(item.meta)}</Text>
            ) : null}
          </View>
        )}
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
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontSize: 13, fontWeight: '700', color: colors.primary },
  date: { fontSize: 11, color: colors.textSecondary },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  metaJson: {
    fontSize: 10, color: colors.textSecondary, marginTop: 6,
    backgroundColor: colors.inputBg, borderRadius: 6, padding: 8, fontFamily: 'monospace',
  },
});
