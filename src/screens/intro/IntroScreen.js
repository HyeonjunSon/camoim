// Intro board hub — consent gate, then 둘러보기(browse) / 받은 신청(received) / 내 소개(mine).
// Fully anonymous: nothing here is ever shown with a real nickname/avatar.
import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { Image } from 'expo-image';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Text, TextInput } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import EmptyState from '../../components/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { INTRO_GENDERS, INTRO_ACCENT, regionLabel, jobLabel, ageLabel, preferredAgeRangeLabel } from '../../constants/intro';
import {
  getIntroMeta, agreeIntroTerms, getIntroPosts, getMyIntroPosts,
  getReceivedIntroRequests, acceptIntroRequest, declineIntroRequest,
} from '../../lib/api';

export default function IntroScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [agreed, setAgreed] = useState(null); // null = loading
  const [tab, setTab] = useState(route?.params?.initialTab || 'browse');

  const [browseList, setBrowseList] = useState(null);
  const [receivedList, setReceivedList] = useState(null);
  const [mineList, setMineList] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState({ gender: '', region: '', proxyOnly: false });

  const loadMeta = useCallback(async () => {
    try {
      const res = await getIntroMeta();
      setAgreed(!!res?.data?.agreed);
    } catch (e) {
      // A failed /meta still has to resolve the loading state, or the consent screen spins forever
      setAgreed(false);
    }
  }, []);

  // Every branch must resolve its list state even on failure — an uncaught throw here (e.g. a 403
  // when the account isn't verified yet) would otherwise leave that tab spinning forever.
  const loadTab = useCallback(async (which, currentFilters) => {
    setLoadError('');
    try {
      if (which === 'browse') {
        const res = await getIntroPosts(currentFilters);
        setBrowseList(res?.success ? res.data : []);
      } else if (which === 'received') {
        const res = await getReceivedIntroRequests();
        setReceivedList(res?.success ? res.data : []);
      } else if (which === 'mine') {
        const res = await getMyIntroPosts();
        setMineList(res?.success ? res.data : []);
      }
    } catch (e) {
      setLoadError(e.message || t('intro.loadFail'));
      if (which === 'browse') setBrowseList([]);
      else if (which === 'received') setReceivedList([]);
      else if (which === 'mine') setMineList([]);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    loadMeta().then(() => loadTab(tab, filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]));

  const onRefresh = () => { setRefreshing(true); loadTab(tab, filters).finally(() => setRefreshing(false)); };

  const onAgree = async () => {
    try {
      const res = await agreeIntroTerms();
      if (res?.success) setAgreed(true);
      else Alert.alert(t('common.error'), res?.message || t('intro.needAgree'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('intro.needAgree'));
    }
  };

  const onAccept = async (reqId) => {
    try {
      const res = await acceptIntroRequest(reqId);
      if (res?.success) {
        setReceivedList((prev) => prev.filter((r) => r.id !== reqId));
        navigation.navigate('ChatRoom', {
          roomId: res.data.roomId,
          other: { id: null, nickname: t('intro.chatPartnerLabel'), avatarUrl: '', anonymous: true },
        });
      } else {
        Alert.alert(t('common.error'), res?.message || t('intro.acceptFail'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('intro.acceptFail'));
    }
  };

  const onDecline = async (reqId) => {
    try {
      const res = await declineIntroRequest(reqId);
      if (res?.success) setReceivedList((prev) => prev.filter((r) => r.id !== reqId));
      else Alert.alert(t('common.error'), res?.message || t('intro.declineFail'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('intro.declineFail'));
    }
  };

  const applyFilters = (next) => {
    setFilters(next);
    setFilterVisible(false);
    setBrowseList(null);
    loadTab('browse', next);
  };

  if (agreed === null) {
    return (
      <View style={styles.container}>
        <CustomHeader navigation={navigation} title={t('intro.title')} />
        <View style={styles.center}><ActivityIndicator color={INTRO_ACCENT} /></View>
      </View>
    );
  }

  if (!agreed) {
    return <ConsentScreen navigation={navigation} onAgree={onAgree} styles={styles} colors={colors} t={t} />;
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        navigation={navigation}
        title={t('intro.title')}
        rightActions={tab === 'browse' ? [{ icon: 'options-outline', onPress: () => setFilterVisible(true), label: 'filter' }] : undefined}
      />

      <View style={styles.tabRow}>
        {[
          { key: 'browse', label: t('intro.tabBrowse') },
          { key: 'received', label: t('intro.tabReceived') },
          { key: 'mine', label: t('intro.tabMine') },
        ].map((tb) => (
          <TouchableOpacity key={tb.key} style={styles.tabBtn} activeOpacity={0.7} onPress={() => setTab(tb.key)}>
            <Text style={[styles.tabLabel, tab === tb.key && { color: colors.text, fontWeight: '800' }]}>{tb.label}</Text>
            {tab === tb.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'browse' && (
        browseList === null ? <View style={styles.center}><ActivityIndicator color={INTRO_ACCENT} /></View> : (
          <FlatList
            data={browseList}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INTRO_ACCENT} />}
            ListEmptyComponent={
              <EmptyState icon="heart-outline" title={loadError || t('intro.browseEmpty')}
                ctaLabel={loadError ? t('common.retry') : undefined} onCtaPress={loadError ? onRefresh : undefined} />
            }
            renderItem={({ item }) => (
              <BrowseCard item={item} styles={styles} colors={colors} t={t}
                onPress={() => navigation.navigate('IntroDetail', { introId: item.id })} />
            )}
          />
        )
      )}

      {tab === 'received' && (
        receivedList === null ? <View style={styles.center}><ActivityIndicator color={INTRO_ACCENT} /></View> : (
          <FlatList
            data={receivedList}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 14 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INTRO_ACCENT} />}
            ListEmptyComponent={
              <EmptyState icon="mail-open-outline" title={loadError || t('intro.receivedEmpty')}
                ctaLabel={loadError ? t('common.retry') : undefined} onCtaPress={loadError ? onRefresh : undefined} />
            }
            renderItem={({ item }) => (
              <ReceivedCard item={item} styles={styles} colors={colors} t={t} onAccept={() => onAccept(item.id)} onDecline={() => onDecline(item.id)} />
            )}
            ListFooterComponent={receivedList.length > 0 ? <Text style={styles.receivedFooter}>{t('intro.receivedFooterHint')}</Text> : null}
          />
        )
      )}

      {tab === 'mine' && (
        mineList === null ? <View style={styles.center}><ActivityIndicator color={INTRO_ACCENT} /></View> : (
          <FlatList
            data={mineList}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INTRO_ACCENT} />}
            ListEmptyComponent={
              <EmptyState icon="person-add-outline" title={loadError || t('intro.mineEmpty')}
                ctaLabel={loadError ? t('common.retry') : undefined} onCtaPress={loadError ? onRefresh : undefined} />
            }
            renderItem={({ item }) => (
              <MineCard item={item} styles={styles} colors={colors} t={t}
                onPress={() => navigation.navigate('IntroDetail', { introId: item.id })} />
            )}
          />
        )
      )}

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 16 }]} activeOpacity={0.9}
        onPress={() => navigation.navigate('IntroCreate')}>
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={styles.fabText}>{t('intro.fab')}</Text>
      </TouchableOpacity>

      <FilterSheet visible={filterVisible} initial={filters} onClose={() => setFilterVisible(false)} onApply={applyFilters} styles={styles} colors={colors} t={t} />
    </View>
  );
}

