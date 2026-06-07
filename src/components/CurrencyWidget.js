import { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

// 환율 위젯 — KRW ↔ CAD
// frankfurter.app 무료 API (ECB 기준, 인증·키 불필요, 1일 1회 업데이트)
// AsyncStorage에 6시간 캐싱 — API 호출 최소화
const CACHE_KEY = '@camoim_currency_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

async function loadCachedRate() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch { return null; }
}

async function fetchFreshRate() {
  // 양방향 한 번에: 1 CAD = X KRW, 1 KRW = Y CAD = 1/X
  const res = await fetch('https://api.frankfurter.app/latest?from=CAD&to=KRW');
  if (!res.ok) throw new Error('rate fetch failed');
  const json = await res.json();
  const cadToKrw = json?.rates?.KRW;
  if (!cadToKrw || typeof cadToKrw !== 'number') throw new Error('invalid response');
  return {
    cadToKrw,
    krwToCad: 1 / cadToKrw,
    date: json.date,
    fetchedAt: Date.now(),
  };
}

export default function CurrencyWidget() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadRate = useCallback(async (forceFresh = false) => {
    setError(false);
    if (!forceFresh) {
      const cached = await loadCachedRate();
      if (cached) {
        setRate(cached);
        setLoading(false);
        return;
      }
    }
    try {
      const fresh = await fetchFreshRate();
      setRate(fresh);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRate(); }, [loadRate]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRate(true);
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !rate) {
    return (
      <TouchableOpacity style={styles.card} onPress={onRefresh} activeOpacity={0.7}>
        <Text style={styles.errorText}>{t('currency.errorRetry') || '환율을 불러오지 못했어요 (탭하여 재시도)'}</Text>
      </TouchableOpacity>
    );
  }

  // 숫자 포맷팅
  const cadToKrwFmt = Math.round(rate.cadToKrw).toLocaleString();
  const krwToCadFmt = rate.krwToCad.toFixed(4);
  const updatedLabel = `${t('currency.updated') || '업데이트'} ${rate.date}`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="cash-outline" size={16} color={colors.primary} />
          <Text style={styles.title}>{t('currency.title') || '실시간 환율'}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} hitSlop={8} accessibilityRole="button" accessibilityLabel="새로고침">
          <Ionicons name="refresh" size={16} color={refreshing ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <Text style={styles.flag}>🇨🇦</Text>
        <Text style={styles.leftLabel}>1 CAD</Text>
        <Text style={styles.arrow}>=</Text>
        <Text style={styles.rightLabel}>{cadToKrwFmt}{t('currency.krwSuffix') || '원'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.flag}>🇰🇷</Text>
        <Text style={styles.leftLabel}>1,000원</Text>
        <Text style={styles.arrow}>=</Text>
        <Text style={styles.rightLabel}>${(rate.krwToCad * 1000).toFixed(2)}</Text>
      </View>

      <Text style={styles.updatedText}>{updatedLabel}</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border + '60',
    gap: 8,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { fontSize: 16 },
  leftLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, minWidth: 70 },
  arrow: { fontSize: 13, color: colors.textSecondary, marginHorizontal: 2 },
  rightLabel: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  updatedText: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'right' },
  errorText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
