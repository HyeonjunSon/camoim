import { useState, useEffect } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getNotificationSettings, updateNotificationSettings } from '../../lib/api';

const ITEMS = [
  { key: 'comment', icon: '💬' },
  { key: 'reply',   icon: '↩️' },
  { key: 'like',    icon: '❤️' },
  { key: 'chat',    icon: '✉️' },
  { key: 'boardSubscription', icon: '📋' },
  { key: 'notice',  icon: '📢' },
];

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getNotificationSettings();
        if (res.success) setSettings(res.data);
      } catch (e) {
        Alert.alert(t('common.error'), e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    try {
      const res = await updateNotificationSettings({ [key]: next[key] });
      if (res.success) setSettings(res.data);
      else throw new Error(res.message);
    } catch (e) {
      // 롤백
      setSettings(settings);
      Alert.alert(t('common.error'), t('notifSet.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const masterOff = settings.enabled === false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* 마스터 토글 */}
      <View style={styles.section}>
        <Row
          icon="🔔"
          title={t('notifSet.enabled')}
          desc={t('notifSet.enabledDesc')}
          value={settings.enabled !== false}
          onValueChange={() => toggle('enabled')}
          disabled={saving}
        />
      </View>

      {/* 카테고리별 */}
      <View style={[styles.section, masterOff && { opacity: 0.4 }]} pointerEvents={masterOff ? 'none' : 'auto'}>
        {ITEMS.map((it, idx) => (
          <View key={it.key}>
            <Row
              icon={it.icon}
              title={t(`notifSet.${it.key}`)}
              desc={t(`notifSet.${it.key}Desc`)}
              value={settings[it.key] !== false}
              onValueChange={() => toggle(it.key)}
              disabled={saving || masterOff}
            />
            {idx < ITEMS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ icon, title, desc, value, onValueChange, disabled }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.title}>{title}</Text>
        <Text style={rowStyles.desc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  desc: { fontSize: 12, color: '#888888', marginTop: 2 },
});

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    backgroundColor: colors.surface, borderRadius: 14, marginHorizontal: 16,
    marginTop: 16, padding: 12,
  },
  divider: { height: 0.5, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
