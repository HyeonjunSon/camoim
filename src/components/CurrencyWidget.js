import { useState, useEffect, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

// 환율 계산기 — KRW ↔ CAD 양방향 입력
// 데이터 출처:
//   1순위: 네이버 finance (m.stock.naver.com) — 하나은행 매매기준율, 1원 이내 일치
//   2순위: Yahoo Finance — interbank real-time (현찰가에 가까움)
//   3순위: open.er-api.com — mid-market 백업
const CACHE_KEY = '@camoim_currency_cache_v4';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

async function loadCachedRate() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch { return null; }
}

function ymdhm(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 네이버 finance — 하나은행 매매기준율 (한국 금융앱 표준 reference rate)
async function fetchNaverRate() {
  const res = await fetch(
    'https://m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=FX_CADKRW&page=1',
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaMoim/1.0)' } },
  );
  if (!res.ok) throw new Error('naver http ' + res.status);
  const json = await res.json();
  if (!json?.isSuccess) throw new Error('naver not success');
  const latest = json?.result?.[0];
  if (!latest?.closePrice) throw new Error('naver no closePrice');
  const cadToKrw = parseFloat(String(latest.closePrice).replace(/,/g, ''));
  if (!Number.isFinite(cadToKrw) || cadToKrw <= 0) throw new Error('naver invalid price');
  return {
    cadToKrw,
    date: ymdhm(Date.now()),
    fetchedAt: Date.now(),
    source: 'naver',
  };
}

// Yahoo Finance — 실시간 외환 시세 (현찰 사실 때 가격과 비슷)
async function fetchYahooRate() {
  const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/CADKRW=X?interval=1d', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaMoim/1.0)' },
  });
  if (!res.ok) throw new Error('yahoo http ' + res.status);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (!price || typeof price !== 'number') throw new Error('yahoo invalid response');
  const ts = meta?.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();
  return { cadToKrw: price, date: ymdhm(ts), fetchedAt: Date.now(), source: 'yahoo' };
}

// 백업 — open.er-api (mid-market, 약간 lag)
async function fetchOpenErApiRate() {
  const res = await fetch('https://open.er-api.com/v6/latest/CAD');
  if (!res.ok) throw new Error('open-er-api http ' + res.status);
  const json = await res.json();
  const cadToKrw = json?.rates?.KRW;
  if (!cadToKrw || typeof cadToKrw !== 'number') throw new Error('open-er-api invalid');
  const ts = json?.time_last_update_unix ? json.time_last_update_unix * 1000 : Date.now();
  return { cadToKrw, date: ymdhm(ts), fetchedAt: Date.now(), source: 'open-er-api' };
}

async function fetchFreshRate() {
  try {
    return await fetchNaverRate();
  } catch {
    try {
      return await fetchYahooRate();
    } catch {
      return await fetchOpenErApiRate();
    }
  }
}

// 숫자 천단위 콤마
function formatNumber(n, fractionDigits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

// 콤마 제거 + 숫자 파싱 (잘못된 입력은 0)
function parseInput(s) {
  if (typeof s !== 'string') return 0;
  const cleaned = s.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '.') return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function CurrencyWidget({ refreshKey = 0 }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // 양쪽 입력값 (string으로 관리 — 소수점·콤마 표시)
  const [cadStr, setCadStr] = useState('1');
  const [krwStr, setKrwStr] = useState('');
  const lastEditedRef = useRef('cad'); // 'cad' | 'krw' — 마지막으로 사용자가 만진 쪽

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

  // 홈 새로고침(refreshKey 변경) 시 최신 환율 강제 재요청 (초기 마운트는 제외)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    setRefreshing(true);
    loadRate(true);
  }, [refreshKey, loadRate]);

  // 환율 로드되면 기본 KRW 계산
  useEffect(() => {
    if (!rate) return;
    if (lastEditedRef.current === 'cad') {
      const cadNum = parseInput(cadStr);
      setKrwStr(formatNumber(cadNum * rate.cadToKrw, 2));
    } else {
      const krwNum = parseInput(krwStr);
      setCadStr(formatNumber(krwNum / rate.cadToKrw, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  // CAD 입력 → KRW 자동 계산
  const onCadChange = (text) => {
    // 숫자·콤마·소수점만 허용
    const filtered = text.replace(/[^0-9.,]/g, '');
    setCadStr(filtered);
    lastEditedRef.current = 'cad';
    if (rate) {
      const cadNum = parseInput(filtered);
      setKrwStr(cadNum === 0 ? '' : formatNumber(cadNum * rate.cadToKrw, 2));
    }
  };

  // KRW 입력 → CAD 자동 계산
  const onKrwChange = (text) => {
    const filtered = text.replace(/[^0-9.,]/g, '');
    setKrwStr(filtered);
    lastEditedRef.current = 'krw';
    if (rate) {
      const krwNum = parseInput(filtered);
      setCadStr(krwNum === 0 ? '' : formatNumber(krwNum / rate.cadToKrw, 2));
    }
  };

  const onRefresh = () => {
    Keyboard.dismiss();
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
        <Text style={styles.errorText}>{t('currency.errorRetry')}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
          <Text style={styles.title}>{t('currency.title')}</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="새로고침"
        >
          <Ionicons name="refresh" size={16} color={refreshing ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
      </View>

      {/* CAD 행 */}
      <View style={styles.currencyRow}>
        <View style={styles.currencyLeft}>
          <Text style={styles.flag}>🇨🇦</Text>
          <View style={styles.labelGroup}>
            <Text style={styles.countryName}>{t('currency.canada')}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>CAD</Text>
            </View>
          </View>
        </View>
        <TextInput
          style={styles.input}
          value={cadStr}
          onChangeText={onCadChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          selectTextOnFocus
          returnKeyType="done"
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerBadge}>
          <Ionicons name="swap-vertical" size={12} color={colors.primary} />
        </View>
      </View>

      {/* KRW 행 */}
      <View style={styles.currencyRow}>
        <View style={styles.currencyLeft}>
          <Text style={styles.flag}>🇰🇷</Text>
          <View style={styles.labelGroup}>
            <Text style={styles.countryName}>{t('currency.korea')}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>KRW</Text>
            </View>
          </View>
        </View>
        <TextInput
          style={styles.input}
          value={krwStr}
          onChangeText={onKrwChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          selectTextOnFocus
          returnKeyType="done"
        />
      </View>

      <Text style={styles.updatedText}>
        {t('currency.basis')} · {t('currency.updated')} {rate.date}
      </Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 12, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },

  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: 8,
  },
  currencyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 18 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countryName: { fontSize: 13, fontWeight: '700', color: colors.text },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.primary + '14',
  },
  codeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    letterSpacing: -0.3,
    paddingVertical: 2,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerBadge: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  updatedText: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'right',
  },
  errorText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
