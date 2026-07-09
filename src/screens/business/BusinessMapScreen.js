import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CITIES,
  CITY_REGION_DELTA,
  catOf,
  cityOf,
  cityLabelOf,
  sourceLabelOf,
  BUSINESS_REPORT_REASONS,
  formatDistance,
} from '../../constants/businesses';
import { getBusinesses, toggleBusinessBookmark, reportBusiness } from '../../lib/api';

const PRIMARY = '#7F77DD';

// 지도 위 컨트롤(플로팅)은 지도 타일 위에 뜨므로 라이트 고정 스타일 사용
export default function BusinessMapScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const mapRef = useRef(null);

  const [city, setCity] = useState('toronto');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState('map'); // map | list
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cityOpen, setCityOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [myLocation, setMyLocation] = useState(null);
  const [region, setRegion] = useState(() => ({
    ...cityRegion('toronto'),
  }));
  const [markerTracking, setMarkerTracking] = useState(true);

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── 데이터 로드: 도시 전체(승인) 업체. 카테고리 필터는 클라에서 즉시 적용 ──
  const load = useCallback(async () => {
    try {
      const near = myLocation ? `${myLocation.longitude},${myLocation.latitude}` : undefined;
      const res = await getBusinesses({ city, near });
      if (res.success) setBusinesses(res.data || []);
    } catch (e) {
      showToast(e?.message || '업체를 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, myLocation, showToast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // 화면 재진입 시 새 제보 반영
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 도시 변경 → 지도 이동 + 선택/드롭다운 초기화
  useEffect(() => {
    const r = cityRegion(city);
    setRegion(r);
    mapRef.current?.animateToRegion(r, 500);
    setSelected(null);
    setCityOpen(false);
  }, [city]);

  // 마커 리렌더 최소화: 데이터/선택 변화 후 잠깐만 tracking on
  useEffect(() => {
    setMarkerTracking(true);
    const t = setTimeout(() => setMarkerTracking(false), 900);
    return () => clearTimeout(t);
  }, [businesses, selected?.id, category, city]);

  const filtered = useMemo(
    () => (category === 'all' ? businesses : businesses.filter((b) => b.category === category)),
    [businesses, category]
  );

  const pinnable = useMemo(() => filtered.filter((b) => b.lat != null && b.lng != null), [filtered]);

  // 간단한 그리드 클러스터링 (현재 확대 수준 기준)
  const { pins, clusters } = useMemo(() => clusterBusinesses(pinnable, region), [pinnable, region]);

  const sortedList = useMemo(() => {
    // near가 있으면 서버가 distanceKm 채워 정렬해줌. 카테고리 필터만 유지
    return filtered;
  }, [filtered]);

  const selectBusiness = useCallback((b) => {
    setSheetFull(false);
    setSelected(b);
    setCityOpen(false);
  }, []);

  // ── 즐겨찾기 토글 (낙관적 업데이트) ──
  const onToggleBookmark = useCallback(async (biz) => {
    const id = biz.id;
    const nextOn = !biz.bookmarked;
    setBusinesses((prev) =>
      prev.map((b) => (b.id === id ? { ...b, bookmarked: nextOn, bookmarkCount: Math.max(0, (b.bookmarkCount || 0) + (nextOn ? 1 : -1)) } : b))
    );
    setSelected((s) => (s && s.id === id ? { ...s, bookmarked: nextOn } : s));
    showToast(nextOn ? '즐겨찾기에 추가했어요.' : '즐겨찾기에서 삭제했어요.');
    try {
      const res = await toggleBusinessBookmark(id);
      if (res?.success) {
        setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, bookmarked: res.bookmarked, bookmarkCount: res.bookmarkCount } : b)));
      }
    } catch {
      // 실패 시 롤백
      setBusinesses((prev) =>
        prev.map((b) => (b.id === id ? { ...b, bookmarked: !nextOn, bookmarkCount: Math.max(0, (b.bookmarkCount || 0) + (nextOn ? -1 : 1)) } : b))
      );
    }
  }, [showToast]);

  // ── 내 주변 ──
  const onNear = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // 권한 거부 → 도시 중심으로 fallback (QA 항목)
        const r = cityRegion(city);
        mapRef.current?.animateToRegion(r, 500);
        showToast('위치 권한이 없어 도시 중심으로 이동했어요.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMyLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
      showToast('현재 위치 기준으로 표시했어요.');
    } catch {
      showToast('위치를 가져오지 못했어요.');
    }
  }, [city, showToast]);

  const onCluster = useCallback((cl) => {
    const r = {
      latitude: cl.lat,
      longitude: cl.lng,
      latitudeDelta: Math.max(region.latitudeDelta / 2.5, 0.01),
      longitudeDelta: Math.max(region.longitudeDelta / 2.5, 0.01),
    };
    mapRef.current?.animateToRegion(r, 400);
  }, [region]);

  const onDirections = useCallback((biz) => {
    const label = encodeURIComponent(biz.name || '');
    let url;
    if (biz.lat != null && biz.lng != null) {
      url = Platform.select({
        ios: `http://maps.apple.com/?daddr=${biz.lat},${biz.lng}&q=${label}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${biz.lat},${biz.lng}`,
      });
    } else {
      const q = encodeURIComponent(biz.address || biz.name || '');
      url = Platform.select({
        ios: `http://maps.apple.com/?q=${q}`,
        default: `https://www.google.com/maps/search/?api=1&query=${q}`,
      });
    }
    Linking.openURL(url).catch(() => showToast('지도 앱을 열지 못했어요.'));
  }, [showToast]);

  const onSubmitReport = useCallback(async (reasonKey) => {
    setReportOpen(false);
    const target = selected;
    if (!target) return;
    try {
      await reportBusiness(target.id, reasonKey);
      showToast('신고가 접수되었어요. 운영진이 확인할게요.');
    } catch (e) {
      showToast(e?.message || '신고에 실패했어요.');
    }
  }, [selected, showToast]);

  const countLabel = `업체 ${filtered.length}곳`;
  const cityLabel = cityLabelOf(city);

  return (
    <View style={styles.container}>
      {/* ── 지도 / 리스트 본문 ── */}
      {viewMode === 'map' ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onMapReady={() => mapRef.current?.animateToRegion(cityRegion(city), 0)}
          onRegionChangeComplete={(r) => setRegion(r)}
          onPress={() => setCityOpen(false)}
          showsUserLocation={!!myLocation}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {pins.map((b) => {
            const c = catOf(b.category);
            const isSel = selected?.id === b.id;
            return (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                onPress={() => selectBusiness(b)}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={markerTracking}
              >
                <Pin cat={c} selected={isSel} />
              </Marker>
            );
          })}
          {clusters.map((cl) => (
            <Marker
              key={cl.id}
              coordinate={{ latitude: cl.lat, longitude: cl.lng }}
              onPress={() => onCluster(cl)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={markerTracking}
            >
              <View style={styles.cluster}>
                <Text style={styles.clusterText}>{cl.count}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <FlatList
          data={sortedList}
          keyExtractor={(b) => b.id}
          style={styles.listRoot}
          contentContainerStyle={{ paddingTop: insets.top + 96, paddingBottom: 96, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
          renderItem={({ item: b }) => {
            const c = catOf(b.category);
            return (
              <TouchableOpacity style={styles.listCard} activeOpacity={0.85} onPress={() => selectBusiness(b)}>
                <View style={[styles.listEmoji, { backgroundColor: c.soft }]}>
                  <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={styles.rowCenter}>
                    <Text style={styles.listName} numberOfLines={1}>{b.name}</Text>
                    <View style={[styles.catChip, { backgroundColor: c.soft }]}>
                      <Text style={[styles.catChipText, { color: c.color }]}>{c.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.listAddr} numberOfLines={1}>{b.address}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <TouchableOpacity onPress={() => onToggleBookmark(b)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={b.bookmarked ? 'star' : 'star-outline'} size={18} color={b.bookmarked ? '#F59E0B' : colors.textSecondary} />
                  </TouchableOpacity>
                  {b.distanceKm != null && <Text style={styles.listDist}>{formatDistance(b.distanceKm)}</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyWrap}>
                <Text style={{ fontSize: 34 }}>🗭</Text>
                <Text style={styles.emptyText}>이 카테고리에는 아직 업체가 없어요</Text>
              </View>
            )
          }
        />
      )}

      {/* ── 상단 컨트롤 (도시 선택 + 카운트 + 카테고리 칩) ── */}
      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <TouchableOpacity style={styles.cityBtn} activeOpacity={0.85} onPress={() => setCityOpen((v) => !v)}>
            <Ionicons name="location" size={15} color={PRIMARY} />
            <Text style={styles.cityBtnText}>{cityLabel}</Text>
            <Ionicons name={cityOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#888888" />
          </TouchableOpacity>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{countLabel}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          pointerEvents="auto"
        >
          {[{ key: 'all', label: '전체', emoji: '' }, ...BUSINESS_CATEGORIES].map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                activeOpacity={0.8}
                onPress={() => { setCategory(c.key); setCityOpen(false); }}
              >
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : '#555555' }]}>
                  {c.emoji ? `${c.emoji} ` : ''}{c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 도시 드롭다운 (최상단 오버레이 — 칩 위로 확실히 뜸) ── */}
      {cityOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setCityOpen(false)}>
            <View style={[StyleSheet.absoluteFill, { zIndex: 44 }]} />
          </TouchableWithoutFeedback>
          <View style={[styles.cityDropdown, { top: insets.top + 8 + 44, left: 14 }]}>
            {BUSINESS_CITIES.map((c, i) => {
              const active = c.key === city;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.cityOption, i > 0 && styles.cityOptionBorder]}
                  activeOpacity={0.7}
                  onPress={() => setCity(c.key)}
                >
                  <Text style={[styles.cityOptionText, active && { color: PRIMARY, fontWeight: '700' }]}>{c.label}</Text>
                  {active && <Ionicons name="checkmark" size={16} color={PRIMARY} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* ── 우하단 FAB ── */}
      <View style={styles.fabColumn} pointerEvents="box-none">
        {viewMode === 'map' && (
          <TouchableOpacity style={styles.nearFab} activeOpacity={0.85} onPress={onNear}>
            <Ionicons name="navigate" size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.reportFab} activeOpacity={0.9} onPress={() => navigation.navigate('BusinessReport')}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.reportFabText}>업체 제보</Text>
        </TouchableOpacity>
      </View>

      {/* ── 지도/리스트 토글 ── */}
      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segmentBtn, viewMode === 'map' && styles.segmentActive]}
          activeOpacity={0.85}
          onPress={() => setViewMode('map')}
        >
          <Ionicons name="map-outline" size={15} color={viewMode === 'map' ? '#FFFFFF' : '#888888'} />
          <Text style={[styles.segmentText, { color: viewMode === 'map' ? '#FFFFFF' : '#888888' }]}>지도</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, viewMode === 'list' && styles.segmentActive]}
          activeOpacity={0.85}
          onPress={() => { setViewMode('list'); setCityOpen(false); }}
        >
          <Ionicons name="list-outline" size={15} color={viewMode === 'list' ? '#FFFFFF' : '#888888'} />
          <Text style={[styles.segmentText, { color: viewMode === 'list' ? '#FFFFFF' : '#888888' }]}>리스트</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      )}

      {/* ── 업체 상세 바텀시트 ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && (
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.handleWrap} activeOpacity={0.7} onPress={() => setSheetFull((v) => !v)}>
              <View style={styles.handle} />
            </TouchableOpacity>
            <View style={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 20, gap: 14 }}>
              <SheetHeader biz={selected} colors={colors} onBookmark={() => onToggleBookmark(selected)} />
              <View style={{ gap: 10 }}>
                <InfoRow icon="location-outline" text={selected.address} colors={colors} />
                <InfoRow icon="call-outline" text={selected.phone || '전화번호 미등록'} colors={colors} />
                <InfoRow icon="time-outline" text={selected.hours || '영업시간 미등록'} colors={colors} />
              </View>
              {sheetFull && !!selected.description && (
                <View style={styles.descBox}>
                  <Text style={styles.descText}>{selected.description}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.dirBtn} activeOpacity={0.9} onPress={() => onDirections(selected)}>
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text style={styles.dirBtnText}>길찾기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportBtn} activeOpacity={0.85} onPress={() => setReportOpen(true)}>
                  <Ionicons name="flag-outline" size={15} color="#FF4444" />
                  <Text style={styles.reportBtnText}>신고</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* ── 신고 모달 ── */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <TouchableOpacity style={styles.reportBackdrop} activeOpacity={1} onPress={() => setReportOpen(false)}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>무엇이 문제인가요?</Text>
            <View style={{ gap: 4 }}>
              {BUSINESS_REPORT_REASONS.map((r) => (
                <TouchableOpacity key={r.key} style={styles.reportReason} activeOpacity={0.8} onPress={() => onSubmitReport(r.key)}>
                  <Text style={styles.reportReasonText}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.reportCancel} activeOpacity={0.8} onPress={() => setReportOpen(false)}>
                <Text style={styles.reportCancelText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── 토스트 ── */}
      {!!toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ── 지도 핀 ──
function Pin({ cat, selected }) {
  return (
    <View style={pinStyles.wrap}>
      {selected && <View style={[pinStyles.ring, { borderColor: 'rgba(127,119,221,0.9)' }]} />}
      <View style={[pinStyles.pin, { backgroundColor: cat.color, width: selected ? 36 : 30, height: selected ? 36 : 30 }]}>
        <Text style={{ fontSize: selected ? 16 : 14 }}>{cat.emoji}</Text>
      </View>
    </View>
  );
}

function SheetHeader({ biz, colors, onBookmark }) {
  const c = catOf(biz.category);
  const styles = createStyles(colors);
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={[styles.sheetEmoji, { backgroundColor: c.soft }]}>
        <Text style={{ fontSize: 30 }}>{c.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={styles.sheetName} numberOfLines={2}>{biz.name}</Text>
        <View style={styles.rowCenter}>
          <View style={[styles.catChip, { backgroundColor: c.soft }]}>
            <Text style={[styles.catChipText, { color: c.color }]}>{c.label}</Text>
          </View>
          <Text style={styles.sourceText}>{biz.sourceName || sourceLabelOf(biz.source)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.sheetStar} activeOpacity={0.8} onPress={onBookmark}>
        <Ionicons name={biz.bookmarked ? 'star' : 'star-outline'} size={20} color={biz.bookmarked ? '#F59E0B' : colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ icon, text, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={2}>{text}</Text>
    </View>
  );
}

// ── helpers ──
function cityRegion(cityKey) {
  const c = cityOf(cityKey);
  return { latitude: c.latitude, longitude: c.longitude, ...CITY_REGION_DELTA };
}

function clusterBusinesses(items, region) {
  if (!region || !region.latitudeDelta) return { pins: items, clusters: [] };
  const cell = Math.max(region.latitudeDelta, region.longitudeDelta) / 9;
  if (!(cell > 0)) return { pins: items, clusters: [] };
  const groups = new Map();
  for (const b of items) {
    const key = `${Math.round(b.lat / cell)}_${Math.round(b.lng / cell)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  const pins = [];
  const clusters = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      pins.push(arr[0]);
    } else {
      const lat = arr.reduce((s, x) => s + x.lat, 0) / arr.length;
      const lng = arr.reduce((s, x) => s + x.lng, 0) / arr.length;
      clusters.push({ id: `c_${arr[0].id}`, lat, lng, count: arr.length, items: arr });
    }
  }
  return { pins, clusters };
}

const pinStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22, borderWidth: 3,
  },
  pin: {
    borderRadius: 999,
    borderBottomLeftRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listRoot: { flex: 1, backgroundColor: colors.background },

  // 상단 컨트롤
  topControls: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  cityBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  cityBtnText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  cityDropdown: {
    position: 'absolute', width: 172, zIndex: 45,
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 24,
  },
  cityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 15 },
  cityOptionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEEEF2' },
  cityOptionText: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  countPill: {
    backgroundColor: 'rgba(255,255,255,0.95)', paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  countText: { fontSize: 11, fontWeight: '600', color: '#888888' },
  chipRow: { gap: 8, paddingHorizontal: 14, paddingVertical: 2 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  chipActive: { backgroundColor: PRIMARY },
  chipInactive: { backgroundColor: 'rgba(255,255,255,0.97)' },
  chipText: { fontSize: 13, fontWeight: '600' },

  // 클러스터
  cluster: {
    minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 8,
    backgroundColor: PRIMARY, borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  clusterText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // FAB
  fabColumn: { position: 'absolute', right: 14, bottom: 74, zIndex: 30, alignItems: 'flex-end', gap: 10 },
  nearFab: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  reportFab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 13, paddingHorizontal: 18, borderRadius: 999, backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  reportFabText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // 지도/리스트 세그먼트
  segmentWrap: {
    position: 'absolute', bottom: 14, alignSelf: 'center', zIndex: 30,
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 999, padding: 4, gap: 2,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  segmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 999 },
  segmentActive: { backgroundColor: PRIMARY },
  segmentText: { fontSize: 13, fontWeight: '700' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // 리스트
  listCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  listEmoji: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  listAddr: { fontSize: 12, color: colors.textSecondary },
  listDist: { fontSize: 11, fontWeight: '600', color: PRIMARY },
  catChip: { paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999 },
  catChipText: { fontSize: 10, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  // 바텀시트
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  handleWrap: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border },
  sheetEmoji: { width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sourceText: { fontSize: 11, color: colors.textSecondary },
  sheetStar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  descBox: { backgroundColor: colors.inputBg, borderRadius: 12, padding: 14 },
  descText: { fontSize: 13, color: colors.textSecondary, lineHeight: 21 },
  dirBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: 12, backgroundColor: PRIMARY,
  },
  dirBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FEF2F2',
  },
  reportBtnText: { fontSize: 14, fontWeight: '700', color: '#FF4444' },

  // 신고 모달
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  reportCard: { width: 290, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', paddingBottom: 12 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 },
  reportReason: { marginHorizontal: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.inputBg, marginBottom: 4 },
  reportReasonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  reportCancel: { marginHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  reportCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // 토스트
  toastWrap: {
    position: 'absolute', alignSelf: 'center', bottom: 110, zIndex: 90,
    backgroundColor: 'rgba(26,26,26,0.92)', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999, maxWidth: 330,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
