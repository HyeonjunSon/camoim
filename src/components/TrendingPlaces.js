// 🔥 Trending places this week (home section) — the weekly top 5 as horizontal cards
// Tapping a card switches to the map tab and opens that business's detail sheet (the focusId param)
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { catOf } from '../constants/businesses';
import { getTrendingBusinesses } from '../lib/api';

export default function TrendingPlaces({ refreshKey = 0 }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const navigation = useNavigation();
  const [list, setList] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await getTrendingBusinesses();
      if (res.success) setList(res.data || []);
    } catch {
      // A secondary section — hidden silently on failure
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (list.length === 0) return null;

  const styles = createStyles(colors);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="flame" size={16} color="#EF4444" />
          <Text style={styles.title}>{t('biz.trendingTitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Map')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.viewAll}>{t('biz.viewMap')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
        {list.map((b) => {
          const c = catOf(b.category);
          return (
            <TouchableOpacity
              key={b.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Map', { screen: 'BusinessMap', params: { focusId: b.id } })}
            >
              <View style={styles.cardTop}>
                <View style={[styles.emojiTile, { backgroundColor: c.soft }]}>
                  <Ionicons name={c.ion} size={24} color={c.color} />
                </View>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{b.rank}</Text>
                </View>
              </View>
              <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
              <View style={styles.metaRow}>
                {b.ratingCount > 0 ? (
                  <>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.metaText}>{b.ratingAvg.toFixed(1)} ({b.ratingCount})</Text>
                  </>
                ) : (
                  <Text style={styles.metaText}>{t(c.labelKey)}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrap: { marginTop: 18 },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, marginBottom: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
    viewAll: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    cardRow: { paddingHorizontal: 16, gap: 10 },
    card: {
      width: 140, padding: 12, borderRadius: 14, gap: 8,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    emojiTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rankBadge: {
      minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
      backgroundColor: '#FF6B4A', alignItems: 'center', justifyContent: 'center',
    },
    rankText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
    name: { fontSize: 14, fontWeight: '700', color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  });
