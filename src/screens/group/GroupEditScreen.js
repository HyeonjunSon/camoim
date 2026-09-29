import { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, Platform, Modal, FlatList, Linking,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { getGroup, updateGroup, uploadGroupCover } from '../../lib/api';

import { GROUP_CATEGORY_ICONS } from '../../lib/icons';

const CATEGORIES = [
  { key: 'hobby', labelKey: 'group.catHobby' },
  { key: 'study', labelKey: 'group.catStudy' },
  { key: 'local', labelKey: 'group.catLocal' },
  { key: 'job', labelKey: 'group.catJob' },
  { key: 'workinghol', labelKey: 'group.catWorkinghol' },
  { key: 'general', labelKey: 'group.catGeneral' },
];

import { CITIES } from '../../constants/cities';

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
      Alert.alert(t('post.permRequired'), t('post.permPhotoMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    // iOS ignores aspect when allowsEditing=true and forces a square crop, so
    // forced cropping is disabled and the original ratio is uploaded (the display uses contain)
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
        // School clubs do not send city, since the school provides the location context
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
        {/* Cover image */}
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
          {/* Edit badge — shown bottom-right once a cover exists */}
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

        {/* Name */}
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

        {/* Description */}
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

        {/* Category */}
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
                <Ionicons name={GROUP_CATEGORY_ICONS[c.key].ion} size={14} color={GROUP_CATEGORY_ICONS[c.key].color} />
                <Text style={[styles.catText, active && styles.catTextActive]}>{t(c.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Location — hidden for school clubs, where the school decides the city */}
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

        {/* Join policy */}
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

      {/* City picker modal */}
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
                    {t(`city.${c}`) || c}
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

  // City dropdown
  cityDropdown: {
    backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border,
  },
  cityDropdownText: { fontSize: 14, color: colors.text },
  cityDropdownPlaceholder: { color: colors.textSecondary },

  // City picker modal
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
