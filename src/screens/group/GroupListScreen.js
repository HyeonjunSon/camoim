import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import EmptyState from '../../components/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { getGroups } from '../../lib/api';

const CATEGORIES = [
  { key: 'all', labelKey: 'group.categoryAll' },
  { key: 'hobby', labelKey: 'group.catHobby' },
  { key: 'study', labelKey: 'group.catStudy' },
  { key: 'local', labelKey: 'group.catLocal' },
  { key: 'job', labelKey: 'group.catJob' },
  { key: 'workinghol', labelKey: 'group.catWorkinghol' },
  { key: 'general', labelKey: 'group.catGeneral' },
];

const CATEGORY_META = {
  hobby:      { bg: '#FEF3C7', emoji: '🎨' },
  study:      { bg: '#EFF6FF', emoji: '📚' },
  local:      { bg: '#ECFDF5', emoji: '📍' },
  job:        { bg: '#F5F3FF', emoji: '💼' },
  workinghol: { bg: '#FEF3C7', emoji: '✈️' },
  general:    { bg: '#F3F4F6', emoji: '💬' },
};

// embedded=true: BoardListScreen에서 토글로 끼워 넣는 모드 (헤더/탭바 없이)
export default function GroupListScreen({ navigation, embedded = false }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [box, setBox] = useState('all'); // all | mine
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('popular'); // popular | recent
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const params = { box, sort };
      if (category !== 'all') params.category = category;
      const res = await getGroups(params);
      if (res.success) setGroups(res.data || []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [box, category, sort]);

  useFocusEffect(useCallback(() => { fetchGroups(); }, [fetchGroups]));

  const onRefresh = () => { setRefreshing(true); fetchGroups(); };

  const renderRow = (g) => {
    const meta = CATEGORY_META[g.category] || CATEGORY_META.general;
    return (
      <TouchableOpacity
        key={String(g._id)}
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('GroupDetail', { groupId: g._id })}
      >
        {g.coverImage ? (
          <Image source={{ uri: g.coverImage }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
          {!!g.description && (
            <Text style={styles.desc} numberOfLines={1}>{g.description}</Text>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>{g.memberCount} {t('group.member')}</Text>
            {!!g.city && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>{g.city}</Text>
              </>
            )}
            {g.joinPolicy === 'approval' && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={[styles.metaText, { color: colors.primary }]}>{t('group.policyApproval')}</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 필터/정렬 바 */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, box === 'all' && styles.chipActive]}
            onPress={() => setBox('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, box === 'all' && styles.chipTextActive]}>{t('group.filterAll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, box === 'mine' && styles.chipActive]}
            onPress={() => setBox('mine')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, box === 'mine' && styles.chipTextActive]}>{t('group.filterMine')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          {CATEGORIES.map(c => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(c.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 정렬 */}
      <View style={styles.sortRow}>
        <TouchableOpacity onPress={() => setSort('popular')} activeOpacity={0.7}>
          <Text style={[styles.sortText, sort === 'popular' && styles.sortActive]}>{t('group.sortPopular')}</Text>
        </TouchableOpacity>
        <Text style={styles.sortDot}>·</Text>
        <TouchableOpacity onPress={() => setSort('recent')} activeOpacity={0.7}>
          <Text style={[styles.sortText, sort === 'recent' && styles.sortActive]}>{t('group.sortRecent')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {groups.length > 0 ? (
            <View style={styles.listCard}>
              {groups.map((g, idx) => (
                <View key={String(g._id)}>
                  {renderRow(g)}
                  {idx < groups.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              emoji="👥"
              title={t('group.empty')}
              description={t('group.emptyHint')}
              ctaLabel={t('group.createBtn')}
              onCtaPress={() => navigation.navigate('GroupCreate')}
            />
          )}
        </ScrollView>
      )}

      {/* 플로팅 만들기 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('GroupCreate')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('group.createBtn')}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, includeFontPadding: false },
  chipTextActive: { color: colors.white },
  divider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 4 },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4,
  },
  sortText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  sortActive: { color: colors.text, fontWeight: '700' },
  sortDot: { color: colors.textSecondary, fontSize: 12 },

  listCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 14, marginTop: 10, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 70 },
  cover: { width: 48, height: 48, borderRadius: 12 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.textSecondary },
  metaDot: { color: colors.textSecondary, fontSize: 11 },

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
});
