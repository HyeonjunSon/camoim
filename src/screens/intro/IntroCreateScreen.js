// Intro board — create form. Posting about yourself or (with consent) a friend.
// Nothing here is ever shown with the author's real nickname/avatar — see routes/intro.js.
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import WheelPicker from '../../components/WheelPicker';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { INTRO_GENDERS, INTRO_JOBS, INTRO_REGIONS, INTRO_ACCENT, BIRTH_YEARS, HEIGHT_CM } from '../../constants/intro';
import { createIntroPost, uploadIntroImage } from '../../lib/api';

const PREF_YEAR_VALUES = ['', ...BIRTH_YEARS]; // '' = no preference ("상관없음"), wheeled in at the top

export default function IntroCreateScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [mode, setMode] = useState('self');
  const [proxyConsent, setProxyConsent] = useState(false);
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState(null);
  const [region, setRegion] = useState('');
  const [job, setJob] = useState('');
  const [height, setHeight] = useState(null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [prefMin, setPrefMin] = useState('');
  const [prefMax, setPrefMax] = useState('');
  const [prefRegion, setPrefRegion] = useState('');
  const [contactType, setContactType] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(null); // 'birthYear' | 'height' | 'prefMin' | 'prefMax' | null

  const canSubmit = !!(gender && birthYear && region && headline.trim())
    && (mode === 'self' || proxyConsent) && !submitting;

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('biz.permNeedTitle'), t('biz.permNeedMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('biz.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [3, 4] });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri, [{ resize: { width: 1000 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadIntroImage({ uri: manipulated.uri, filename: `intro_${Date.now()}.jpg`, type: 'image/jpeg' });
      if (res?.success && res.url) setPhoto(res.url);
      else Alert.alert(t('biz.errorTitle'), t('biz.uploadFail'));
    } catch {
      Alert.alert(t('biz.errorTitle'), t('biz.uploadFail'));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!gender) return Alert.alert(t('common.error'), t('intro.needGender'));
    if (!birthYear) return Alert.alert(t('common.error'), t('intro.needBirthYear'));
    if (!region) return Alert.alert(t('common.error'), t('intro.needRegion'));
    if (!headline.trim()) return Alert.alert(t('common.error'), t('intro.needHeadline'));
    if (mode === 'proxy' && !proxyConsent) return Alert.alert(t('common.error'), t('intro.needProxyConsent'));

    setSubmitting(true);
    try {
      const res = await createIntroPost({
        mode, proxyConsent: mode === 'proxy',
        gender, birthYear, region, job, height: height ? `${height}cm` : '',
        headline: headline.trim(), bio: bio.trim(),
        preferredBirthYearMin: prefMin || null,
        preferredBirthYearMax: prefMax || null,
        preferredRegion: prefRegion,
        contactType, contactValue: contactValue.trim(),
        photo,
      });
      if (res?.success) {
        navigation.goBack();
      } else {
        Alert.alert(t('common.error'), res?.message || t('intro.createFail'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('intro.createFail'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CustomHeader navigation={navigation} title={t('intro.createTitle')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label={t('intro.photoLabelOptional')}>
            <TouchableOpacity style={styles.photoBox} activeOpacity={0.85} onPress={pickPhoto} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : photo ? (
                <>
                  <Image source={{ uri: photo }} style={styles.photoImg} contentFit="cover" />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto('')} activeOpacity={0.8}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
                  <Text style={styles.photoEmptyText}>{t('intro.noPhoto')}</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hintText}>{t('intro.photoHint')}</Text>
          </Field>

          <Field label={t('intro.modeLabel')}>
            <View style={styles.modeRow}>
              {[{ key: 'self', label: t('intro.modeSelf') }, { key: 'proxy', label: t('intro.modeProxy') }].map((m) => {
                const active = mode === m.key;
                return (
                  <TouchableOpacity key={m.key} style={[styles.modeBtn, active && styles.modeBtnActive]}
                    activeOpacity={0.85} onPress={() => setMode(m.key)}>
                    <Text style={[styles.modeBtnText, { color: active ? '#FFFFFF' : colors.text }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {mode === 'proxy' && (
            <TouchableOpacity style={styles.consentBox} activeOpacity={0.8} onPress={() => setProxyConsent(!proxyConsent)}>
              <Ionicons name={proxyConsent ? 'checkbox' : 'square-outline'} size={20} color={proxyConsent ? INTRO_ACCENT : colors.textSecondary} />
              <Text style={styles.consentText}>{t('intro.proxyConsentCheck')}</Text>
            </TouchableOpacity>
          )}

          <Field label={mode === 'proxy' ? t('intro.genderLabelProxy') : t('intro.genderLabelSelf')} required>
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
            </View>
          </Field>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label={t('intro.birthYearLabel')} required>
                <TouchableOpacity style={styles.input} activeOpacity={0.7} onPress={() => setPickerOpen('birthYear')}>
                  <Text style={{ fontSize: 15, color: birthYear ? colors.text : colors.textSecondary }}>
                    {birthYear ? String(birthYear) : t('intro.birthYearPh')}
                  </Text>
                </TouchableOpacity>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('intro.heightLabelOptional')}>
                <TouchableOpacity style={styles.input} activeOpacity={0.7} onPress={() => setPickerOpen('height')}>
                  <Text style={{ fontSize: 15, color: height ? colors.text : colors.textSecondary }}>
                    {height ? `${height}cm` : t('intro.heightPh')}
                  </Text>
                </TouchableOpacity>
              </Field>
            </View>
          </View>

          <Field label={t('intro.regionLabel')} required>
            <View style={styles.chipWrap}>
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
          </Field>

          <Field label={t('intro.jobLabel')}>
            <View style={styles.chipWrap}>
              {INTRO_JOBS.map((j) => {
                const active = job === j.key;
                return (
                  <TouchableOpacity key={j.key} style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setJob(active ? '' : j.key)}>
                    <Text style={[styles.selectChipText, { color: active ? INTRO_ACCENT : colors.textSecondary }]}>{t(j.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label={t('intro.headlineLabel')} required>
            <TextInput value={headline} onChangeText={setHeadline}
              placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={60} />
            <Text style={styles.hintText}>{t('intro.headlineHint')}</Text>
          </Field>

          <Field label={t('intro.bioLabel')}>
            <TextInput value={bio} onChangeText={setBio} placeholder={t('intro.bioHint')}
              placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textarea]} maxLength={1000} multiline />
            <Text style={styles.hintText}>{bio.length}/1000</Text>
          </Field>

          <Field label={t('intro.preferBirthYearLabel')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={[styles.input, { flex: 1 }]} activeOpacity={0.7} onPress={() => setPickerOpen('prefMin')}>
                <Text style={{ fontSize: 15, color: prefMin ? colors.text : colors.textSecondary }}>
                  {prefMin || t('intro.preferAnyAge')}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textSecondary }}>~</Text>
              <TouchableOpacity style={[styles.input, { flex: 1 }]} activeOpacity={0.7} onPress={() => setPickerOpen('prefMax')}>
                <Text style={{ fontSize: 15, color: prefMax ? colors.text : colors.textSecondary }}>
                  {prefMax || t('intro.preferAnyAge')}
                </Text>
              </TouchableOpacity>
            </View>
          </Field>

          <Field label={t('intro.preferRegionLabel')}>
            <View style={styles.chipWrap}>
              {INTRO_REGIONS.map((r) => {
                const active = prefRegion === r.key;
                return (
                  <TouchableOpacity key={r.key} style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setPrefRegion(active ? '' : r.key)}>
                    <Text style={[styles.selectChipText, { color: active ? INTRO_ACCENT : colors.textSecondary }]}>{t(r.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label={t('intro.contactLabelOptional')}>
            <View style={styles.chipWrap}>
              {[{ key: 'instagram', label: 'Instagram' }, { key: 'kakao', label: 'KakaoTalk' }].map((c) => {
                const active = contactType === c.key;
                return (
                  <TouchableOpacity key={c.key} style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setContactType(active ? '' : c.key)}>
                    <Text style={[styles.selectChipText, { color: active ? INTRO_ACCENT : colors.textSecondary }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!contactType && (
              <TextInput value={contactValue} onChangeText={setContactValue}
                placeholder={contactType === 'instagram' ? '@handle' : 'KakaoTalk ID'}
                placeholderTextColor={colors.textSecondary} style={[styles.input, { marginTop: 8 }]} maxLength={100} autoCapitalize="none" />
            )}
            <Text style={styles.hintText}>{t('intro.contactLockHint')} · {t('intro.contactListHint')}</Text>
          </Field>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={15} color={INTRO_ACCENT} style={{ marginTop: 1 }} />
            <Text style={styles.noticeText}>{t('intro.verifyNote')}</Text>
          </View>

          <TouchableOpacity style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]} activeOpacity={0.9}
            onPress={onSubmit} disabled={!canSubmit}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{t('intro.submit')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <WheelPicker
        visible={pickerOpen === 'birthYear'}
        title={t('intro.birthYearLabel')}
        values={BIRTH_YEARS}
        initialValue={birthYear || BIRTH_YEARS[Math.floor(BIRTH_YEARS.length / 2)]}
        onSelect={setBirthYear}
        onClose={() => setPickerOpen(null)}
        accentColor={INTRO_ACCENT}
      />
      <WheelPicker
        visible={pickerOpen === 'height'}
        title={t('intro.heightLabelOptional')}
        values={HEIGHT_CM}
        initialValue={height || 165}
        formatLabel={(v) => `${v}cm`}
        onSelect={setHeight}
        onClose={() => setPickerOpen(null)}
        accentColor={INTRO_ACCENT}
      />
      <WheelPicker
        visible={pickerOpen === 'prefMin'}
        title={t('intro.preferBirthYearLabel')}
        values={PREF_YEAR_VALUES}
        initialValue={prefMin || ''}
        formatLabel={(v) => v === '' ? t('intro.preferAnyAge') : String(v)}
        onSelect={setPrefMin}
        onClose={() => setPickerOpen(null)}
        accentColor={INTRO_ACCENT}
      />
      <WheelPicker
        visible={pickerOpen === 'prefMax'}
        title={t('intro.preferBirthYearLabel')}
        values={PREF_YEAR_VALUES}
        initialValue={prefMax || ''}
        formatLabel={(v) => v === '' ? t('intro.preferAnyAge') : String(v)}
        onSelect={setPrefMax}
        onClose={() => setPickerOpen(null)}
        accentColor={INTRO_ACCENT}
      />
    </View>
  );
}

function Field({ label, required, children }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={{ color: '#FF4444' }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  hintText: { fontSize: 11, color: colors.textSecondary, marginTop: 4, paddingHorizontal: 2 },
  photoBox: {
    width: 120, height: 150, borderRadius: 14, backgroundColor: colors.inputBg,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoEmptyText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  photoRemove: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  selectChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  selectChipActive: { borderColor: INTRO_ACCENT, backgroundColor: INTRO_ACCENT + '1A' },
  selectChipInactive: { borderColor: colors.border, backgroundColor: colors.surface },
  selectChipText: { fontSize: 13, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: colors.inputBg },
  modeBtnActive: { backgroundColor: INTRO_ACCENT },
  modeBtnText: { fontSize: 14, fontWeight: '700' },
  consentBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: INTRO_ACCENT + '12', borderRadius: 12, padding: 14 },
  consentText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  notice: { flexDirection: 'row', gap: 9, backgroundColor: INTRO_ACCENT + '12', borderRadius: 12, padding: 14 },
  noticeText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },
  submitBtn: { backgroundColor: INTRO_ACCENT, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
