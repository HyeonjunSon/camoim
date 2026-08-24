// 숙소 상세 — 사진 / 정보 / 대략 위치 지도 / 호스트 / 채팅 문의
// 정확 주소·좌표는 서버가 안 내려줌 → 대략 위치 원(circle)만 표시.
import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { stayTypeOf, stayCondOf, STAY_ACCENT, formatPrice, htmlToPlain, formatMoveIn } from '../../constants/stays';
import { STAY_REPORT_REASONS } from '../../constants/stays';
import { getStay, toggleStayBookmark, setStayStatus, deleteStay, reportStay, startChat } from '../../lib/api';

const W = Dimensions.get('window').width;

export default function StayDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const stayId = route?.params?.id;
  const [stay, setStay] = useState(route?.params?.stay || null);
  const [loading, setLoading] = useState(!route?.params?.stay);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getStay(stayId);
      if (res.success) setStay(res.data);
      else Alert.alert(t('biz.errorTitle'), t('stay.notFound'), [{ text: t('biz.confirmOk'), onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert(t('biz.errorTitle'), t('stay.loadFail'), [{ text: t('biz.confirmOk'), onPress: () => navigation.goBack() }]);
    } finally {
      setLoading(false);
    }
  }, [stayId, navigation, t]);

  useEffect(() => { if (stayId) load(); }, [load, stayId]);

  const isMine = stay?.isMine || (user && stay?.host?.id && String(stay.host.id) === String(user.id));

  const onBookmark = useCallback(async () => {
    if (!stay) return;
    const next = !stay.bookmarked;
    setStay((s) => ({ ...s, bookmarked: next, bookmarkCount: Math.max(0, (s.bookmarkCount || 0) + (next ? 1 : -1)) }));
    try {
      const res = await toggleStayBookmark(stay.id);
      if (res?.success) setStay((s) => ({ ...s, bookmarked: res.bookmarked, bookmarkCount: res.bookmarkCount }));
    } catch {
      setStay((s) => ({ ...s, bookmarked: !next, bookmarkCount: Math.max(0, (s.bookmarkCount || 0) + (next ? -1 : 1)) }));
    }
  }, [stay]);

  const onChat = useCallback(async () => {
    if (!stay?.host?.id) return;
    if (isMine) { Alert.alert(t('stay.inquireSelf')); return; }
    setBusy(true);
    try {
      const res = await startChat(stay.host.id);
      if (res?.success && res.data) navigation.navigate('ChatRoom', { roomId: res.data.id, other: res.data.other });
      else Alert.alert(t('biz.errorTitle'), t('stay.chatFail'));
    } catch {
      Alert.alert(t('biz.errorTitle'), t('stay.chatFail'));
    } finally {
      setBusy(false);
    }
  }, [stay, isMine, navigation, t]);

  const onToggleStatus = useCallback(async () => {
    if (!stay) return;
    const next = stay.status === 'active' ? 'closed' : 'active';
    setStay((s) => ({ ...s, status: next }));
    try { await setStayStatus(stay.id, next); }
    catch { setStay((s) => ({ ...s, status: stay.status })); }
  }, [stay]);

  const onDelete = useCallback(() => {
    Alert.alert(t('stay.deleteTitle'), t('stay.deleteMsg'), [
      { text: t('biz.cancel'), style: 'cancel' },
      {
        text: t('biz.delete'), style: 'destructive',
        onPress: async () => {
          try { await deleteStay(stay.id); navigation.goBack(); }
          catch { Alert.alert(t('biz.errorTitle'), t('biz.deleteFail')); }
        },
      },
    ]);
  }, [stay, navigation, t]);

  const onReport = useCallback(async (reasonKey) => {
    setReportOpen(false);
    try { await reportStay(stay.id, reasonKey); Alert.alert(t('biz.reportReceived')); }
    catch { Alert.alert(t('biz.errorTitle'), t('biz.reportFail')); }
  }, [stay, t]);

  const rightActions = isMine
    ? [{ icon: 'pencil', onPress: () => navigation.navigate('StayCreate', { stay }), label: 'edit' },
       { icon: 'trash-outline', onPress: onDelete, color: '#FF4444', label: 'delete' }]
    : [{ icon: 'flag-outline', onPress: () => setReportOpen(true), label: 'report' }];

  if (loading || !stay) {
    return (
      <View style={styles.container}>
        <CustomHeader navigation={navigation} title={t('stay.detailTitle')} />
        <View style={styles.center}><ActivityIndicator size="large" color={STAY_ACCENT} /></View>
      </View>
    );
  }

  const c = stayTypeOf(stay.stayType);
  const hasCoord = stay.lat != null && stay.lng != null;
  const infoRows = [
    stay.moveInDate && { label: t('stay.moveInLabel'), value: formatMoveIn(stay.moveInDate, lang, t) },
    stay.minLeaseMonths > 0 && { label: t('stay.minLeaseLabel'), value: `${stay.minLeaseMonths}${t('stay.monthsUnit')}` },
    stay.deposit > 0 && { label: t('stay.depositLabel'), value: formatPrice(stay.deposit) },
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <CustomHeader navigation={navigation} title={t('stay.detailTitle')} rightActions={rightActions} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        {/* 사진 */}
        <View style={styles.photoWrap}>
          {stay.images?.length > 0 ? (
            <>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / W))}>
                {stay.images.map((url) => (
                  <Image key={url} source={{ uri: url }} style={{ width: W, height: 230 }} contentFit="cover" />
                ))}
              </ScrollView>
              {stay.images.length > 1 && (
                <View style={styles.counter}><Text style={styles.counterText}>{photoIdx + 1} / {stay.images.length}</Text></View>
              )}
            </>
          ) : (
            <View style={styles.photoEmpty}><Ionicons name={c.ion} size={54} color={c.color} /></View>
          )}
        </View>

        {/* 타이틀 블록 */}
        <View style={{ padding: 16 }}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: c.soft }]}>
              <Text style={[styles.typeBadgeText, { color: c.color }]}>{t(c.labelKey)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: stay.status === 'active' ? '#E8FFF1' : '#F1F1F4' }]}>
              <Text style={[styles.statusText, { color: stay.status === 'active' ? '#2D9E5A' : '#8E8E96' }]}>
                {stay.status === 'active' ? t('stay.statusActive') : t('stay.statusClosed')}
              </Text>
            </View>
          </View>
          <Text style={styles.title}>{stay.title}</Text>
          {!!stay.neighborhood && <Text style={styles.neighborhood}>{stay.neighborhood}</Text>}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(stay.price)}</Text>
            <Text style={styles.priceUnit}>{t('stay.perMonth')}</Text>
          </View>
          {stay.conditions?.length > 0 && (
            <View style={styles.condRow}>
              {stay.conditions.map((k) => {
                const cond = stayCondOf(k);
                if (!cond) return null;
                return <View key={k} style={styles.condChip}><Text style={styles.condChipText}>{t(cond.labelKey)}</Text></View>;
              })}
            </View>
          )}
        </View>

        {/* 기본 정보 */}
        {infoRows.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={{ padding: 16 }}>
              <Text style={styles.sectionTitle}>{t('stay.sectionBasic')}</Text>
              <View style={styles.infoCard}>
                {infoRows.map((r, i) => (
                  <View key={r.label} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
                    <Text style={styles.infoLabel}>{r.label}</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>{r.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* 소개 */}
        {!!stay.description && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={styles.sectionTitle}>{t('stay.sectionAbout')}</Text>
            <Text style={styles.desc}>{htmlToPlain(stay.description)}</Text>
          </View>
        )}

        {/* 위치 (대략) */}
        {hasCoord && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={styles.sectionTitle}>{t('stay.sectionLocation')}</Text>
            <View style={styles.mapCard} pointerEvents="none">
              <MapView
                provider={PROVIDER_DEFAULT}
                style={StyleSheet.absoluteFill}
                initialRegion={{ latitude: stay.lat, longitude: stay.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
                scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
                toolbarEnabled={false} showsCompass={false}
              >
                <Marker coordinate={{ latitude: stay.lat, longitude: stay.lng }} anchor={{ x: 0.5, y: 1 }}>
                  <View style={styles.mapPin}><Ionicons name="bed" size={14} color="#FFFFFF" /></View>
                </Marker>
              </MapView>
            </View>
            {!!stay.address && (
              <View style={styles.hintRow}>
                <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.approxNote}>{stay.address}</Text>
              </View>
            )}
          </View>
        )}

        {/* 호스트 */}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.hostRow} activeOpacity={0.7}
          onPress={() => stay.host?.id && navigation.navigate('UserProfile', { userId: stay.host.id })}>
          <View style={styles.hostAvatar}><Text style={styles.hostAvatarText}>{(stay.host?.nickname || '?').slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.hostName} numberOfLines={1}>{stay.host?.nickname || ''}</Text>
              {stay.host?.verified && <Text style={styles.hostVerified}>{t('stay.hostVerified')}</Text>}
            </View>
            <Text style={styles.hostSub}>{t('stay.hostTitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>

      {/* 하단 CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        {isMine ? (
          <TouchableOpacity style={styles.ctaMain} activeOpacity={0.9} onPress={onToggleStatus}>
            <Ionicons name={stay.status === 'active' ? 'checkmark-done' : 'refresh'} size={17} color="#FFFFFF" />
            <Text style={styles.ctaMainText}>{stay.status === 'active' ? t('stay.markTaken') : t('stay.markAvailable')}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.ctaBookmark} activeOpacity={0.8} onPress={onBookmark}>
              <Ionicons name={stay.bookmarked ? 'star' : 'star-outline'} size={21} color={stay.bookmarked ? '#F59E0B' : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaMain} activeOpacity={0.9} onPress={onChat} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <>
                  <Ionicons name="chatbubble-ellipses" size={17} color="#FFFFFF" />
                  <Text style={styles.ctaMainText}>{t('stay.ctaChat')}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 신고 모달 */}
      {reportOpen && (
        <TouchableOpacity style={styles.reportBackdrop} activeOpacity={1} onPress={() => setReportOpen(false)}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>{t('biz.reportTitle')}</Text>
            {STAY_REPORT_REASONS.map((r) => (
              <TouchableOpacity key={r.key} style={styles.reportReason} activeOpacity={0.8} onPress={() => onReport(r.key)}>
                <Text style={styles.reportReasonText}>{t(r.labelKey)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.reportCancel} activeOpacity={0.8} onPress={() => setReportOpen(false)}>
              <Text style={styles.reportCancelText}>{t('biz.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoWrap: { height: 230, backgroundColor: colors.inputBg, position: 'relative' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  counterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 21, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginTop: 10 },
  neighborhood: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 12 },
  price: { fontSize: 25, fontWeight: '800', color: STAY_ACCENT, letterSpacing: -0.5 },
  priceUnit: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  condRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  condChip: { backgroundColor: colors.inputBg, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  condChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  divider: { height: 8, backgroundColor: colors.inputBg },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  infoCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  infoRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  infoLabel: { fontSize: 13, color: colors.textSecondary, flexShrink: 0 },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  desc: { fontSize: 14, lineHeight: 23, color: colors.textSecondary },
  mapCard: { borderRadius: 14, overflow: 'hidden', height: 130, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mapPin: { width: 28, height: 28, borderRadius: 999, backgroundColor: STAY_ACCENT, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  approxNote: { fontSize: 12, color: colors.textSecondary },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  hostAvatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: '#EDEBFB', alignItems: 'center', justifyContent: 'center' },
  hostAvatarText: { fontSize: 17, fontWeight: '700', color: '#7F77DD' },
  hostName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  hostVerified: { fontSize: 11, fontWeight: '700', color: '#2D9E5A', flexShrink: 0 },
  hostSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  ctaBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ctaBookmark: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ctaMain: { flex: 1, height: 52, borderRadius: 12, backgroundColor: '#7F77DD', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: '#7F77DD', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  ctaMainText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  reportBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  reportCard: { width: 290, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', paddingBottom: 12 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 },
  reportReason: { marginHorizontal: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.inputBg, marginBottom: 4 },
  reportReasonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  reportCancel: { marginHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  reportCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
