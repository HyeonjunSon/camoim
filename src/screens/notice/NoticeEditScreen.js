import { useState, useLayoutEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { createNotice, updateNotice } from '../../lib/api';

export default function NoticeEditScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const headerHeight = useHeaderHeight();

  const { t } = useLang();
  const editing = route.params?.notice;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState(editing?.content ?? '');
  const [pinned, setPinned] = useState(editing?.pinned ?? false);
  const [sendPushOpt, setSendPushOpt] = useState(false);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editing ? t('notice.editBtn') : t('notice.writeBtn'),
    });
  }, [navigation, editing]);

  const onSubmit = async () => {
    if (!title.trim()) return Alert.alert('', t('notice.titleRequired'));
    if (!content.trim()) return Alert.alert('', t('notice.contentRequired'));
    setSaving(true);
    try {
      const res = editing
        ? await updateNotice(editing.id, { title: title.trim(), content: content.trim(), pinned })
        : await createNotice({ title: title.trim(), content: content.trim(), pinned, sendPush: sendPushOpt });
      if (res.success) {
        Alert.alert('', editing ? t('notice.updated') : t('notice.created'));
        navigation.goBack();
      } else {
        throw new Error(res.message);
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('notice.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          placeholder={t('notice.titlePh')}
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />
        <TextInput
          style={styles.contentInput}
          placeholder={t('notice.contentPh')}
          placeholderTextColor={colors.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.optRow}>
          <Text style={styles.optLabel}>{t('notice.pinOpt')}</Text>
          <Switch
            value={pinned}
            onValueChange={setPinned}
            trackColor={{ false: '#D1D5DB', true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {!editing && (
          <View style={styles.optRow}>
            <Text style={styles.optLabel}>{t('notice.pushOpt')}</Text>
            <Switch
              value={sendPushOpt}
              onValueChange={setSendPushOpt}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitBtnText}>{t('notice.submit')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  titleInput: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12,
  },
  contentInput: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text, minHeight: 200, textAlignVertical: 'top',
  },
  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingVertical: 4,
  },
  optLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
