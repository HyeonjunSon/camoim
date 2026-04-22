import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { getMyInquiries } from '../../lib/api';

export default function MyInquiriesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyInquiries();
      if (res.success) setItems(res.data ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }) => {
    const answered = item.status === 'answered';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('InquiryDetail', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.row}>
          <View style={[styles.badge, answered ? styles.badgeAnswered : styles.badgeOpen]}>
            <Text style={[styles.badgeText, answered ? { color: '#10B981' } : { color: colors.primary }]}>
              {t(answered ? 'inquiry.stAnswered' : 'inquiry.stOpen')}
            </Text>
          </View>
          <Text style={styles.cat}>{t(`inquiry.c_${item.category}`)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.inputBg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
      data={items}
      keyExtractor={(it) => String(it.id)}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('inquiry.myEmpty')}</Text>
        </View>
      }
    />
  );
}

const createStyles = (colors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeAnswered: { backgroundColor: '#10B981' + '15' },
  badgeOpen: { backgroundColor: colors.primary + '15' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cat: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  date: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
});
