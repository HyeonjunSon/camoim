// 👋 Today's visitors badge (top of home) — a small signal that the community is alive
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { getTodayVisitors } from '../lib/api';

// A display-only boost for the home badge. Admins read the real DAU through a separate path, so nothing there changes.
const HOME_BADGE_BOOST = 30;

export default function TodayVisitors({ refreshKey = 0 }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const [count, setCount] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getTodayVisitors();
        if (res.success) setCount(res.count);
      } catch {
        // A secondary metric — hidden silently on failure
      }
    })();
  }, [refreshKey]);

  if (count == null) return null; // Hidden only before it loads, or when it fails

  const styles = createStyles(colors);
  const shown = count + HOME_BADGE_BOOST; // The +30 applies on home only (admins see the raw number)
  // Compact header badge, e.g. 🟢 42 today
  return (
    <View style={styles.wrap}>
      <View style={styles.dot} />
      <Text style={styles.text}>
        {t('biz.todayPre')}<Text style={styles.count}>{shown}</Text>{t('biz.todayPost')}
      </Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
      backgroundColor: colors.primary + '10',
    },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34C759' },
    text: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    count: { color: colors.primary, fontWeight: '800' },
  });
