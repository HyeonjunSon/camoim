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
import { BUSINESS_CATEGORIES, BUSINESS_CITIES } from '../../constants/businesses';
import { createBusiness, uploadBusinessImage } from '../../lib/api';

const PRIMARY = '#7F77DD';
const MAX_PHOTOS = 5;

// 업체 제보 폼 — 유저가 한인 업체 정보를 제출 → 관리자 승인 후 지도 노출
export default function BusinessReportScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState(route?.params?.city || 'toronto');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [images, setImages] = useState([]); // Cloudinary URLs
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!(name.trim() && category && address.trim()) && !submitting;

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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadBusinessImage({ uri: manipulated.uri, filename: `biz_${Date.now()}.jpg`, type: 'image/jpeg' });
      if (res?.success && res.url) setImages((prev) => [...prev, res.url]);
      else Alert.alert(t('biz.errorTitle'), t('biz.uploadFail'));
    } catch (e) {
      Alert.alert(t('biz.errorTitle'), t('biz.uploadFail'));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url) => setImages((prev) => prev.filter((u) => u !== url));

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await createBusiness({
        name: name.trim(),
        category,
        city,
        address: address.trim(),
        phone: phone.trim(),
        images,
      });
      if (res?.success) {
        Alert.alert(t('biz.addedTitle'), t('biz.addedMsg'), [
          { text: t('biz.confirmOk'), onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(t('biz.errorTitle'), t('biz.submitFail'));
      }
    } catch (e) {
      Alert.alert(t('biz.errorTitle'), t('biz.submitFail'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CustomHeader navigation={navigation} title={t('biz.addPlace')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('biz.formNotice')}</Text>
          </View>

          {/* 업체명 */}
          <Field label={t('biz.fName')} required>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('biz.fNamePh')}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              maxLength={100}
            />
          </Field>

          {/* 카테고리 */}
          <Field label={t('biz.fCategory')} required>
            <View style={styles.chipWrap}>
              {BUSINESS_CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.selectChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8}
                    onPress={() => setCategory(c.key)}
                  >
                    <Ionicons name={c.ion} size={13} color={active ? PRIMARY : c.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.selectChipText, { color: active ? PRIMARY : colors.textSecondary }]}>
                      {t(c.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* 도시 */}
          <Field label={t('biz.fCity')} required>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {BUSINESS_CITIES.map((c) => {
                const active = city === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.cityChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8}
                    onPress={() => setCity(c.key)}
                  >
                    <Text style={[styles.selectChipText, { color: active ? PRIMARY : colors.textSecondary }]}>{t(c.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* 주소 */}
          <Field label={t('biz.fAddress')} required>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={t('biz.fAddressPh')}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              maxLength={200}
            />
          </Field>

          {/* 전화번호 */}
          <Field label={t('biz.fPhone')} optional>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('biz.fPhonePh')}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              keyboardType="phone-pad"
              maxLength={40}
            />
          </Field>

          {/* 사진 */}
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
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
                      <Text style={styles.photoCount}>{images.length}/{MAX_PHOTOS}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Field>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
            activeOpacity={0.9}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>{t('biz.submitAdd')}</Text>
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
  notice: { backgroundColor: colors.inputBg, borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  selectChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  cityChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  selectChipActive: { borderColor: PRIMARY, backgroundColor: 'rgba(127,119,221,0.10)' },
  selectChipInactive: { borderColor: colors.border, backgroundColor: colors.surface },
  selectChipText: { fontSize: 13, fontWeight: '600' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: 76, height: 76, borderRadius: 12, backgroundColor: colors.inputBg,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  photoCount: { fontSize: 11, color: colors.textSecondary },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
