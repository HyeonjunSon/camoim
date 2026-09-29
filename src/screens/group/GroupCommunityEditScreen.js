import { useEffect, useState } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { getGroup, updateGroupCommunity } from '../../lib/api';
import CustomHeader from '../../components/CustomHeader';

const FIELDS = [
  { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', labelKey: 'community.instagram', placeholder: 'instagram.com/...' },
  { key: 'kakaoOpen', icon: 'chatbubble-ellipses', color: '#FAE100', labelKey: 'community.kakaoOpen', placeholder: 'open.kakao.com/o/...' },
  { key: 'discord', icon: 'logo-discord', color: '#5865F2', labelKey: 'community.discord', placeholder: 'discord.gg/...' },
  { key: 'homepage', icon: 'globe', color: '#10B981', labelKey: 'community.homepage', placeholder: 'example.com' },
];

export default function GroupCommunityEditScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [form, setForm] = useState({ instagram: '', kakaoOpen: '', discord: '', homepage: '', notice: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isSchoolClub, setIsSchoolClub] = useState(false);

  const headerTitle = t(isSchoolClub ? 'group.communityEditTitleSchool' : 'group.communityEditTitle');

  useEffect(() => {
    (async () => {
      try {
        const res = await getGroup(groupId);
        if (res.success) {
          setCanEdit(!!res.data?.canEditCommunity);
          setIsSchoolClub(!!res.data?.university);
          const c = res.data?.community || {};
          setForm({
            instagram: c.instagram || '',
            kakaoOpen: c.kakaoOpen || '',
            discord: c.discord || '',
            homepage: c.homepage || '',
            notice: c.notice || '',
          });
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const onSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await updateGroupCommunity(groupId, form);
      if (res.success) {
        navigation.goBack();
      } else {
        Alert.alert(t('common.error'), res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!canEdit) {
    return (
      <View style={styles.container}>
        <CustomHeader navigation={navigation} title={headerTitle} />
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={32} color={colors.textSecondary} />
          <Text style={styles.lockText}>{t('group.communityNoPerm')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        navigation={navigation}
        title={headerTitle}
        rightActions={[
          { text: saving ? '...' : t('common.save'), onPress: saving ? undefined : onSave, disabled: saving, label: t('common.save') },
        ]}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>{t('group.communityEditHint')}</Text>

          <Text style={styles.sectionLabel}>{t('community.notice')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form.notice}
            onChangeText={(v) => setForm({ ...form, notice: v })}
            placeholder={t('community.noticePh')}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
          <Text style={styles.count}>{form.notice.length}/500</Text>

          <Text style={styles.sectionLabel}>{t('community.linksLabel')}</Text>
          {FIELDS.map(f => (
            <View key={f.key} style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name={f.icon} size={16} color={f.color} />
                <Text style={styles.fieldLabel}>{t(f.labelKey)}</Text>
              </View>
              <TextInput
                style={styles.input}
                value={form[f.key]}
                onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={300}
              />
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  lockText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 8 },
  count: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  fieldBlock: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
});
