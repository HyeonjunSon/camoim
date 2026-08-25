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
  TextInput,
  Keyboard,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CITIES,
  CITY_REGION_DELTA,
  catOf,
  cityOf,
  cityLabelKeyOf,
  sourceKeyOf,
  BUSINESS_REPORT_REASONS,
  formatDistance,
} from '../../constants/businesses';
import {
  STAY_ACCENT,
  stayTypeOf,
  stayCondOf,
  formatPrice,
  priceUnitKey,
} from '../../constants/stays';
import { getBusinesses, toggleBusinessBookmark, reportBusiness, getStays, toggleStayBookmark } from '../../lib/api';
import BusinessReviewsSection, { Stars } from './BusinessReviewsSection';

const PRIMARY = '#7F77DD';
const SCREEN_H = Dimensions.get('window').height;
const MY_LOCATION = '__me__'; // city 값이 이거면 "내 위치" 모드 (도시 필터 없이 내 주변)

// 지도 위 컨트롤(플로팅)은 지도 타일 위에 뜨므로 라이트 고정 스타일 사용
export default function BusinessMapScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLang();
  // 개수/검색어 등 값이 들어가는 문구는 {n}/{q} 치환 (t는 보간 미지원)
  const tn = useCallback((key, vars) => {
    let s = t(key);
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  }, [t]);
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const mapRef = useRef(null);

  const [city, setCity] = useState('toronto');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState(''); // 업체명/주소 검색
  const [bookmarkOnly, setBookmarkOnly] = useState(false); // ⭐ 즐겨찾기만 보기
  const [businesses, setBusinesses] = useState([]);
  const [stays, setStays] = useState([]); // 숙소 (category==='stay'일 때 사용)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isStay = category === 'stay'; // 숙소 모드 — 별도 데이터/핀/카드/상세화면 사용

  const [cityOpen, setCityOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [clusterSheet, setClusterSheet] = useState(null); // 클러스터 탭 → 묶인 업체 리스트 (OpenTable식)

  const [myLocation, setMyLocation] = useState(null);
  const [region, setRegion] = useState(() => ({
    ...cityRegion('toronto'),
  }));
  const [markerTracking, setMarkerTracking] = useState(true);
  const [mapReady, setMapReady] = useState(false); // 지도 준비 전 마커 mount 시 인터롭 크래시 방지

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
      // 내 위치 모드면 도시 필터 없이 전체 로드 후 거리순 (내 주변 업체가 보이게)
      const res = await getBusinesses({ city: city === MY_LOCATION ? undefined : city, near });
      if (res.success) setBusinesses(res.data || []);
    } catch (e) {
      showToast(t('biz.loadFail'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, myLocation, showToast, t]);

  // ── 숙소 로드 (숙소 모드에서만) — 도시로 안 막고 전부 로드. 지도 어디로 옮겨도 그 지역 숙소가 보임 ──
  const loadStays = useCallback(async () => {
    try {
      const near = myLocation ? `${myLocation.longitude},${myLocation.latitude}` : undefined;
      const res = await getStays({ near }); // city 필터 없음 = 캐나다 전역
      if (res.success) setStays(res.data || []);
    } catch (e) {
      showToast(t('stay.loadFail'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myLocation, showToast, t]);

  useEffect(() => {
    setLoading(true);
    if (isStay) loadStays();
    else load();
  }, [isStay, load, loadStays]);

  // 화면 재진입 시 새 등록 반영 (모드에 맞는 데이터만)
  useFocusEffect(useCallback(() => {
    if (isStay) loadStays();
    else load();
  }, [isStay, load, loadStays]));

  // ── 첫 진입 시 현재 위치 기반으로 시작 (OpenTable 스타일) ──
  // 권한 요청 → 허용 시 내 위치 중심 + 거리순 정렬(near). 거부 시 도시 중심 유지 (조용히)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(loc);
        setCity(MY_LOCATION); // 내 위치 기반으로 시작 (라벨=내 위치, 업체=주변 로드)
        mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 700);
      } catch {
        // 위치 실패 → 도시 중심 그대로
      }
    })();
  }, []);

  // ── 홈 인기 장소 카드에서 진입 시 해당 업체 자동 오픈 (focusId 파라미터) ──
  useEffect(() => {
    const focusId = route?.params?.focusId;
    if (!focusId || businesses.length === 0) return;
    const target = businesses.find((b) => b.id === focusId);
    if (target) selectBusiness(target);
    navigation.setParams({ focusId: undefined }); // 재진입 시 반복 오픈 방지
  }, [route?.params?.focusId, businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  // 외부에서 특정 카테고리(예: 숙소)로 열기 — "지도에서 보기" 진입
  useEffect(() => {
    const c = route?.params?.category;
    if (c) {
      setCategory(c);
      navigation.setParams({ category: undefined });
    }
  }, [route?.params?.category]); // eslint-disable-line react-hooks/exhaustive-deps

  // 도시 변경 → 지도 이동 + 선택/드롭다운 초기화
  useEffect(() => {
    setSelected(null);
    setCityOpen(false);
    if (city === MY_LOCATION) return; // 내 위치는 onNear가 카메라를 처리 (도시 중심으로 튀지 않게)
    const r = cityRegion(city);
    setRegion(r);
    mapRef.current?.animateToRegion(r, 500);
  }, [city]);

  // 모드(카테고리) 전환 시 업체 상세/클러스터 시트 정리 (숙소↔업체 잔상 방지)
  useEffect(() => {
    setSelected(null);
    setClusterSheet(null);
    setBookmarkOnly(false);
  }, [category]);

  // 마커 리렌더 최소화: 데이터/선택 변화 후 잠깐만 tracking on
  useEffect(() => {
    setMarkerTracking(true);
    const t = setTimeout(() => setMarkerTracking(false), 900);
    return () => clearTimeout(t);
  }, [businesses, stays, selected?.id, category, city]);

  const filtered = useMemo(() => {
    let list = isStay
      ? stays
      : category === 'all' ? businesses : businesses.filter((b) => b.category === category);
    if (bookmarkOnly) list = list.filter((b) => b.bookmarked);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const hay = isStay ? `${b.title || ''} ${b.neighborhood || ''}` : `${b.name || ''} ${b.address || ''}`;
        return hay.toLowerCase().includes(q);
      });
    }
    return list;
  }, [businesses, stays, isStay, category, bookmarkOnly, query]);

  const pinnable = useMemo(() => filtered.filter((b) => b.lat != null && b.lng != null), [filtered]);

  // ── OpenTable 스타일: 현재 지도에 보이는 영역의 업체 (하단 가로 카드용) ──
  const visibleBusinesses = useMemo(() => {
    if (!region?.latitudeDelta) return [];
    const latMin = region.latitude - region.latitudeDelta / 2;
    const latMax = region.latitude + region.latitudeDelta / 2;
    const lngMin = region.longitude - region.longitudeDelta / 2;
    const lngMax = region.longitude + region.longitudeDelta / 2;
    const inView = pinnable.filter((b) => b.lat >= latMin && b.lat <= latMax && b.lng >= lngMin && b.lng <= lngMax);
    inView.sort((a, b) =>
      (a.distanceKm != null && b.distanceKm != null)
        ? a.distanceKm - b.distanceKm
        : ((b.ratingCount || 0) - (a.ratingCount || 0)) || ((b.ratingAvg || 0) - (a.ratingAvg || 0))
          || (a.name || a.title || '').localeCompare(b.name || b.title || '')
    );
    return { items: inView.slice(0, 80), count: inView.length }; // 리스트는 상위 80, 개수는 실제
  }, [pinnable, region]);

  // ── OpenTable식 하단 드래그 시트 (지도 위로 리스트가 올라옴) ──
  // 탭바를 제외한 실제 렌더 영역은 onLayout으로 측정 — Dimensions 창 높이 기준이면
  // 탭바 높이만큼 시트가 아래로 밀려 FAB가 가려짐 (iOS/Android 탭바 높이가 달라 상수 보정 불가)
  const [containerH, setContainerH] = useState(SCREEN_H);
  const SHEET_TOP = insets.top + 104;      // 검색+칩 아래에서 시트 최상단
  const SHEET_H = containerH - SHEET_TOP;
  const [handleH, setHandleH] = useState(50);   // 핸들+카운트 영역 실측 높이
  const PEEK = handleH + 10;                // 접힘: 핸들+카운트 + 카드 윗모서리 10dp만 (텍스트 안 잘림)
  const fullY = 0;
  const halfY = Math.max(SHEET_H - 290, 0); // 중간 스냅: 카운트 + 카드 3장
  const peekY = Math.max(SHEET_H - PEEK, 0);

  const sheetY = useRef(new Animated.Value(peekY)).current;
  const curY = useRef(peekY);
  const dragFrom = useRef(peekY);
  const snapRef = useRef('peek');
  const [snap, setSnap] = useState('peek'); // peek | half | full

  useEffect(() => {
    const id = sheetY.addListener(({ value }) => { curY.current = value; });
    return () => sheetY.removeListener(id);
  }, [sheetY]);

  const snapSheet = useCallback((level) => {
    const to = level === 'full' ? fullY : level === 'half' ? halfY : peekY;
    snapRef.current = level;
    setSnap(level);
    Animated.spring(sheetY, { toValue: to, useNativeDriver: false, bounciness: 3, speed: 13 }).start();
  }, [fullY, halfY, peekY, sheetY]);

  // 컨테이너 높이 측정/회전으로 스냅 좌표가 바뀌면 현재 스냅 위치로 즉시 재정렬
  useEffect(() => {
    const to = snapRef.current === 'full' ? fullY : snapRef.current === 'half' ? halfY : peekY;
    sheetY.setValue(to);
  }, [fullY, halfY, peekY, sheetY]);

  // PanResponder는 한 번만 생성되므로 최신 스냅 좌표는 ref로 전달 (stale closure 방지)
  const snapsRef = useRef({ fullY, halfY, peekY });
  useEffect(() => { snapsRef.current = { fullY, halfY, peekY }; }, [fullY, halfY, peekY]);
  const snapSheetRef = useRef(snapSheet);
  useEffect(() => { snapSheetRef.current = snapSheet; }, [snapSheet]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { sheetY.stopAnimation(); dragFrom.current = curY.current; },
      onPanResponderMove: (_, g) => {
        const s = snapsRef.current;
        const y = Math.max(s.fullY, Math.min(s.peekY, dragFrom.current + g.dy));
        sheetY.setValue(y);
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) < 5) { // 살짝 탭 → 접힘/반 토글
          snapSheetRef.current(snapRef.current === 'peek' ? 'half' : 'peek');
          return;
        }
        const s = snapsRef.current;
        const y = curY.current + g.vy * 90; // 관성 반영
        const opts = [['full', s.fullY], ['half', s.halfY], ['peek', s.peekY]];
        opts.sort((a, b) => Math.abs(y - a[1]) - Math.abs(y - b[1]));
        snapSheetRef.current(opts[0][0]);
      },
    })
  ).current;

  // 간단한 그리드 클러스터링 (현재 확대 수준 기준)
  const { pins, clusters } = useMemo(() => clusterBusinesses(pinnable, region), [pinnable, region]);

  const selectBusiness = useCallback((b) => {
    setSheetFull(false);
    setSelected(b);
    setCityOpen(false);
    snapSheet('peek'); // 상세 시트 열 때 리스트 시트는 접기 (지도+상세 같이 보이게)
    // 카드/핀 선택 시 지도를 그 업체 위치로 이동 → "어디 있는지" 바로 보이게.
    // 핀이 하단 상세 시트에 가리지 않게 중심을 살짝 아래로 잡아 위쪽에 오도록.
    if (b.lat != null && b.lng != null) {
      const d = 0.02;
      mapRef.current?.animateToRegion(
        { latitude: b.lat - d * 0.3, longitude: b.lng, latitudeDelta: d, longitudeDelta: d },
        500
      );
    }
  }, [snapSheet]);

  // 숙소는 바텀시트가 아니라 전용 상세 화면으로 이동
  const openStay = useCallback((s) => {
    setCityOpen(false);
    navigation.navigate('StayDetail', { id: s.id, stay: s });
  }, [navigation]);

  // 숙소 즐겨찾기 토글 (낙관적)
  const onToggleStayBookmark = useCallback(async (s) => {
    const id = s.id;
    const nextOn = !s.bookmarked;
    setStays((prev) => prev.map((x) => (x.id === id ? { ...x, bookmarked: nextOn, bookmarkCount: Math.max(0, (x.bookmarkCount || 0) + (nextOn ? 1 : -1)) } : x)));
    showToast(nextOn ? t('biz.bookmarkAdded') : t('biz.bookmarkRemoved'));
    try {
      const res = await toggleStayBookmark(id);
      if (res?.success) setStays((prev) => prev.map((x) => (x.id === id ? { ...x, bookmarked: res.bookmarked, bookmarkCount: res.bookmarkCount } : x)));
    } catch {
      setStays((prev) => prev.map((x) => (x.id === id ? { ...x, bookmarked: !nextOn, bookmarkCount: Math.max(0, (x.bookmarkCount || 0) + (nextOn ? -1 : 1)) } : x)));
    }
  }, [showToast, t]);

  // ── 즐겨찾기 토글 (낙관적 업데이트) ──
  const onToggleBookmark = useCallback(async (biz) => {
    const id = biz.id;
    const nextOn = !biz.bookmarked;
    setBusinesses((prev) =>
      prev.map((b) => (b.id === id ? { ...b, bookmarked: nextOn, bookmarkCount: Math.max(0, (b.bookmarkCount || 0) + (nextOn ? 1 : -1)) } : b))
    );
    setSelected((s) => (s && s.id === id ? { ...s, bookmarked: nextOn } : s));
    showToast(nextOn ? t('biz.bookmarkAdded') : t('biz.bookmarkRemoved'));
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
  }, [showToast, t]);

  // ── 내 주변 ──
  const onNear = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // 권한 거부 → 도시 중심으로 fallback (QA 항목)
        const r = cityRegion(city);
        mapRef.current?.animateToRegion(r, 500);
        showToast(t('biz.locNoPermCity'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMyLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
      showToast(t('biz.locShown'));
    } catch {
      showToast(t('biz.locFail'));
    }
  }, [city, showToast, t]);

  // 클러스터 탭 → (업체) 묶인 리스트 시트 / (숙소) 확대
  const onCluster = useCallback((cl) => {
    setCityOpen(false);
    if (isStay) {
      mapRef.current?.animateToRegion(
        { latitude: cl.lat, longitude: cl.lng, latitudeDelta: Math.max((region.latitudeDelta || 0.1) / 2.4, 0.01), longitudeDelta: Math.max((region.longitudeDelta || 0.1) / 2.4, 0.01) },
        400
      );
      return;
    }
    const sorted = [...cl.items].sort(
      (a, b) => (b.ratingCount - a.ratingCount) || (b.bookmarkCount - a.bookmarkCount) || a.name.localeCompare(b.name)
    );
    setClusterSheet(sorted);
  }, [isStay, region]);

  // 길찾기 — 구글맵으로 연동 (앱 설치 시 구글맵 앱, 미설치 시 브라우저로 열림)
  const onDirections = useCallback((biz) => {
    let url;
    if (biz.lat != null && biz.lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${biz.lat},${biz.lng}&destination_place_id=&travelmode=driving`;
    } else {
      const q = encodeURIComponent(`${biz.name || ''} ${biz.address || ''}`.trim());
      url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    Linking.openURL(url).catch(() => showToast(t('biz.mapOpenFail')));
  }, [showToast, t]);

  const onSubmitReport = useCallback(async (reasonKey) => {
    setReportOpen(false);
    const target = selected;
    if (!target) return;
    try {
      await reportBusiness(target.id, reasonKey);
      showToast(t('biz.reportReceived'));
    } catch (e) {
      showToast(t('biz.reportFail'));
    }
  }, [selected, showToast, t]);

  const cityLabel = city === MY_LOCATION ? t('biz.cityMyLocation') : t(cityLabelKeyOf(city));

  // 시트 리스트 카드 (지도에 보이는 업체)
  const renderCard = useCallback(({ item: b }) => {
    const c = catOf(b.category);
    return (
      <TouchableOpacity style={styles.listCard} activeOpacity={0.85} onPress={() => selectBusiness(b)}>
        <View style={[styles.listEmoji, { backgroundColor: c.soft }]}>
          <Ionicons name={c.ion} size={22} color={c.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={styles.rowCenter}>
            <Text style={styles.listName} numberOfLines={1}>{b.name}</Text>
            <View style={[styles.catChip, { backgroundColor: c.soft }]}>
              <Text style={[styles.catChipText, { color: c.color }]}>{t(c.labelKey)}</Text>
            </View>
          </View>
          {b.ratingCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Stars value={b.ratingAvg} size={11} />
              <Text style={styles.listRating}>{b.ratingAvg.toFixed(1)} · {tn('biz.reviewsN', { n: b.ratingCount })}</Text>
            </View>
          )}
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
  }, [styles, selectBusiness, onToggleBookmark, colors, t, tn]);

  // 시트 리스트 카드 (숙소) — 가격 + 조건 요약
  const renderStayCard = useCallback(({ item: s }) => {
    const c = stayTypeOf(s.stayType);
    const condLabels = (s.conditions || []).slice(0, 2).map((k) => stayCondOf(k)?.labelKey).filter(Boolean).map((lk) => t(lk));
    return (
      <TouchableOpacity style={styles.listCard} activeOpacity={0.85} onPress={() => openStay(s)}>
        <View style={[styles.listEmoji, { backgroundColor: c.soft }]}>
          <Ionicons name={c.ion} size={22} color={c.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={styles.rowCenter}>
            <Text style={styles.listName} numberOfLines={1}>{s.title}</Text>
            <View style={[styles.catChip, { backgroundColor: c.soft }]}>
              <Text style={[styles.catChipText, { color: c.color }]}>{t(c.labelKey)}</Text>
            </View>
          </View>
          <Text style={styles.stayMeta} numberOfLines={1}>
            <Text style={styles.stayPrice}>{formatPrice(s.price)}{t(priceUnitKey(s.priceUnit))}</Text>
            {condLabels.length > 0 ? ` · ${condLabels.join(' · ')}` : ''}
          </Text>
          {!!s.neighborhood && <Text style={styles.listAddr} numberOfLines={1}>{s.neighborhood}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <TouchableOpacity onPress={() => onToggleStayBookmark(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={s.bookmarked ? 'star' : 'star-outline'} size={18} color={s.bookmarked ? '#F59E0B' : colors.textSecondary} />
          </TouchableOpacity>
          {s.distanceKm != null && <Text style={styles.listDist}>{formatDistance(s.distanceKm)}</Text>}
        </View>
      </TouchableOpacity>
    );
  }, [styles, openStay, onToggleStayBookmark, colors, t]);

  return (
    <View style={styles.container} onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}>
      {/* ── 지도 / 리스트 본문 ── */}
      <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onMapReady={() => {
            setMapReady(true);
            const target = myLocation
              ? { ...myLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }
              : cityRegion(city);
            mapRef.current?.animateToRegion(target, 0);
          }}
          onRegionChangeComplete={(r) => setRegion(r)}
          onPress={() => setCityOpen(false)}
          showsUserLocation={!!myLocation}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {mapReady && pins.map((b) => {
            const c = isStay ? { color: STAY_ACCENT, ion: 'bed' } : catOf(b.category);
            const isSel = !isStay && selected?.id === b.id;
            return (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                onPress={() => (isStay ? openStay(b) : selectBusiness(b))}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={markerTracking}
              >
                <Pin cat={c} selected={isSel} />
              </Marker>
            );
          })}
          {mapReady && clusters.map((cl) => (
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

      {/* ── 상단 컨트롤 (도시 선택 + 카운트 + 카테고리 칩) ── */}
      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <TouchableOpacity style={styles.cityBtn} activeOpacity={0.85} onPress={() => setCityOpen((v) => !v)}>
            <Ionicons name="location" size={15} color={PRIMARY} />
            <Text style={styles.cityBtnText}>{cityLabel}</Text>
            <Ionicons name={cityOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#888888" />
          </TouchableOpacity>
          {/* 검색 — 업체명/주소 실시간 필터 (지도 핀·리스트 모두 적용) */}
          <View style={styles.searchPill}>
            <Ionicons name="search" size={15} color="#888888" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('biz.searchPh')}
              placeholderTextColor="#999999"
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              onFocus={() => setCityOpen(false)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); Keyboard.dismiss(); }} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={16} color="#BBBBBB" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          pointerEvents="auto"
        >
          {/* ⭐ 즐겨찾기만 보기 (카테고리와 독립 토글) */}
          <TouchableOpacity
            style={[styles.chip, bookmarkOnly ? styles.chipBookmarkActive : styles.chipInactive]}
            activeOpacity={0.8}
            onPress={() => { setBookmarkOnly((v) => !v); setCityOpen(false); }}
          >
            <Ionicons name={bookmarkOnly ? 'star' : 'star-outline'} size={13} color={bookmarkOnly ? '#FFFFFF' : '#F59E0B'} />
          </TouchableOpacity>
          {[
            { key: 'all', labelKey: 'biz.catAll', ion: null },
            { key: 'stay', labelKey: 'stay.mapChip', ion: 'bed', color: STAY_ACCENT },
            ...BUSINESS_CATEGORIES,
          ].map((c) => {
            const active = category === c.key;
            const activeBg = c.key === 'stay' ? styles.chipStayActive : styles.chipActive;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, active ? activeBg : styles.chipInactive]}
                activeOpacity={0.8}
                onPress={() => { setCategory(c.key); setCityOpen(false); }}
              >
                {!!c.ion && (
                  <Ionicons name={c.ion} size={13} color={active ? '#FFFFFF' : c.color} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : '#555555' }]}>
                  {t(c.labelKey)}
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
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 내 위치로 이동 */}
              <TouchableOpacity style={styles.cityOption} activeOpacity={0.7} onPress={() => { setCityOpen(false); setCity(MY_LOCATION); onNear(); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="navigate" size={15} color={PRIMARY} />
                  <Text style={[styles.cityOptionText, { color: PRIMARY, fontWeight: '700' }]}>{t('biz.cityMyLocation')}</Text>
                </View>
                {city === MY_LOCATION && <Ionicons name="checkmark" size={16} color={PRIMARY} />}
              </TouchableOpacity>
              {BUSINESS_CITIES.map((c) => {
                const active = c.key === city;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.cityOption, styles.cityOptionBorder]}
                    activeOpacity={0.7}
                    onPress={() => setCity(c.key)}
                  >
                    <Text style={[styles.cityOptionText, active && { color: PRIMARY, fontWeight: '700' }]}>{t(c.labelKey)}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* ── 우하단 FAB (시트 위로) — 시트 펼침 시엔 숨김 ── */}
      {snap !== 'full' && (
        <View style={[styles.fabColumn, { bottom: PEEK + 12 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.nearFab} activeOpacity={0.85} onPress={onNear}>
            <Ionicons name="navigate" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reportFab, isStay && styles.reportFabStay]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate(isStay ? 'StayCreate' : 'BusinessReport', isStay ? { city } : undefined)}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.reportFabText}>{isStay ? t('stay.registerFab') : t('biz.addPlace')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── OpenTable식 하단 리스트 시트 (지도 위로 드래그) ── */}
      <Animated.View style={[styles.bizSheet, { top: SHEET_TOP, height: SHEET_H, transform: [{ translateY: sheetY }] }]}>
        <View {...pan.panHandlers} style={styles.bizSheetHandleArea} onLayout={(e) => setHandleH(Math.round(e.nativeEvent.layout.height))}>
          <View style={styles.bizSheetHandle} />
          <Text style={styles.bizSheetCount}>
            {isStay ? tn('stay.areaCount', { n: visibleBusinesses.count }) : tn('biz.thisArea', { n: visibleBusinesses.count })}
          </Text>
        </View>
        <FlatList
          data={visibleBusinesses.items}
          keyExtractor={(b) => b.id}
          scrollEnabled={snap !== 'peek'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); isStay ? loadStays() : load(); }} tintColor={PRIMARY} />}
          renderItem={isStay ? renderStayCard : renderCard}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyWrap}>
                <Ionicons name={isStay ? 'bed-outline' : 'map-outline'} size={34} color="#9CA3AF" />
                <Text style={styles.emptyText}>
                  {bookmarkOnly
                    ? t('biz.noBookmarks')
                    : query.trim()
                      ? tn('biz.noSearch', { q: query.trim() })
                      : isStay ? t('stay.noneHere') : t('biz.noneHere')}
                </Text>
              </View>
            )
          }
        />
      </Animated.View>

      {/* 시트 펼침 시 → 지도로 복귀 버튼 */}
      {snap === 'full' && (
        <TouchableOpacity
          style={[styles.mapReturnBtn, { bottom: insets.bottom + 18 }]}
          activeOpacity={0.9}
          onPress={() => snapSheet('peek')}
        >
          <Ionicons name="map" size={16} color="#FFFFFF" />
          <Text style={styles.mapReturnText}>{t('biz.mapBtn')}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      )}

      {/* ── 클러스터 리스트 바텀시트 (묶인 업체 N곳) ── */}
      <Modal visible={!!clusterSheet} transparent animationType="slide" onRequestClose={() => setClusterSheet(null)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setClusterSheet(null)} />
        {clusterSheet && (
          <View style={[styles.sheet, { maxHeight: '62%' }]}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <Text style={styles.clusterSheetTitle}>{tn('biz.clusterTitle', { n: clusterSheet.length })}</Text>
            <FlatList
              data={clusterSheet}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 16 }}
              renderItem={({ item: b, index }) => {
                const c = catOf(b.category);
                return (
                  <TouchableOpacity
                    style={[styles.clusterRow, index > 0 && styles.clusterRowBorder]}
                    activeOpacity={0.75}
                    onPress={() => { setClusterSheet(null); selectBusiness(b); }}
                  >
                    <View style={[styles.listEmoji, { backgroundColor: c.soft }]}>
                      <Ionicons name={c.ion} size={20} color={c.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.listName} numberOfLines={1}>{b.name}</Text>
                      {b.ratingCount > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Stars value={b.ratingAvg} size={11} />
                          <Text style={styles.listRating}>{b.ratingAvg.toFixed(1)} · {tn('biz.reviewsN', { n: b.ratingCount })}</Text>
                        </View>
                      ) : (
                        <Text style={styles.listRating}>{t(c.labelKey)}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </Modal>

      {/* ── 업체 상세 바텀시트 ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && (
          <View style={[styles.sheet, sheetFull && { maxHeight: '82%' }]}>
            <TouchableOpacity style={styles.handleWrap} activeOpacity={0.7} onPress={() => setSheetFull((v) => !v)}>
              <View style={styles.handle} />
            </TouchableOpacity>
            <ScrollView
              scrollEnabled={sheetFull}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 20, gap: 14 }}
            >
              <SheetHeader biz={selected} colors={colors} t={t} tn={tn} onBookmark={() => onToggleBookmark(selected)} />
              <View style={{ gap: 10 }}>
                <InfoRow icon="location-outline" text={selected.address} colors={colors} />
                <InfoRow icon="call-outline" text={selected.phone || t('biz.noPhone')} colors={colors} />
                <InfoRow icon="time-outline" text={selected.hours || t('biz.noHours')} colors={colors} />
              </View>
              {sheetFull && !!selected.description && (
                <View style={styles.descBox}>
                  <Text style={styles.descText}>{selected.description}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.dirBtn} activeOpacity={0.9} onPress={() => onDirections(selected)}>
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text style={styles.dirBtnText}>{t('biz.directions')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportBtn} activeOpacity={0.85} onPress={() => setReportOpen(true)}>
                  <Ionicons name="flag-outline" size={15} color="#FF4444" />
                  <Text style={styles.reportBtnText}>{t('biz.report')}</Text>
                </TouchableOpacity>
              </View>
              {/* ── 리뷰 (시트 확장 시) ── */}
              {sheetFull ? (
                <BusinessReviewsSection
                  biz={selected}
                  colors={colors}
                  isLoggedIn={!!user}
                  showToast={showToast}
                  onAggregate={(ratingAvg, ratingCount) => {
                    setSelected((s) => (s ? { ...s, ratingAvg, ratingCount } : s));
                    setBusinesses((prev) => prev.map((b) => (b.id === selected.id ? { ...b, ratingAvg, ratingCount } : b)));
                  }}
                />
              ) : (
                <TouchableOpacity style={styles.reviewPeek} activeOpacity={0.8} onPress={() => setSheetFull(true)}>
                  <Stars value={selected.ratingAvg} size={13} />
                  <Text style={styles.reviewPeekText}>
                    {selected.ratingCount > 0
                      ? `${selected.ratingAvg.toFixed(1)} · ${tn('biz.seeReviewsN', { n: selected.ratingCount })}`
                      : t('biz.firstReview')}
                  </Text>
                  <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── 신고 모달 ── */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <TouchableOpacity style={styles.reportBackdrop} activeOpacity={1} onPress={() => setReportOpen(false)}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>{t('biz.reportTitle')}</Text>
            <View style={{ gap: 4 }}>
              {BUSINESS_REPORT_REASONS.map((r) => (
                <TouchableOpacity key={r.key} style={styles.reportReason} activeOpacity={0.8} onPress={() => onSubmitReport(r.key)}>
                  <Text style={styles.reportReasonText}>{t(r.labelKey)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.reportCancel} activeOpacity={0.8} onPress={() => setReportOpen(false)}>
                <Text style={styles.reportCancelText}>{t('biz.cancel')}</Text>
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
      {/* 신아키텍처 인터롭에서 마커 자식이 조건부로 mount/unmount 되면
          -[AIRMap insertReactSubview:] nil 크래시 발생 → 항상 렌더하고 opacity로 숨김 */}
      <View style={[pinStyles.ring, { borderColor: 'rgba(127,119,221,0.9)', opacity: selected ? 1 : 0 }]} />
      <View style={[pinStyles.pin, { backgroundColor: cat.color, width: selected ? 36 : 30, height: selected ? 36 : 30 }]}>
        <Ionicons name={cat.ion} size={selected ? 17 : 15} color="#FFFFFF" />
      </View>
    </View>
  );
}

function SheetHeader({ biz, colors, onBookmark, t, tn }) {
  const c = catOf(biz.category);
  const styles = createStyles(colors);
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={[styles.sheetEmoji, { backgroundColor: c.soft }]}>
        <Ionicons name={c.ion} size={30} color={c.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={styles.sheetName} numberOfLines={2}>{biz.name}</Text>
        {biz.ratingCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Stars value={biz.ratingAvg} size={13} />
            <Text style={styles.sheetRating}>{biz.ratingAvg.toFixed(1)} · {tn('biz.reviewsN', { n: biz.ratingCount })}</Text>
          </View>
        )}
        <View style={styles.rowCenter}>
          <View style={[styles.catChip, { backgroundColor: c.soft }]}>
            <Text style={[styles.catChipText, { color: c.color }]}>{t(c.labelKey)}</Text>
          </View>
          <Text style={styles.sourceText}>{t(sourceKeyOf(biz.source))}</Text>
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

// 거리 기반 그리디 클러스터링 — 격자 방식은 경계에 걸친 핀이 옆 묶음으로 갈라져
// 숫자가 부정확해 보이는 문제가 있어 반경 병합 방식으로 교체
function clusterBusinesses(items, region) {
  if (!region || !region.latitudeDelta) return { pins: items, clusters: [] };
  const radius = Math.max(region.latitudeDelta, region.longitudeDelta) / 14; // 화면 크기 대비 병합 반경
  if (!(radius > 0)) return { pins: items, clusters: [] };
  const lngScale = Math.cos((region.latitude * Math.PI) / 180) || 1; // 경도 보정 (토론토 위도)

  const used = new Array(items.length).fill(false);
  const pins = [];
  const clusters = [];

  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    const seed = items[i];
    const group = [seed];
    used[i] = true;
    for (let j = i + 1; j < items.length; j++) {
      if (used[j]) continue;
      const dLat = items[j].lat - seed.lat;
      const dLng = (items[j].lng - seed.lng) * lngScale;
      if (dLat * dLat + dLng * dLng <= radius * radius) {
        group.push(items[j]);
        used[j] = true;
      }
    }
    if (group.length === 1) {
      pins.push(seed);
    } else {
      const lat = group.reduce((s, x) => s + x.lat, 0) / group.length;
      const lng = group.reduce((s, x) => s + x.lng, 0) / group.length;
      clusters.push({ id: `c_${seed.id}`, lat, lng, count: group.length, items: group });
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 999, paddingHorizontal: 12, height: 38,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A1A', paddingVertical: 0 },
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
  chipRow: { gap: 8, paddingHorizontal: 14, paddingVertical: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  chipActive: { backgroundColor: '#334155' },
  chipStayActive: { backgroundColor: STAY_ACCENT },
  chipInactive: { backgroundColor: 'rgba(255,255,255,0.97)' },
  chipBookmarkActive: { backgroundColor: '#F59E0B' },
  chipText: { fontSize: 13, fontWeight: '600' },

  // 클러스터
  cluster: {
    minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 8,
    backgroundColor: PRIMARY, borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  clusterText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // OpenTable식 하단 리스트 시트
  bizSheet: {
    position: 'absolute', left: 0, right: 0, zIndex: 40,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16,
  },
  bizSheetHandleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  bizSheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 8 },
  bizSheetCount: { fontSize: 15, fontWeight: '700', color: colors.text },
  mapReturnBtn: {
    position: 'absolute', alignSelf: 'center', zIndex: 50,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1A1A1A', paddingVertical: 11, paddingHorizontal: 20, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8,
  },
  mapReturnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // FAB
  fabColumn: { position: 'absolute', right: 14, bottom: 74, zIndex: 30, alignItems: 'flex-end', gap: 10 },
  nearFab: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  reportFab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 13, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#10B981',
    shadowColor: '#10B981', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  reportFabStay: { backgroundColor: STAY_ACCENT, shadowColor: STAY_ACCENT },
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
  stayMeta: { fontSize: 13, color: colors.textSecondary },
  stayPrice: { fontSize: 13, fontWeight: '800', color: STAY_ACCENT },
  listRating: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  // 클러스터 리스트 시트
  clusterSheetTitle: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 18, paddingBottom: 10, letterSpacing: -0.3 },
  clusterRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  clusterRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  catChip: { paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999 },
  catChipText: { fontSize: 10, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  // 바텀시트
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  // 업체 상세는 지도 위로 뜨되 지도가 보여야 함(어디 있는지 확인) → 딤 없이 투명
  detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  handleWrap: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border },
  sheetEmoji: { width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sheetRating: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  sourceText: { fontSize: 11, color: colors.textSecondary },
  reviewPeek: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface,
  },
  reviewPeekText: { fontSize: 13, fontWeight: '600', color: colors.text },
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
