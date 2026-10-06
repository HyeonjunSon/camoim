// Intro board — detail + apply sheet. Nothing here ever shows the author's real nickname/avatar.
import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  Modal, ActionSheetIOS, Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Text, TextInput } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import EmptyState from '../../components/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { INTRO_GENDERS, INTRO_REGIONS, INTRO_JOBS, INTRO_ACCENT, normalizeBirthYear, regionLabel, jobLabel } from '../../constants/intro';
import { getIntroPost, getIntroMeta, applyToIntroPost, closeIntroPost, reportIntroPost } from '../../lib/api';

export default function IntroDetailScreen({ route, navigation }) {
  const { introId } = route.params;
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyVisible, setApplyVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getIntroPost(introId);
      if (res?.success) setPost(res.data);
    } finally {
      setLoading(false);
    }
  }, [introId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const showMore = () => {
    const options = post?.isMine
      ? [t('intro.closeTitle'), t('common.cancel')]
      : [t('common.report'), t('common.cancel')];
    const handle = (idx) => {
      if (post?.isMine && idx === 0) onClose();
      else if (!post?.isMine && idx === 0) onReport();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: post?.isMine ? 0 : undefined },
        handle
      );
    } else {
      Alert.alert('', '', options.map((o, i) => ({ text: o, style: i === options.length - 1 ? 'cancel' : 'default', onPress: () => handle(i) })));
    }
  };

  const onClose = () => {
    Alert.alert(t('intro.closeTitle'), t('intro.closeMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.ok'), style: 'destructive', onPress: async () => { await closeIntroPost(introId); navigation.goBack(); } },
    ]);
  };

  const onReport = () => {
    const reasons = [
      { key: 'spam', label: t('post.r_spam') }, { key: 'hate', label: t('post.r_hate') },
      { key: 'illegal', label: t('post.r_illegal') }, { key: 'adult', label: t('post.r_adult') }, { key: 'etc', label: t('post.r_etc') },
    ];
    const handle = async (idx) => {
      if (idx < reasons.length) {
        const res = await reportIntroPost(introId, reasons[idx].key);
        if (res?.success) Alert.alert(t('post.reportDone'), res.message);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...reasons.map((r) => r.label), t('common.cancel')], cancelButtonIndex: reasons.length },
        handle
      );
    } else {
      Alert.alert(t('post.reportTitle'), t('post.reportPick'), [
        ...reasons.map((r, i) => ({ text: r.label, onPress: () => handle(i) })),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader navigation={navigation} title="" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={INTRO_ACCENT} />
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <CustomHeader navigation={navigation} title="" />
        <EmptyState icon="heart-dislike-outline" title={t('intro.notFound')} />
      </View>
    );
  }

  const ageText = `${post.birthYear}${t('intro.bornSuffix') || ''}`;
  const hasPref = post.preferredBirthYearMin || post.preferredBirthYearMax || post.preferredRegion;

  return (
    <View style={styles.container}>
      <CustomHeader
        navigation={navigation}
        title=""
        rightActions={[{ icon: 'ellipsis-horizontal', onPress: showMore, label: 'more' }]}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>
        {post.mode === 'proxy' && (
          <View style={styles.proxyBanner}>
            <Ionicons name="people" size={16} color={INTRO_ACCENT} />
            <Text style={styles.proxyBannerText}>{t('intro.proxyNote')}</Text>
          </View>
        )}

        <Text style={styles.headline}>{post.headline}</Text>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <TableCell label={t('intro.ageLabel')} value={ageText} styles={styles} />
            <TableCell label={t('intro.regionLabel')} value={regionLabel(post.region, t)} styles={styles} />
          </View>
          <View style={[styles.tableRow, styles.tableRowLast]}>
            <TableCell label={t('intro.jobLabel')} value={post.job ? jobLabel(post.job, t) : '-'} styles={styles} />
            <TableCell label={t('intro.heightLabel')} value={post.height || '-'} styles={styles} />
          </View>
        </View>

        {!!post.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('intro.introSection')}</Text>
            <Text style={styles.bioText}>{post.bio}</Text>
          </View>
        )}

        {!!hasPref && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('intro.preferSection')}</Text>
            <View style={styles.chipWrap}>
              {(post.preferredBirthYearMin || post.preferredBirthYearMax) && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {post.preferredBirthYearMin || '?'}~{post.preferredBirthYearMax || t('intro.preferAnyAge')}
                  </Text>
                </View>
              )}
              {!!post.preferredRegion && (
                <View style={styles.tag}><Text style={styles.tagText}>{regionLabel(post.preferredRegion, t)}</Text></View>
              )}
            </View>
          </View>
        )}

        {post.hasContact && (
          <ContactBox post={post} styles={styles} t={t} colors={colors} />
        )}

        <View style={styles.safetyNote}>
          <Ionicons name="warning-outline" size={14} color={colors.textSecondary} style={{ marginTop: 1 }} />
          <Text style={styles.safetyText}>{t('intro.safetyNote')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {post.isMine ? null : post.myRequestStatus === 'accepted' ? (
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.9}
            onPress={() => navigation.navigate('ChatRoom', {
              roomId: post.myRoomId,
              other: { id: null, nickname: t('intro.chatPartnerLabel'), avatarUrl: '', anonymous: true },
            })}>
            <Text style={styles.ctaText}>{t('intro.goToChat')}</Text>
          </TouchableOpacity>
        ) : post.myRequestStatus === 'pending' ? (
          <View style={[styles.ctaBtn, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.ctaText, { color: colors.textSecondary }]}>{t('intro.pendingNote')}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.9} onPress={() => setApplyVisible(true)}>
            <Text style={styles.ctaText}>{t('intro.applyBtn')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ApplySheet
        visible={applyVisible}
        onClose={() => setApplyVisible(false)}
        introId={introId}
        onSent={() => { setApplyVisible(false); load(); }}
        styles={styles} colors={colors} t={t}
      />
    </View>
  );
}

