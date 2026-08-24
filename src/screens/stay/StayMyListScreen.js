// 내가 등록한 숙소 목록 — 마이페이지에서 진입. 탭 → 숙소 상세(수정/입주완료/삭제).
import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { stayTypeOf, STAY_ACCENT, formatPrice } from '../../constants/stays';
import { getMyStays } from '../../lib/api';

export default function StayMyListScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [stays, setStays] = useState(null); // null = 로딩
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyStays();
      if (res.success) setStays(res.data || []);
      else setStays([]);
    } catch {
      setStays([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item: s }) => {
    const c = stayTypeOf(s.stayType);
    const closed = s.status === 'closed';
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('StayDetail', { id: s.id, stay: s })}>
        <View style={[styles.emoji, { backgroundColor: c.soft }]}>
          <Ionicons name={c.ion} size={22} color={c.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={styles.rowCenter}>
            <Text style={[styles.name, closed && { color: colors.textSecondary }]} numberOfLines={1}>{s.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: closed ? colors.inputBg : '#E8FFF1' }]}>
              <Text style={[styles.statusText, { color: closed ? colors.textSecondary : '#2D9E5A' }]}>
                {closed ? t('stay.statusClosed') : t('stay.statusActive')}
              </Text>
            </View>
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            <Text style={styles.price}>{formatPrice(s.price)}{t('stay.perMonth')}</Text>
            {s.neighborhood ? ` · ${s.neighborhood}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <CustomHeader navigation={navigation} title={t('mypage.myStays')} />
      {stays === null ? (
        <View style={styles.center}><ActivityIndicator size="large" color={STAY_ACCENT} /></View>
      ) : (
        <FlatList
          data={stays}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={STAY_ACCENT} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bed-outline" size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>{t('mypage.noMyStays')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  emoji: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  statusBadge: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.textSecondary },
  price: { fontSize: 13, fontWeight: '800', color: STAY_ACCENT },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
});