function BrowseCard({ item, styles, colors, t, onPress }) {
  const prefAgeText = preferredAgeRangeLabel(item.preferredBirthYearMin, item.preferredBirthYearMax, t);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardOuterRow}>
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardMeta}>
              {t(item.gender === 'female' ? 'intro.genderFemale' : 'intro.genderMale')}, {ageLabel(item.birthYear, t)}, {regionLabel(item.region, t)}
            </Text>
            {item.mode === 'proxy' && (
              <View style={styles.proxyBadge}><Text style={styles.proxyBadgeText}>{t('intro.proxyBadge')}</Text></View>
            )}
          </View>
          <Text style={styles.cardHeadline} numberOfLines={2}>{item.headline}</Text>
          <View style={styles.chipWrap}>
            {!!item.job && <View style={styles.tag}><Text style={styles.tagText}>{jobLabel(item.job, t)}</Text></View>}
            {!!item.height && <View style={styles.tag}><Text style={styles.tagText}>{item.height}</Text></View>}
            {!!prefAgeText && <View style={styles.tag}><Text style={styles.tagText}>{prefAgeText}</Text></View>}
          </View>
          <Text style={styles.cardFooter}>{item.expired ? t('intro.expired') : t('intro.daysLeft').replace('{n}', item.daysLeft)}</Text>
        </View>
        {!!item.photo && (
          <Image source={{ uri: item.photo }} style={styles.cardThumb} contentFit="cover" cachePolicy="memory-disk" />
        )}
      </View>
    </TouchableOpacity>
  );
}

