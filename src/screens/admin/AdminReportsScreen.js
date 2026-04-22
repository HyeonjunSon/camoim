import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getAdminReports, resolveReport, dismissReport } from '../../lib/api';
import { useLang } from '../../context/LangContext';

export default function AdminReportsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const TABS = [
    { key: 'pending',   label: t('admin.rpWaiting') },
    { key: 'resolved',  label: t('admin.rpDone') },
    { key: 'dismissed', label: t('admin.rpDismissed') },
  ];

  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminReports(tab);
      if (res.success) setItems(res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onResolve = (id) => {
    Alert.alert(t('admin.rpDeleteTarget'), t('admin.rpDeleteAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try { await resolveReport(id); load(); } catch {}
        },
      },
    ]);
  };

  const onDismiss = async (id) => {
    try { await dismissReport(id); load(); } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb.key}
            style={[styles.tab, tab === tb.key && styles.tabActive]}
            onPress={() => setTab(tb.key)}
          >
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{tb.label}</Text>
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
          ListEmptyComponent={<Text style={styles.empty}>{t('admin.rpNoReports')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.target} numberOfLines={2}>{item.targetPreview}</Text>
              <Text style={styles.reason}>{item.reason}</Text>
              {!!item.detail && <Text style={styles.detail}>"{item.detail}"</Text>}
              <Text style={styles.meta}>{item.reporterNickname} · {new Date(item.createdAt).toLocaleDateString()}</Text>
              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.delBtn} onPress={() => onResolve(item.id)}>
                    <Text style={styles.delText}>{t('admin.rpDeleteAction')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.disBtn} onPress={() => onDismiss(item.id)}>
                    <Text style={styles.disText}>{t('admin.rpDismissAction')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
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
  target: { fontSize: 14, fontWeight: '700', color: colors.text },
  reason: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 6 },
  detail: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  delBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.danger + '15', borderRadius: 8 },
  delText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  disBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.inputBg, borderRadius: 8 },
  disText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
