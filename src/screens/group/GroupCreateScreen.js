import { useState, useLayoutEffect } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform, Modal, FlatList,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { createGroup } from '../../lib/api';

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

export default function GroupCreateScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState('open');
  // The entry path decides the context — arriving from the school community makes it a school club, otherwise a general group
  // (no toggle in the UI — the context decides)
  const isSchoolContext = !!route?.params?.schoolOnly;
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('', t('group.nameRequired'));
      return;
    }
    if (!category) {
      Alert.alert('', t('group.categoryRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await createGroup({
        name: name.trim(),
        description: description.trim(),
        category,
        // School clubs leave city empty, since the school already provides the location context
        city: isSchoolContext ? '' : city.trim(),
        joinPolicy,
        schoolOnly: isSchoolContext,
      });
      if (res.success) {
        Alert.alert('', t('group.submitOk'), [
          { text: t('common.ok') || 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('', res.message || t('common.serverError'));
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('common.serverError');
      if (msg.includes('이미') || /exist/i.test(msg)) {
        Alert.alert('', t('group.duplicateName'));
      } else {
        Alert.alert('', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CustomHeader navigation={navigation} title={t(isSchoolContext ? 'group.createTitleSchool' : 'group.createTitle')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Guidance */}
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={styles.noticeText}>{t('group.pendingNotice')}</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>{t('group.nameLabel')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('group.namePh')}
          placeholderTextColor={colors.textSecondary}
          maxLength={50}
        />

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

        {/* Location — a dropdown (hidden for school clubs, where the school decides the city) */}
        {!isSchoolContext && (
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

        {/* Arriving from a school context shows only a banner (no toggle — it is automatically a school club) */}
        {isSchoolContext && user?.university && (
          <View style={styles.schoolToggleBox}>
            <Text style={styles.schoolToggleLabel}><Ionicons name="school" size={13} color={colors.primary} /> 학교 동아리</Text>
            <Text style={styles.schoolToggleHint}>
              {`${user.university} 인증 회원만 가입할 수 있어요`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submit, submitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>{t('group.submitBtn')}</Text>
          )}
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
  content: { padding: 20, paddingBottom: 40 },
  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.primary + '12', padding: 12, borderRadius: 10, marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
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
  schoolToggleBox: {
    marginTop: 16, padding: 14, borderRadius: 12,
    backgroundColor: colors.primary + '0F',
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  schoolToggleLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  schoolToggleHint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
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
