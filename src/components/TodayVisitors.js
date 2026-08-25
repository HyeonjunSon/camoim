// 👋 오늘 방문자 배지 (홈 상단) — 커뮤니티가 살아있다는 느낌을 주는 작은 지표
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { getTodayVisitors } from '../lib/api';

// 홈 배지 표시용 가산치. 관리자(DAU)는 실제 수치를 별도 경로로 보므로 영향 없음.
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
        // 부가 지표 — 실패 시 조용히 숨김
      }
    })();
  }, [refreshKey]);

  if (count == null) return null; // 아직 로드 전/실패 시에만 숨김

  const styles = createStyles(colors);
  const shown = count + HOME_BADGE_BOOST; // 홈에서만 +30 (관리자는 원래대로)
  // 헤더용 컴팩트 배지: 🟢 오늘 42명
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
