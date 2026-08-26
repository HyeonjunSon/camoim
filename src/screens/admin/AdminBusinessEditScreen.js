import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { BUSINESS_CATEGORIES, BUSINESS_CITIES } from '../../constants/businesses';
import { adminUpdateBusiness, adminDeleteBusiness, uploadBusinessImage } from '../../lib/api';

const PRIMARY = '#7F77DD';
const MAX_PHOTOS = 5;
const STATUSES = [
  { key: 'pending',  label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '거절' },
];

// 관리자 — 업체 전체 편집 (모든 필드 + 상태 + 수동 좌표)
export default function AdminBusinessEditScreen({ navigation, route }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const biz = route?.params?.business || {};

  const [status, setStatus] = useState(biz.status || 'pending');
  const [name, setName] = useState(biz.name || '');
  const [category, setCategory] = useState(biz.category || 'etc');
  const [city, setCity] = useState(biz.city || 'toronto');
  const [address, setAddress] = useState(biz.address || '');
  const [phone, setPhone] = useState(biz.phone || '');
  const [hours, setHours] = useState(biz.hours || '');
  const [description, setDescription] = useState(biz.description || '');
  const [images, setImages] = useState(Array.isArray(biz.images) ? biz.images : []);
  const [lat, setLat] = useState(biz.lat != null ? String(biz.lat) : '');
  const [lng, setLng] = useState(biz.lng != null ? String(biz.lng) : '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = !!(name.trim() && category && address.trim()) && !saving;

  const pickImage = async () => {
    if (images.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진을 첨부하려면 갤러리 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
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
      else Alert.alert('오류', res?.message || '이미지 업로드에 실패했어요.');
    } catch (e) {
      Alert.alert('오류', e?.message || '이미지 업로드에 실패했어요.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url) => setImages((prev) => prev.filter((u) => u !== url));

  const onSave = async () => {
    if (!canSave) return;
    // 좌표: 둘 다 비면 미지정(주소 지오코딩), 하나만 채우면 경고
    const latTrim = lat.trim(), lngTrim = lng.trim();
    if ((latTrim && !lngTrim) || (!latTrim && lngTrim)) {
      Alert.alert('좌표 확인', '위도·경도는 둘 다 입력하거나 둘 다 비워주세요.');
      return;
    }
    const payload = {
      status,
      name: name.trim(),
      category,
      city,
      address: address.trim(),
      phone: phone.trim(),
      hours: hours.trim(),
      description: description.trim(),
      images,
    };
    if (latTrim && lngTrim) {
      const latN = Number(latTrim), lngN = Number(lngTrim);
      if (!Number.isFinite(latN) || !Number.isFinite(lngN) || latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
        Alert.alert('좌표 확인', '올바른 위도(-90~90)·경도(-180~180)를 입력해주세요.');
        return;
      }
      payload.lat = latN;
      payload.lng = lngN;
    }
    setSaving(true);
    try {
      const res = await adminUpdateBusiness(biz.id, payload);
      if (res.success) {
        navigation.goBack();
      } else {
        Alert.alert('오류', res.message || '저장에 실패했어요.');
      }
    } catch (e) {
      Alert.alert('오류', e?.message || '저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('업체 삭제', `"${biz.name}"을(를) 삭제할까요? 되돌릴 수 없어요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const res = await adminDeleteBusiness(biz.id);
            if (res.success) navigation.goBack();
            else Alert.alert('오류', res.message || '삭제에 실패했어요.');
          } catch (e) {
            Alert.alert('오류', e?.message || '삭제에 실패했어요.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <CustomHeader title="업체 편집" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 상태 */}
          <Field label="상태">
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {STATUSES.map((s) => {
                const active = status === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.cityChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8}
                    onPress={() => setStatus(s.key)}
                  >
                    <Text style={[styles.selectChipText, { color: active ? PRIMARY : colors.textSecondary }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* 업체명 */}
          <Field label="업체명" required>
            <TextInput value={name} onChangeText={setName} placeholder="업체명" placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={100} />
          </Field>

          {/* 카테고리 */}
          <Field label="카테고리" required>
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
                    <Text style={[styles.selectChipText, { color: active ? PRIMARY : colors.textSecondary }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* 도시 */}
          <Field label="도시" required>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {BUSINESS_CITIES.map((c) => {
                const active = city === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.cityChip, active ? styles.selectChipActive : styles.selectChipInactive]}
                    activeOpacity={0.8}
                    onPress={() => setCity(c.key)}
                  >
                    <Text style={[styles.selectChipText, { color: active ? PRIMARY : colors.textSecondary }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* 주소 */}
          <Field label="주소" required>
            <TextInput value={address} onChangeText={setAddress} placeholder="예: 691 Bloor St W, Toronto" placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={200} />
            <Text style={styles.hint}>주소를 바꾸면 좌표를 자동으로 다시 찾아요.</Text>
          </Field>

          {/* 전화번호 */}
          <Field label="전화번호" optional>
            <TextInput value={phone} onChangeText={setPhone} placeholder="예: (416) 000-0000" placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="phone-pad" maxLength={40} />
          </Field>

          {/* 영업시간 */}
          <Field label="영업시간" optional>
            <TextInput value={hours} onChangeText={setHours} placeholder="예: 매일 11:00–21:00" placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={120} />
          </Field>

          {/* 소개 */}
          <Field label="소개" optional>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="업체 소개"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              multiline
              maxLength={1000}
            />
          </Field>

          {/* 사진 */}
          <Field label="사진" optional>
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

          {/* 좌표 (수동) */}
          <Field label="좌표 (수동)" optional>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={lat} onChangeText={setLat} placeholder="위도 (예: 43.65)" placeholderTextColor={colors.textSecondary} style={[styles.input, { flex: 1 }]} keyboardType="numbers-and-punctuation" />
              <TextInput value={lng} onChangeText={setLng} placeholder="경도 (예: -79.38)" placeholderTextColor={colors.textSecondary} style={[styles.input, { flex: 1 }]} keyboardType="numbers-and-punctuation" />
            </View>
            <Text style={styles.hint}>
              {biz.hasLocation === false && !lat && !lng
                ? '⚠︎ 좌표가 없어 지도에 안 떠요. 직접 입력하면 핀이 생겨요.'
                : '비워두면 주소로 자동 지정. 직접 입력하면 그 좌표가 우선돼요.'}
            </Text>
          </Field>

          <TouchableOpacity style={[styles.saveBtn, !canSave && { opacity: 0.5 }]} activeOpacity={0.9} onPress={onSave} disabled={!canSave}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>저장</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={onDelete} disabled={saving}>
            <Ionicons name="trash-outline" size={16} color="#FF4444" />
            <Text style={styles.deleteText}>업체 삭제</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, required, optional, children }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={{ color: '#FF4444' }}> *</Text>}
        {optional && <Text style={{ color: colors.textSecondary, fontWeight: '500' }}> (선택)</Text>}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  hint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  selectChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  cityChip: { alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
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
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  deleteText: { fontSize: 14, fontWeight: '700', color: '#FF4444' },
});
