import { useState } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { createGroup } from '../../lib/api';

const CATEGORIES = [
  { key: 'hobby', labelKey: 'group.catHobby', emoji: '🎨' },
  { key: 'study', labelKey: 'group.catStudy', emoji: '📚' },
  { key: 'local', labelKey: 'group.catLocal', emoji: '📍' },
  { key: 'job', labelKey: 'group.catJob', emoji: '💼' },
  { key: 'workinghol', labelKey: 'group.catWorkinghol', emoji: '✈️' },
  { key: 'general', labelKey: 'group.catGeneral', emoji: '💬' },
];

export default function GroupCreateScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [joinPolicy, setJoinPolicy] = useState('open');
  const [submitting, setSubmitting] = useState(false);

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
        city: city.trim(),
        joinPolicy,
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 안내 */}
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={styles.noticeText}>{t('group.pendingNotice')}</Text>
        </View>

        {/* 이름 */}
        <Text style={styles.label}>{t('group.nameLabel')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('group.namePh')}
          placeholderTextColor={colors.textSecondary}
          maxLength={50}
        />

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
