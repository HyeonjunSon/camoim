import { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, Platform, Modal, FlatList,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
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

const CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton',
  'Ottawa', 'Winnipeg', 'Victoria', 'Halifax', 'Saskatoon',
  'London', 'Quebec',
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
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState('open');
  const [name, setName] = useState('');
  const [isSchoolClub, setIsSchoolClub] = useState(false);

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
          setIsSchoolClub(!!g.university);
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
    // iOS는 allowsEditing=true일 때 aspect를 무시하고 정사각형 크롭을 강제함 →
    // 강제 크롭 비활성화하고 원본 비율 그대로 업로드 (디스플레이에서 contain으로 보여줌)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
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
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('', t('group.nameRequired') || '이름은 2자 이상이어야 해요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateGroup(groupId, {
        name: name.trim(),
        description: description.trim(),
        category,
        // 학교 동아리는 학교가 도시 컨텍스트라 city 보내지 않음
        city: isSchoolClub ? '' : city.trim(),
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
            <View style={[styles.cover, styles.coverLetterbox]}>
              <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFill} contentFit="contain" />
            </View>
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="image-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.coverPlaceholderText}>커버 이미지 추가</Text>
            </View>
          )}
          {/* 편집 배지 — 커버가 있을 때 우측 하단에 표시 */}
          {coverImage && !uploadingCover && (
            <View style={styles.coverEditBadge} pointerEvents="none">
              <Ionicons name="pencil" size={14} color="#fff" />
              <Text style={styles.coverEditBadgeText}>{t('common.edit') || '편집'}</Text>
            </View>
          )}
          {uploadingCover && (
            <View style={styles.coverOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </TouchableOpacity>

        {/* 이름 */}
        <Text style={styles.label}>{t('group.nameLabel')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('group.namePh') || '모임 이름'}
          placeholderTextColor={colors.textSecondary}
          maxLength={50}
        />
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

        {/* 지역 — 학교 동아리는 학교가 도시를 결정하므로 숨김 */}
        {!isSchoolClub && (
          <>
            <Text style={styles.label}>{t('group.cityLabel')}</Text>
            <TouchableOpacity
              style={styles.cityDropdown}
              onPress={() => setCityModalOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cityDropdownText, !city && styles.cityDropdownPlaceholder]}>
                {city ? (t(`city.${city}`) || city) : t('group.cityPh')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </>
        )}

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

      {/* 도시 선택 모달 */}
      <Modal visible={cityModalOpen} animationType="slide" transparent onRequestClose={() => setCityModalOpen(false)}>
        <View style={styles.cityModalOverlay}>
          <View style={styles.cityModalSheet}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>{t('group.cityLabel')}</Text>
              <TouchableOpacity onPress={() => setCityModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.cityItem, !city && styles.cityItemActive]}
              onPress={() => { setCity(''); setCityModalOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cityItemText, !city && styles.cityItemTextActive]}>
                {t('auth.citySkip')}
              </Text>
            </TouchableOpacity>
            <FlatList
              data={CITIES}
              keyExtractor={item => item}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.cityItem, city === c && styles.cityItemActive]}
                  onPress={() => { setCity(c); setCityModalOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cityItemText, city === c && styles.cityItemTextActive]}>
                    📍 {t(`city.${c}`) || c}
                  </Text>
                  {city === c && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>
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
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },

  coverWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  cover: { width: '100%', height: 160 },
  coverLetterbox: { backgroundColor: '#000' },
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
  coverEditBadge: {
    position: 'absolute', right: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  coverEditBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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

  // 도시 드롭다운
  cityDropdown: {
    backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border,
  },
  cityDropdownText: { fontSize: 14, color: colors.text },
  cityDropdownPlaceholder: { color: colors.textSecondary },

  // 도시 선택 모달
  cityModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  cityModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28,
  },
  cityModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  cityModalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cityItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cityItemActive: {},
  cityItemText: { fontSize: 15, color: colors.text },
  cityItemTextActive: { color: colors.primary, fontWeight: '700' },
});
