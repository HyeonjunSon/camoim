import { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { getGroup, updateGroup, uploadGroupCover } from '../../lib/api';

const CATEGORIES = [
  { key: 'hobby', labelKey: 'group.catHobby', emoji: '🎨' },
  { key: 'study', labelKey: 'group.catStudy', emoji: '📚' },
  { key: 'local', labelKey: 'group.catLocal', emoji: '📍' },
  { key: 'job', labelKey: 'group.catJob', emoji: '💼' },
  { key: 'workinghol', labelKey: 'group.catWorkinghol', emoji: '✈️' },
  { key: 'general', labelKey: 'group.catGeneral', emoji: '💬' },
];

export default function GroupEditScreen({ route, navigation }) {
  const { groupId } = route.params || {};
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [joinPolicy, setJoinPolicy] = useState('open');
  const [name, setName] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getGroup(groupId);
        if (res.success) {
          const g = res.data;
          setName(g.name);
          setCoverImage(g.coverImage || '');
          setDescription(g.description || '');
          setCategory(g.category);
          setCity(g.city || '');
          setJoinPolicy(g.joinPolicy);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [groupId]);

  const onPickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('post.permRequired'), t('post.permPhotoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 1],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingCover(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadGroupCover(groupId, { uri: manipulated.uri });
      if (res.success) {
        setCoverImage(res.data.coverImage);
      } else {
        Alert.alert('', res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    } finally {
      setUploadingCover(false);
    }
  };

  const onSave = async () => {
    setSubmitting(true);
    try {
      const res = await updateGroup(groupId, {
        description: description.trim(),
        category,
        city: city.trim(),
        joinPolicy,
      });
      if (res.success) {
        Alert.alert('', '저장되었어요.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        Alert.alert('', res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CustomHeader navigation={navigation} title="모임 정보 수정" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CustomHeader navigation={navigation} title="모임 정보 수정" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 커버 이미지 */}
        <Text style={styles.label}>커버 이미지</Text>
        <TouchableOpacity style={styles.coverWrap} onPress={onPickCover} activeOpacity={0.85} disabled={uploadingCover}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="image-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.coverPlaceholderText}>커버 이미지 추가</Text>
            </View>
          )}
          {uploadingCover && (
            <View style={styles.coverOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </TouchableOpacity>

        {/* 이름 (읽기 전용) */}
        <Text style={styles.label}>{t('group.nameLabel')}</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{name}</Text>
        </View>
        <Text style={styles.hint}>이름은 변경할 수 없어요</Text>

        {/* 소개 */}
        <Text style={styles.label}>{t('group.descLabel')}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('group.descPh')}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={500}
        />

        {/* 카테고리 */}
        <Text style={styles.label}>{t('group.categoryLabel')}</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(c => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.catBtn, active && styles.catBtnActive]}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.75}
              >
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={[styles.catText, active && styles.catTextActive]}>{t(c.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 지역 */}
        <Text style={styles.label}>{t('group.cityLabel')}</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder={t('group.cityPh')}
          placeholderTextColor={colors.textSecondary}
          maxLength={100}
        />

        {/* 가입 방식 */}
        <Text style={styles.label}>{t('group.policyLabel')}</Text>
        <View style={styles.policyRow}>
          <TouchableOpacity
            style={[styles.policyBtn, joinPolicy === 'open' && styles.policyBtnActive]}
            onPress={() => setJoinPolicy('open')}
            activeOpacity={0.75}
          >
            <Text style={[styles.policyText, joinPolicy === 'open' && styles.policyTextActive]}>
              {t('group.policyOpen')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.policyBtn, joinPolicy === 'approval' && styles.policyBtnActive]}
            onPress={() => setJoinPolicy('approval')}
            activeOpacity={0.75}
          >
            <Text style={[styles.policyText, joinPolicy === 'approval' && styles.policyTextActive]}>
              {t('group.policyApproval')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submit, submitting && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>저장</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 6 },
  hint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  inputDisabled: { backgroundColor: colors.inputBg, opacity: 0.7 },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },

  coverWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  cover: { width: '100%', height: 160 },
  coverPlaceholder: {
    backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  coverPlaceholderText: { color: colors.textSecondary, fontSize: 13, marginTop: 8 },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.inputBg, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  catBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  catTextActive: { color: colors.white },

  policyRow: { flexDirection: 'row', gap: 8 },
  policyBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: colors.inputBg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  policyBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  policyText: { fontSize: 13, fontWeight: '600', color: colors.text },
  policyTextActive: { color: colors.white },

  submit: {
    marginTop: 24, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
