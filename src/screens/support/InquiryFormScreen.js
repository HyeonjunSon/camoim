import { useState, useLayoutEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { createInquiry } from '../../lib/api';
import { getDeviceInfo } from '../../lib/deviceInfo';

const ALL_CATS = ['account', 'post', 'chat', 'block', 'verify', 'bug', 'feature', 'etc'];

export default function InquiryFormScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const lockedCategory = route.params?.lockedCategory ?? null;
  const isAd = lockedCategory === 'ad';

  const [category, setCategory] = useState(isAd ? 'ad' : '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isAd ? t('support.menuAd') : t('inquiry.title'),
    });
  }, [navigation, isAd, t]);

  const handleSubmit = async () => {
    if (!category) return Alert.alert(t('inquiry.catRequired'));
    if (!title.trim()) return Alert.alert(t('inquiry.titleRequired'));
    if (!content.trim()) return Alert.alert(t('inquiry.contentRequired'));

    setSubmitting(true);
    try {
      const res = await createInquiry({
        category,
        title: title.trim(),
        content: content.trim(),
        ...getDeviceInfo(),
      });
      if (res.success) {
        Alert.alert(t('inquiry.submitted'), '', [
          { text: t('common.confirm') ?? 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(res.message || t('inquiry.submitFailed'));
      }
    } catch (e) {
      Alert.alert(e.message || t('inquiry.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.inputBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {isAd && (
          <View style={styles.adHint}>
            <Text style={styles.adHintText}>{t('support.adIntro')}</Text>
            <Text style={styles.adHintMail}><Ionicons name="mail" size={12} color="#3B82F6" /> {t('support.adMail')}</Text>
          </View>
        )}

        {!isAd && (
          <>
            <Text style={styles.label}>{t('inquiry.cat')}</Text>
            <View style={styles.catWrap}>
              {ALL_CATS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, category === c && styles.catChipActive]}
                  onPress={() => setCategory(c)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>
                    {t(`inquiry.c_${c}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>{t('inquiry.titleLabel')}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t('inquiry.titlePh')}
          placeholderTextColor={colors.textSecondary}
          maxLength={200}
        />

        <Text style={styles.label}>{t('inquiry.contentLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content}
          onChangeText={setContent}
          placeholder={t('inquiry.contentPh')}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={5000}
        />

        <Text style={styles.notice}><Ionicons name="information-circle" size={12} color={colors.textSecondary} /> {t('inquiry.autoNotice')}</Text>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitText}>{t('inquiry.submit')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  adHint: {
    backgroundColor: colors.primary + '12', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  adHintText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  adHintMail: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  catChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: colors.primary },
  input: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  notice: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
