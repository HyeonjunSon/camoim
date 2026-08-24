// 숙소 등록/수정 폼 — 유저가 본인 방·민박을 등록 → 지도에 즉시 노출 (승인 없음)
// 프라이버시: 정확 주소는 서버 전용, 지도엔 대략 위치만. route.params.stay 있으면 수정 모드.
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { STAY_TYPES, STAY_CITIES, STAY_CONDITIONS, STAY_ACCENT, htmlToPlain } from '../../constants/stays';
import { createStay, updateStay, uploadStayImage } from '../../lib/api';

const MAX_PHOTOS = 8;

export default function StayCreateScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const editing = route?.params?.stay || null; // 수정 모드면 기존 숙소 객체
  // 게시판(roomrent) 글에서 "지도에 등록"으로 넘어온 경우 초기값 채우기
  const prefill = route?.params?.prefill || null;
  const validCity = (k) => (STAY_CITIES.some((c) => c.key === k) ? k : null);

  const [title, setTitle] = useState(editing?.title || prefill?.title || '');
  const [stayType, setStayType] = useState(editing?.stayType || '');
  const [city, setCity] = useState(editing?.city || validCity(prefill?.city) || route?.params?.city || 'toronto');
  const [price, setPrice] = useState(editing?.price ? String(editing.price) : '');
  const [deposit, setDeposit] = useState(editing?.deposit ? String(editing.deposit) : '');
  const [address, setAddress] = useState(editing?.address || ''); // 수정 시 서버는 주소를 안 내려줌 → 빈값 = 유지
  const [neighborhood, setNeighborhood] = useState(editing?.neighborhood || '');
  const [conditions, setConditions] = useState(editing?.conditions || []);
  const [moveInDate, setMoveInDate] = useState(editing?.moveInDate || '');
  const [minLease, setMinLease] = useState(editing?.minLeaseMonths ? String(editing.minLeaseMonths) : '');
  const [includes, setIncludes] = useState(editing?.includes || '');
  const [description, setDescription] = useState(editing?.description || (prefill?.content ? htmlToPlain(prefill.content).slice(0, 2000) : ''));
  const [images, setImages] = useState(editing?.images || prefill?.images || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 등록은 주소 필수 / 수정은 주소 비워도 됨(기존 유지)
  const canSubmit =
    !!(title.trim() && stayType && price.trim() && (editing || address.trim())) && !submitting;

  const toggleCondition = (key) =>
    setConditions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const pickImage = async () => {
    if (images.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('biz.permNeedTitle'), t('biz.permNeedMsg'), [
        { text: t('biz.cancel'), style: 'cancel' },
        { text: t('biz.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri, [{ resize: { width: 1400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadStayImage({ uri: manipulated.uri, filename: `stay_${Date.now()}.jpg`, type: 'image/jpeg' });
      if (res?.success && res.url) setImages((prev) => [...prev, res.url]);
      else Alert.alert(t('biz.errorTitle'), t('biz.uploadFail'));
    } catch {
      Alert.alert(t('biz.errorTitle'), t('biz.uploadFail'));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url) => setImages((prev) => prev.filter((u) => u !== url));

  const onSubmit = async () => {
    if (!canSubmit) return;
    if (!stayType) { Alert.alert(t('biz.errorTitle'), t('stay.pickType')); return; }
    if (!Number(price)) { Alert.alert(t('biz.errorTitle'), t('stay.enterPrice')); return; }
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      stayType,
      city,
      price: Number(price),
      deposit: Number(deposit) || 0,
      conditions,
      neighborhood: neighborhood.trim(),
      moveInDate: moveInDate.trim(),
      minLeaseMonths: Number(minLease) || 0,
      includes: includes.trim(),
      description: description.trim(),
      images,
    };
    if (address.trim()) payload.address = address.trim();
    if (!editing && prefill?.sourcePostId) payload.sourcePostId = prefill.sourcePostId; // 게시글 연동
    try {
      const res = editing ? await updateStay(editing.id, payload) : await createStay(payload);
      if (res?.success) {
        const okBtn = { text: t('biz.confirmOk'), onPress: () => navigation.goBack() };
        if (editing) {
          Alert.alert(t('stay.addedTitle'), t('stay.updatedMsg'), [okBtn]);
        } else {
          // 게시판에서 온 등록이면 지도(숙소 모드)로 바로 가볼 수 있게 버튼 추가
          const fromPost = !!prefill;
          const mapBtn = {
            text: t('stay.viewOnMap'),
            onPress: () => {
              navigation.goBack();
              navigation.navigate('Map', { screen: 'BusinessMap', params: { category: 'stay' } });
            },
          };
          Alert.alert(
            t('stay.addedTitle'),
            res.located === false ? t('stay.addedNoGeo') : t('stay.addedMsg'),
            fromPost ? [okBtn, mapBtn] : [okBtn]
          );
        }
      } else {
        Alert.alert(t('biz.errorTitle'), t('stay.saveFail'));
      }
    } catch {
      Alert.alert(t('biz.errorTitle'), t('stay.saveFail'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CustomHeader navigation={navigation} title={editing ? t('biz.edit') : t('stay.registerTitle')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.notice}>
            <Ionicons name="lock-closed" size={15} color={STAY_ACCENT} style={{ marginTop: 1 }} />
            <Text style={styles.noticeText}>{t('stay.formNotice')}</Text>
          </View>

          <Field label={t('stay.fTitle')} required>
            <TextInput value={title} onChangeText={setTitle} placeholder={t('stay.fTitlePh')}
              placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={100} />
          </Field>

          <Field label={t('stay.fType')} required>
            <View style={styles.chipWrap}>
              {STAY_TYPES.map((c) => {
                const active = stayType === c.key;
                return (
                  <TouchableOpacity key={c.key}
                    style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setStayType(c.key)}>
                    <Ionicons name={c.ion} size={13} color={active ? STAY_ACCENT : c.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.selectChipText, { color: active ? STAY_ACCENT : colors.textSecondary }]}>{t(c.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label={t('biz.fCity')} required>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {STAY_CITIES.map((c) => {
                const active = city === c.key;
                return (
                  <TouchableOpacity key={c.key}
                    style={[styles.cityChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => setCity(c.key)}>
                    <Text style={[styles.selectChipText, { color: active ? STAY_ACCENT : colors.textSecondary }]}>{t(c.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label={t('stay.fPrice')} required>
                <TextInput value={price} onChangeText={setPrice} placeholder={t('stay.fPricePh')}
                  placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="number-pad" maxLength={7} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('stay.fDeposit')} optional>
                <TextInput value={deposit} onChangeText={setDeposit} placeholder={t('stay.fDepositPh')}
                  placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="number-pad" maxLength={7} />
              </Field>
            </View>
          </View>

          <Field label={t('stay.fAddress')} required={!editing}>
            <TextInput value={address} onChangeText={setAddress}
              placeholder={editing ? t('stay.fAddressHint') : t('stay.fAddressPh')}
              placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={200} />
            <View style={styles.hintRow}>
              <Ionicons name="eye-off-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.hintText}>{t('stay.fAddressHint')}</Text>
            </View>
          </Field>

          <Field label={t('stay.fNeighborhood')} optional>
            <TextInput value={neighborhood} onChangeText={setNeighborhood} placeholder={t('stay.fNeighborhoodPh')}
              placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={80} />
          </Field>

          <Field label={t('stay.fConditions')} optional>
            <View style={styles.chipWrap}>
              {STAY_CONDITIONS.map((c) => {
                const active = conditions.includes(c.key);
                return (
                  <TouchableOpacity key={c.key}
                    style={[styles.condChip, active ? styles.condChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8} onPress={() => toggleCondition(c.key)}>
                    <Text style={[styles.selectChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{t(c.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1.4 }}>
              <Field label={t('stay.fMoveIn')} optional>
                <TextInput value={moveInDate} onChangeText={setMoveInDate} placeholder={t('stay.fMoveInPh')}
                  placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={40} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('stay.fMinLease')} optional>
                <TextInput value={minLease} onChangeText={setMinLease} placeholder={t('stay.fMinLeasePh')}
                  placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="number-pad" maxLength={2} />
              </Field>
            </View>
          </View>

          <Field label={t('stay.fIncludes')} optional>
            <TextInput value={includes} onChangeText={setIncludes} placeholder={t('stay.fIncludesPh')}
              placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={200} />
          </Field>

          <Field label={t('stay.fDesc')} optional>
            <TextInput value={description} onChangeText={setDescription} placeholder={t('stay.fDescPh')}
              placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textarea]} maxLength={2000} multiline />
          </Field>

          <Field label={t('biz.fPhotos')} optional>
            <View style={styles.photoRow}>
              {images.map((url) => (
                <View key={url} style={styles.photoThumb}>
                  <Image source={{ uri: url }} style={styles.photoImg} contentFit="cover" />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removeImage(url)} activeOpacity={0.8}>
                    <Ionicons name="close" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.photoAdd} activeOpacity={0.8} onPress={pickImage} disabled={uploading}>
                  {uploading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : (
                    <>
                      <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
                      <Text style={styles.photoCount}>{images.length}/{MAX_PHOTOS}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Field>

          <TouchableOpacity style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]} activeOpacity={0.9}
            onPress={onSubmit} disabled={!canSubmit}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={styles.submitText}>{editing ? t('stay.saveEdit') : t('stay.submitRegister')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, required, optional, children }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={{ color: '#FF4444' }}> *</Text>}
        {optional && <Text style={{ color: colors.textSecondary, fontWeight: '500' }}> {t('biz.optional')}</Text>}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notice: { flexDirection: 'row', gap: 9, backgroundColor: STAY_ACCENT + '12', borderRadius: 12, padding: 14 },
  noticeText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, paddingHorizontal: 2 },
  hintText: { fontSize: 11, color: colors.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  selectChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  cityChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  selectChipActive: { borderColor: STAY_ACCENT, backgroundColor: STAY_ACCENT + '1A' },
  selectChipInactive: { borderColor: colors.border, backgroundColor: colors.surface },
  selectChipText: { fontSize: 13, fontWeight: '600' },
  condChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  condChipActive: { borderColor: STAY_ACCENT, backgroundColor: STAY_ACCENT },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 3 },
  photoCount: { fontSize: 11, color: colors.textSecondary },
  submitBtn: { backgroundColor: STAY_ACCENT, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