function TableCell({ label, value, styles }) {
  return (
    <View style={styles.tableCell}>
      <Text style={styles.tableCellLabel}>{label}</Text>
      <Text style={styles.tableCellValue}>{value}</Text>
    </View>
  );
}

function ContactBox({ post, styles, t, colors }) {
  const locked = !post.contactValue;
  const onOpen = () => {
    if (post.contactType === 'instagram') Linking.openURL(`https://instagram.com/${post.contactValue}`);
  };
  return (
    <View style={[styles.contactBox, locked && styles.contactBoxLocked]}>
      {!locked && <Text style={styles.contactUnlockedTitle}>{t('intro.acceptedContactTitle')}</Text>}
      <View style={styles.contactRow}>
        <Ionicons name={post.contactType === 'instagram' ? 'logo-instagram' : 'chatbubble'} size={18}
          color={locked ? colors.textSecondary : '#E1306C'} />
        {locked ? (
          <Text style={styles.contactLockedText}>
            {post.contactType === 'instagram' ? t('intro.contactHasInstagram') : t('intro.contactHasKakao')}
          </Text>
        ) : (
          <Text selectable style={styles.contactValueText}>{post.contactType === 'instagram' ? `@${post.contactValue}` : post.contactValue}</Text>
        )}
        {locked ? (
          <View style={styles.lockBadge}><Ionicons name="lock-closed" size={11} color={colors.textSecondary} /><Text style={styles.lockBadgeText}>{t('intro.contactLocked')}</Text></View>
        ) : post.contactType === 'instagram' ? (
          <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDark, { marginLeft: 'auto' }]} onPress={onOpen}>
            <Text style={[styles.smallBtnText, { color: '#FFFFFF' }]}>{t('intro.open')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ApplySheet({ visible, onClose, introId, onSent, styles, colors, t }) {
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [region, setRegion] = useState('');
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const res = await getIntroMeta();
      if (res?.success) {
        const d = res.data.defaults || {};
        if (d.gender) setGender(d.gender);
        if (d.birthYear) setBirthYear(String(d.birthYear));
        if (d.region) setRegion(d.region);
        setRemaining(res.data.dailyRemaining);
      }
    })();
  }, [visible]);

  const canSend = !!(gender && birthYear.trim() && region && message.trim()) && !submitting;

  const onSubmit = async () => {
    const by = normalizeBirthYear(birthYear);
    if (!by) return;
    setSubmitting(true);
    try {
      const res = await applyToIntroPost(introId, { gender, birthYear: by, region, message: message.trim() });
      if (res?.success) {
        Alert.alert('', t('intro.sent'));
        onSent();
      } else {
        Alert.alert(t('common.error'), res?.message || t('intro.applyFail'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('intro.applyFail'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('intro.applySheetTitle')}</Text>
            <Text style={styles.sheetDesc}>{t('intro.applySheetDesc')}</Text>

            <Text style={styles.label}>{t('intro.myInfo')}</Text>
            <View style={styles.chipWrap}>
              {INTRO_GENDERS.map((g) => {
                const active = gender === g.key;
                return (
                  <TouchableOpacity key={g.key} style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setGender(g.key)}>
                    <Text style={[styles.selectChipText, { color: active ? INTRO_ACCENT : colors.textSecondary }]}>{t(g.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
              <TextInput value={birthYear} onChangeText={setBirthYear} placeholder={t('intro.birthYearPh')}
                placeholderTextColor={colors.textSecondary} style={[styles.input, { width: 90 }]} keyboardType="number-pad" maxLength={4} />
            </View>
            <View style={[styles.chipWrap, { marginTop: 7 }]}>
              {INTRO_REGIONS.map((r) => {
                const active = region === r.key;
                return (
                  <TouchableOpacity key={r.key} style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setRegion(r.key)}>
                    <Text style={[styles.selectChipText, { color: active ? INTRO_ACCENT : colors.textSecondary }]}>{t(r.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.hintText}>{t('intro.autoFillHint')}</Text>

            <Text style={[styles.label, { marginTop: 14 }]}>{t('intro.messageLabel')}</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder={t('intro.messagePh')}
              placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textarea, { minHeight: 70 }]}
              maxLength={150} multiline />

            <TouchableOpacity style={[styles.ctaBtn, !canSend && { opacity: 0.5 }]} activeOpacity={0.9} onPress={onSubmit} disabled={!canSend}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>{t('intro.send')}</Text>}
            </TouchableOpacity>
            {remaining != null && (
              <Text style={styles.sheetFooterNote}>{t('intro.remainingToday').replace('{n}', remaining)}</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  proxyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: INTRO_ACCENT + '12', borderRadius: 10, padding: 12, marginBottom: 16 },
  proxyBannerText: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '600' },
  headline: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 28, marginBottom: 16 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: { flex: 1, padding: 12, gap: 3, borderRightWidth: 1, borderRightColor: colors.border },
  tableCellLabel: { fontSize: 11, color: colors.textSecondary },
  tableCellValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  bioText: { fontSize: 14, color: colors.text, lineHeight: 21 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  tag: { backgroundColor: colors.inputBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.text },
  contactBox: { marginTop: 20, borderWidth: 1, borderColor: INTRO_ACCENT, borderRadius: 12, padding: 14 },
  contactBoxLocked: { borderColor: colors.border, borderStyle: 'dashed' },
  contactUnlockedTitle: { fontSize: 13, fontWeight: '700', color: INTRO_ACCENT, marginBottom: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactLockedText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  contactValueText: { fontSize: 14, fontWeight: '700', color: colors.text },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  lockBadgeText: { fontSize: 11, color: colors.textSecondary },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  smallBtnDark: { backgroundColor: colors.text, borderColor: colors.text },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  safetyNote: { flexDirection: 'row', gap: 8, marginTop: 20, backgroundColor: colors.inputBg, borderRadius: 10, padding: 12 },
  safetyText: { flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ctaBtn: { backgroundColor: INTRO_ACCENT, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Apply sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, gap: 6 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 10 },
  sheetFooterNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 10 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 7 },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, color: colors.text },
  textarea: { minHeight: 90, textAlignVertical: 'top', marginTop: 4 },
  hintText: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  selectChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  selectChipActive: { borderColor: INTRO_ACCENT, backgroundColor: INTRO_ACCENT + '1A' },
  selectChipInactive: { borderColor: colors.border, backgroundColor: colors.surface },
  selectChipText: { fontSize: 13, fontWeight: '600' },
});