function ReceivedCard({ item, styles, colors, t, onAccept, onDecline }) {
  return (
    <View style={styles.card}>
      <Text style={styles.receivedFrom} numberOfLines={1}>{t('intro.receivedFrom').replace('{headline}', item.introHeadline)}</Text>
      <Text style={styles.cardMeta}>
        {t(item.gender === 'female' ? 'intro.genderFemale' : 'intro.genderMale')}, {ageLabel(item.birthYear, t)}, {regionLabel(item.region, t)}
      </Text>
      <View style={styles.chipWrap}>
        {!!item.job && <View style={styles.tag}><Text style={styles.tagText}>{jobLabel(item.job, t)}</Text></View>}
        {!!item.verificationBadge && (
          <View style={styles.tag}><Text style={styles.tagText}>{t(item.verificationBadge === 'school' ? 'intro.verifiedSchool' : 'intro.verifiedEmail')}</Text></View>
        )}
        <View style={styles.tag}><Text style={styles.tagText}>{t('intro.joinedMonths').replace('{n}', item.memberMonths)}</Text></View>
      </View>
      <Text style={styles.receivedMessage}>{item.message}</Text>
      <View style={styles.receivedBtnRow}>
        <TouchableOpacity style={styles.skipBtn} activeOpacity={0.8} onPress={onDecline}>
          <Text style={styles.skipBtnText}>{t('intro.skip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.9} onPress={onAccept}>
          <Text style={styles.acceptBtnText}>{t('intro.acceptChat')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MineCard({ item, styles, colors, t, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardHeadline} numberOfLines={1}>{item.headline}</Text>
        {item.pendingCount > 0 && (
          <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{t('intro.pendingCount').replace('{n}', item.pendingCount)}</Text></View>
        )}
      </View>
      <Text style={styles.cardFooter}>{item.expired || item.status !== 'active' ? t('intro.expired') : t('intro.daysLeft').replace('{n}', item.daysLeft)}</Text>
    </TouchableOpacity>
  );
}

function ConsentScreen({ onAgree, styles, colors, t }) {
  const [checked, setChecked] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.consentContainer, { paddingTop: insets.top + 20 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.consentTitle}>{t('intro.consentTitle1')}{'\n'}{t('intro.consentTitle2')}{'\n'}{t('intro.consentTitle3')}</Text>
        <Text style={styles.consentDesc}>{t('intro.consentDesc')}</Text>
        {[
          { icon: 'shield-checkmark-outline', title: t('intro.rule1Title'), desc: t('intro.rule1Desc') },
          { icon: 'lock-closed-outline', title: t('intro.rule2Title'), desc: t('intro.rule2Desc') },
          { icon: 'chatbubble-outline', title: t('intro.rule3Title'), desc: t('intro.rule3Desc') },
        ].map((r, i) => (
          <View key={i} style={styles.ruleRow}>
            <View style={styles.ruleIconWrap}><Ionicons name={r.icon} size={18} color={INTRO_ACCENT} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleTitle}>{r.title}</Text>
              <Text style={styles.ruleDesc}>{r.desc}</Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.checkRow} activeOpacity={0.8} onPress={() => setChecked(!checked)}>
        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? INTRO_ACCENT : colors.textSecondary} />
        <Text style={styles.checkText}>{t('intro.agreeCheck')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.startBtn, !checked && { opacity: 0.5 }, { marginBottom: insets.bottom }]}
        activeOpacity={0.9} disabled={!checked} onPress={onAgree}>
        <Text style={styles.startBtnText}>{t('intro.start')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function FilterSheet({ visible, initial, onClose, onApply, styles, colors, t }) {
  const [gender, setGender] = useState(initial.gender);
  const [region, setRegion] = useState(initial.region);
  const [proxyOnly, setProxyOnly] = useState(initial.proxyOnly);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.chipWrap}>
            {INTRO_GENDERS.map((g) => {
              const active = gender === g.key;
              return (
                <TouchableOpacity key={g.key} style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                  activeOpacity={0.8} onPress={() => setGender(active ? '' : g.key)}>
                  <Text style={[styles.selectChipText, { color: active ? INTRO_ACCENT : colors.textSecondary }]}>{t(g.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput value={region} onChangeText={setRegion} placeholder={t('intro.regionPh')}
            placeholderTextColor={colors.textSecondary} style={[styles.input, { marginTop: 8 }]} maxLength={40} />
          <Text style={styles.filterRegionHint}>{t('intro.filterRegionHint')}</Text>
          <TouchableOpacity style={[styles.checkRow, { marginTop: 14 }]} activeOpacity={0.8} onPress={() => setProxyOnly(!proxyOnly)}>
            <Ionicons name={proxyOnly ? 'checkbox' : 'square-outline'} size={20} color={proxyOnly ? INTRO_ACCENT : colors.textSecondary} />
            <Text style={styles.checkText}>{t('intro.proxyOnly')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.startBtn, { marginTop: 18 }]} activeOpacity={0.9}
            onPress={() => onApply({ gender, region, proxyOnly })}>
            <Text style={styles.startBtnText}>{t('common.confirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: 16 },
  tabBtn: { paddingVertical: 12, marginRight: 20, alignItems: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabUnderline: { height: 2, width: '100%', backgroundColor: colors.text, marginTop: 8, borderRadius: 1 },

  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardOuterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardContent: { flex: 1, gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  cardHeadline: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  cardThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.inputBg },
  cardFooter: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  proxyBadge: { backgroundColor: INTRO_ACCENT + '1A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  proxyBadgeText: { fontSize: 10, fontWeight: '700', color: INTRO_ACCENT },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { backgroundColor: colors.inputBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 11, fontWeight: '600', color: colors.text },
  pendingBadge: { backgroundColor: INTRO_ACCENT, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  receivedFrom: { fontSize: 11, color: colors.textSecondary },
  receivedMessage: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 2 },
  receivedBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  skipBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  skipBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
  acceptBtn: { flex: 2, alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: INTRO_ACCENT },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  receivedFooter: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 4, paddingHorizontal: 4 },

  fab: {
    position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: INTRO_ACCENT, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  fabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Consent screen
  consentContainer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: 40 },
  consentTitle: { fontSize: 30, fontWeight: '800', color: colors.text, lineHeight: 40 },
  consentDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginTop: 16, marginBottom: 28 },
  ruleRow: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  ruleIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: INTRO_ACCENT + '1A', alignItems: 'center', justifyContent: 'center' },
  ruleTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  ruleDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  checkText: { fontSize: 13, fontWeight: '600', color: colors.text },
  startBtn: { backgroundColor: INTRO_ACCENT, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  startBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Filter sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  selectChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  selectChipActive: { borderColor: INTRO_ACCENT, backgroundColor: INTRO_ACCENT + '1A' },
  selectChipInactive: { borderColor: colors.border, backgroundColor: colors.surface },
  selectChipText: { fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, color: colors.text },
  filterRegionHint: { fontSize: 11, color: colors.textSecondary, marginTop: 6, paddingHorizontal: 2 },
});
