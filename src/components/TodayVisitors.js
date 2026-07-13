// 👋 오늘 방문자 배지 (홈 상단) — 커뮤니티가 살아있다는 느낌을 주는 작은 지표
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { getTodayVisitors } from '../lib/api';

export default function TodayVisitors({ refreshKey = 0 }) {
  const { colors } = useTheme();
  const [count, setCount] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getTodayVisitors();
        if (res.success) setCount(res.count);
      } catch {
        // 부가 지표 — 실패 시 조용히 숨김
      }
    })();
  }, [refreshKey]);

  if (!count || count < 1) return null; // 0명일 땐 숨김 (썰렁해 보이지 않게)

  const styles = createStyles(colors);
  return (
    <View style={styles.wrap}>
      <View style={styles.dot} />
      <Text style={styles.text}>
        오늘 <Text style={styles.count}>{count}명</Text>의 한인이 다녀갔어요 👋
      </Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      alignSelf: 'center', marginTop: 2, marginBottom: 10,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: colors.primary + '10',
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
    text: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    count: { color: colors.primary, fontWeight: '800' },
  });
