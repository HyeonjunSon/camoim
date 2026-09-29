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
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
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
const MY_LOCATION = '__me__'; // This city value means "near me" mode (no city filter, just what is around you)

// Floating map controls sit on top of map tiles, so they keep a fixed light style
export default function BusinessMapScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLang();
  // Strings carrying a count or query substitute {n}/{q} by hand (t does no interpolation)
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
  const [query, setQuery] = useState(''); // Search by name or address
  const [bookmarkOnly, setBookmarkOnly] = useState(false); // ⭐ Favourites only
  const [businesses, setBusinesses] = useState([]);
  const [stays, setStays] = useState([]); // Stays (used when category === 'stay')
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isStay = category === 'stay'; // Stay mode — its own data, pins, cards and detail screen

  const [cityOpen, setCityOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [clusterSheet, setClusterSheet] = useState(null); // Tapping a cluster opens the list of businesses it holds (OpenTable style)

  const [myLocation, setMyLocation] = useState(null);
  const [region, setRegion] = useState(() => ({
    ...cityRegion('toronto'),
  }));
  // Every programmatic map move goes through this — it writes the destination region into state
  // immediately, so counts and lists never drift from the screen if onRegionChangeComplete is late or never fires
  const goToRegion = useCallback((r, duration = 500) => {
    setRegion(r);
    mapRef.current?.animateToRegion(r, duration);
  }, []);
  const [markerTracking, setMarkerTracking] = useState(true);
  const [mapReady, setMapReady] = useState(false); // Prevents the interop crash when markers mount before the map is ready

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── Load data: every approved business in the city. The category filter is applied client-side, instantly ──
  const load = useCallback(async () => {
    try {
      const near = myLocation ? `${myLocation.longitude},${myLocation.latitude}` : undefined;
      // In near-me mode, load everything without a city filter and sort by distance (so nearby places show up)
      const res = await getBusinesses({ city: city === MY_LOCATION ? undefined : city, near });
      if (res.success) setBusinesses(res.data || []);
    } catch (e) {
      showToast(t('biz.loadFail'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, myLocation, showToast, t]);

  // ── Load stays (stay mode only) — not limited by city, so panning anywhere shows that area's stays ──
  const loadStays = useCallback(async () => {
    try {
      const near = myLocation ? `${myLocation.longitude},${myLocation.latitude}` : undefined;
      const res = await getStays({ near }); // No city filter = all of Canada
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

  // Pick up newly created entries when the screen regains focus (only the data for the current mode)
  useFocusEffect(useCallback(() => {
    if (isStay) loadStays();
    else load();
  }, [isStay, load, loadStays]));

  // ── Start from the current location on first entry (OpenTable style) ──
  // Ask for permission → if granted, centre on the user and sort by distance (near). If denied, stay on the city centre, silently
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(loc);
        setCity(MY_LOCATION); // Start from the user's location (label = near me, businesses loaded around them)
        goToRegion({ ...loc, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 700);
      } catch {
        // Location failed → keep the city centre
      }
    })();
  }, []);

  // ── Opened from a home trending card: auto-open that business (the focusId param) ──
  useEffect(() => {
    const focusId = route?.params?.focusId;
    if (!focusId || businesses.length === 0) return;
    const target = businesses.find((b) => b.id === focusId);
    if (target) selectBusiness(target);
    navigation.setParams({ focusId: undefined }); // Prevents re-opening it on every return to the screen
  }, [route?.params?.focusId, businesses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened externally on a specific category (stays, say) — the "view on map" entry point
  useEffect(() => {
    const c = route?.params?.category;
    if (c) {
      setCategory(c);
      navigation.setParams({ category: undefined });
    }
  }, [route?.params?.category]); // eslint-disable-line react-hooks/exhaustive-deps

  // City change → move the map and reset the selection and dropdown
  useEffect(() => {
    setSelected(null);
    setCityOpen(false);
    if (city === MY_LOCATION) return; // In near-me mode onNear owns the camera (so it does not snap back to the city centre)
    goToRegion(cityRegion(city), 500);
  }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching mode (category) clears the business detail and cluster sheets (no stay ↔ business ghosting)
  useEffect(() => {
    setSelected(null);
    setClusterSheet(null);
    setBookmarkOnly(false);
  }, [category]);

  // Minimize marker re-renders: tracking is on only briefly after data or selection changes
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

  // ── OpenTable style: the businesses inside the current viewport (for the horizontal cards below) ──
  const visibleBusinesses = useMemo(() => {
    if (!region?.latitudeDelta) return { items: [], count: 0 };
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
    return { items: inView.slice(0, 80), count: inView.length }; // The list is capped at 80; the count stays exact
  }, [pinnable, region]);

  // ── OpenTable-style draggable bottom sheet (the list rises over the map) ──
  // The real render area, excluding the tab bar, is measured with onLayout — using the Dimensions window
  // height pushes the sheet down by the tab bar height and hides the FAB (and iOS/Android tab bars differ, so no constant works)
  const [containerH, setContainerH] = useState(SCREEN_H);
  const SHEET_TOP = insets.top + 104;      // The sheet's top position, just under the search field and chips
  const SHEET_H = containerH - SHEET_TOP;
  const [handleH, setHandleH] = useState(50);   // Measured height of the handle and count area
  const [listContentH, setListContentH] = useState(0); // Measured height of the list content, excluding padding
  const PEEK = handleH + 10;                // Collapsed: handle, count and the top 10dp of a card (so no text is clipped)
  const peekY = Math.max(SHEET_H - PEEK, 0);
  // The full snap is adaptive: the sheet rises exactly to the last card, with no empty space below.
  // Only when the content exceeds the sheet's maximum does it go fullscreen and add clearance for the 'map' button.
  const PAD_SMALL = 14;                     // Minimum gap below the last card
  const PAD_FULL = 78;                      // Fullscreen snap: the 'map' button (≈42) plus 18 above and below, centring it
  const needsFullScreen = listContentH > 0 && handleH + listContentH + PAD_SMALL >= SHEET_H;
  const fullY = !listContentH || needsFullScreen
    ? 0
    : SHEET_H - (handleH + listContentH + PAD_SMALL);
  // Clamp so the half snap (3 cards) never rises past the end of the content (with 2 cards, half = full)
  const halfY = Math.max(SHEET_H - 290, fullY);

  const sheetY = useRef(new Animated.Value(peekY)).current;
  const curY = useRef(peekY);
  const dragFrom = useRef(peekY);
  const snapRef = useRef('peek');
  const [snap, setSnap] = useState('peek'); // peek | half | full
  // How far the sheet frame is pushed off-screen at the current snap — the list needs exactly this much
  // bottom padding for scrolling to reach the last card at any snap
  const snapOffsetY = snap === 'full' ? fullY : snap === 'half' ? halfY : peekY;
  // The 'map' button clearance applies only at the fullscreen snap where it actually appears; otherwise stop at the cards
  const listPad = needsFullScreen && snap === 'full' ? PAD_FULL : PAD_SMALL;

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

  // When the snap coordinates change (re-measure, rotation, content height), realign to the current snap
  // The full snap moves often with content size, so it is followed with a spring
  useEffect(() => {
    const to = snapRef.current === 'full' ? fullY : snapRef.current === 'half' ? halfY : peekY;
    if (snapRef.current === 'full') {
      Animated.spring(sheetY, { toValue: to, useNativeDriver: false, bounciness: 2, speed: 14 }).start();
    } else {
      sheetY.setValue(to);
    }
  }, [fullY, halfY, peekY, sheetY]);

  // PanResponder is created once, so the latest snap coordinates are passed by ref (avoiding a stale closure)
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
        if (Math.abs(g.dy) < 5) { // A light tap toggles between collapsed and half
          snapSheetRef.current(snapRef.current === 'peek' ? 'half' : 'peek');
          return;
        }
        const s = snapsRef.current;
        const y = curY.current + g.vy * 90; // Account for momentum
        const opts = [['full', s.fullY], ['half', s.halfY], ['peek', s.peekY]];
        opts.sort((a, b) => Math.abs(y - a[1]) - Math.abs(y - b[1]));
        snapSheetRef.current(opts[0][0]);
      },
    })
  ).current;

  // Simple grid clustering (relative to the current zoom)
  const { pins, clusters } = useMemo(() => clusterBusinesses(pinnable, region), [pinnable, region]);

  const selectBusiness = useCallback((b) => {
    setSheetFull(false);
    setSelected(b);
    setCityOpen(false);
    snapSheet('peek'); // Collapse the list sheet when the detail sheet opens (so map and detail are visible together)
    // Selecting a card or pin moves the map to that business, so "where is it" is answered immediately.
    // The centre is nudged down, putting the pin high enough that the detail sheet does not cover it.
    if (b.lat != null && b.lng != null) {
      const d = 0.02;
      goToRegion({ latitude: b.lat - d * 0.3, longitude: b.lng, latitudeDelta: d, longitudeDelta: d }, 500);
    }
  }, [snapSheet, goToRegion]);

  // Stays open a dedicated detail screen instead of a bottom sheet
  const openStay = useCallback((s) => {
    setCityOpen(false);
    navigation.navigate('StayDetail', { id: s.id, stay: s });
  }, [navigation]);

  // Stay bookmark toggle (optimistic)
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

  // ── Bookmark toggle (optimistic update) ──
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
      // Roll back on failure
      setBusinesses((prev) =>
        prev.map((b) => (b.id === id ? { ...b, bookmarked: !nextOn, bookmarkCount: Math.max(0, (b.bookmarkCount || 0) + (nextOn ? -1 : 1)) } : b))
      );
    }
  }, [showToast, t]);

  // ── Near me ──
  const onNear = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied → fall back to the city centre (a QA checklist item)
        goToRegion(cityRegion(city), 500);
        showToast(t('biz.locNoPermCity'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMyLocation(loc);
      goToRegion({ ...loc, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
      showToast(t('biz.locShown'));
    } catch {
      showToast(t('biz.locFail'));
    }
  }, [city, showToast, t, goToRegion]);

  // Cluster tap → (businesses) the grouped list sheet / (stays) zoom in
  const onCluster = useCallback((cl) => {
    setCityOpen(false);
    if (isStay) {
      goToRegion(
        { latitude: cl.lat, longitude: cl.lng, latitudeDelta: Math.max((region.latitudeDelta || 0.1) / 2.4, 0.01), longitudeDelta: Math.max((region.longitudeDelta || 0.1) / 2.4, 0.01) },
        400
      );
      return;
    }
    const sorted = [...cl.items].sort(
      (a, b) => (b.ratingCount - a.ratingCount) || (b.bookmarkCount - a.bookmarkCount) || a.name.localeCompare(b.name)
    );
    setClusterSheet(sorted);
  }, [isStay, region, goToRegion]);

  // Directions — handed to Google Maps (the app when installed, otherwise the browser)
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

  // Sheet list card (businesses visible on the map)
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

  // Sheet list card (stays) — price plus a condition summary
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
      {/* ── Map / list body ── */}
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
            goToRegion(target, 0);
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

      {/* ── Top controls (city picker + count + category chips) ── */}
      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <TouchableOpacity style={styles.cityBtn} activeOpacity={0.85} onPress={() => setCityOpen((v) => !v)}>
            <Ionicons name="location" size={15} color={PRIMARY} />
            <Text style={styles.cityBtnText}>{cityLabel}</Text>
            <Ionicons name={cityOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#888888" />
          </TouchableOpacity>
          {/* Search — live filter on name and address (applies to both map pins and the list) */}
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
          {/* ⭐ Favourites only (toggles independently of the category) */}
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

      {/* ── City dropdown (topmost overlay, so it clears the chips) ── */}
      {cityOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setCityOpen(false)}>
            <View style={[StyleSheet.absoluteFill, { zIndex: 44 }]} />
          </TouchableWithoutFeedback>
          <View style={[styles.cityDropdown, { top: insets.top + 8 + 44, left: 14 }]}>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Recentre on my location */}
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

      {/* ── Bottom-right FAB (above the sheet) — hidden while the sheet is expanded ── */}
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

      {/* ── OpenTable-style bottom list sheet (dragged up over the map) ──
          Animating the frame height makes FlatList virtualize against the collapsed sheet's small frame
          and stop after a few cards, so the frame stays full height and is pushed with translateY,
          with whatever is off-screen (snapOffsetY) compensated as bottom padding so scrolling reaches the end */}
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
          style={{ flex: 1 }}
          scrollEnabled={snap !== 'peek'}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_, h) => setListContentH(Math.max(0, Math.ceil(h - listPad - snapOffsetY)))}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: listPad + snapOffsetY }}
          scrollIndicatorInsets={{ bottom: snapOffsetY }}
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

      {/* Return-to-map button while the sheet is expanded (fullscreen only — a short sheet already shows the map) */}
      {snap === 'full' && needsFullScreen && (
        <TouchableOpacity
          style={[styles.mapReturnBtn, { bottom: 18 }]}
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

      {/* ── Cluster list bottom sheet (the N businesses it holds) ── */}
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

      {/* ── Business detail bottom sheet ── */}
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
              {/* ── Reviews (once the sheet expands) ── */}
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

      {/* ── Report modal ── */}
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

      {/* ── Toast ── */}
      {!!toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ── Map pins ──
function Pin({ cat, selected }) {
  return (
    <View style={pinStyles.wrap}>
      {/* Conditionally mounting or unmounting a marker's children under the new architecture interop
          crashes with -[AIRMap insertReactSubview:] nil, so children always render and hide via opacity */}
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

// Distance-based greedy clustering — a grid split pins sitting on a boundary into neighbouring
// groups, which made the counts look wrong, so radius merging replaced it
function clusterBusinesses(items, region) {
  if (!region || !region.latitudeDelta) return { pins: items, clusters: [] };
  const radius = Math.max(region.latitudeDelta, region.longitudeDelta) / 14; // Merge radius, relative to the screen size
  if (!(radius > 0)) return { pins: items, clusters: [] };
  const lngScale = Math.cos((region.latitude * Math.PI) / 180) || 1; // Longitude correction (at Toronto's latitude)

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

  // Top controls
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

  // Cluster
  cluster: {
    minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 8,
    backgroundColor: PRIMARY, borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  clusterText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // OpenTable-style bottom list sheet
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

  // Map/list segmented control
  segmentWrap: {
    position: 'absolute', bottom: 14, alignSelf: 'center', zIndex: 30,
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 999, padding: 4, gap: 2,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  segmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 999 },
  segmentActive: { backgroundColor: PRIMARY },
  segmentText: { fontSize: 13, fontWeight: '700' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // List
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
  // Cluster list sheet
  clusterSheetTitle: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 18, paddingBottom: 10, letterSpacing: -0.3 },
  clusterRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  clusterRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  catChip: { paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999 },
  catChipText: { fontSize: 10, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  // Bottom sheet
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  // The business detail floats over the map but must not hide it (you need to see where the place is), so no dim, just transparency
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

  // Report modal
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  reportCard: { width: 290, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', paddingBottom: 12 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 },
  reportReason: { marginHorizontal: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.inputBg, marginBottom: 4 },
  reportReasonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  reportCancel: { marginHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  reportCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // Toast
  toastWrap: {
    position: 'absolute', alignSelf: 'center', bottom: 110, zIndex: 90,
    backgroundColor: 'rgba(26,26,26,0.92)', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999, maxWidth: 330,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
