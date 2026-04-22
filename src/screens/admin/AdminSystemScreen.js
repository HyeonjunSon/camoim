import { useState, useEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminGetSettings, adminUpdateSetting } from '../../lib/api';
import { useLang } from '../../context/LangContext';

export default function AdminSystemScreen() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [forceUpdate, setForceUpdate] = useState({ enabled: false, minVersion: '' });
  const [bannedWords, setBannedWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [blockedIps, setBlockedIps] = useState([]);
  const [newIp, setNewIp] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminGetSettings();
      if (res.success) {
        setMaintenance(res.data.maintenance);
        setForceUpdate(res.data.forceUpdate);
        setBannedWords(res.data.bannedWords || []);
        setBlockedIps(res.data.blockedIps || []);
      }
    } catch {} finally { setLoading(false); }
  };

  const save = async (key, value) => {
    try {
      await adminUpdateSetting(key, value);
      Alert.alert(t('admin.sysSaved'));
    } catch (e) {
      Alert.alert(t('admin.boardFailed'), e.message);
    }
  };

  const addWord = () => {
    if (!newWord.trim()) return;
    const next = [...bannedWords, newWord.trim()];
    setBannedWords(next);
    setNewWord('');
    save('bannedWords', next);
  };

  const removeWord = (w) => {
    const next = bannedWords.filter(x => x !== w);
    setBannedWords(next);
    save('bannedWords', next);
  };

  const addIp = () => {
    if (!newIp.trim()) return;
    const next = [...blockedIps, newIp.trim()];
    setBlockedIps(next);
    setNewIp('');
    save('blockedIps', next);
  };

  const removeIp = (ip) => {
    const next = blockedIps.filter(x => x !== ip);
    setBlockedIps(next);
    save('blockedIps', next);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.section}>{t('admin.sysMaintenance')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.lbl}>{t('admin.sysEnabled')}</Text>
          <Switch
            value={maintenance.enabled}
            onValueChange={(v) => setMaintenance({ ...maintenance, enabled: v })}
          />
        </View>
        <Text style={styles.lblSmall}>{t('admin.sysMessage')}</Text>
        <TextInput
          style={styles.input}
          value={maintenance.message}
          onChangeText={(v) => setMaintenance({ ...maintenance, message: v })}
          placeholder={t('admin.sysMessagePh')}
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <TouchableOpacity style={styles.saveBtn} onPress={() => save('maintenance', maintenance)}>
          <Text style={styles.saveText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>{t('admin.sysForceUpdate')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.lbl}>{t('admin.sysEnabled')}</Text>
          <Switch
            value={forceUpdate.enabled}
            onValueChange={(v) => setForceUpdate({ ...forceUpdate, enabled: v })}
          />
        </View>
        <Text style={styles.lblSmall}>{t('admin.sysMinVersion')}</Text>
        <TextInput
          style={styles.input}
          value={forceUpdate.minVersion}
          onChangeText={(v) => setForceUpdate({ ...forceUpdate, minVersion: v })}
          placeholder="1.0.0"
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={() => save('forceUpdate', forceUpdate)}>
          <Text style={styles.saveText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>{t('admin.sysBannedWords')}</Text>
      <View style={styles.card}>
        <View style={[styles.row, { gap: 8 }]}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={newWord}
            onChangeText={setNewWord}
            placeholder={t('admin.sysBannedWordPh')}
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addWord}>
            <Text style={styles.addText}>{t('admin.sysAdd')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tagWrap}>
          {bannedWords.map(w => (
            <TouchableOpacity key={w} style={styles.tag} onPress={() => removeWord(w)}>
              <Text style={styles.tagText}>{w} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.section}>{t('admin.sysBlockedIp')}</Text>
      <View style={styles.card}>
        <View style={[styles.row, { gap: 8 }]}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={newIp}
            onChangeText={setNewIp}
            placeholder="123.45.67.89"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addIp}>
            <Text style={styles.addText}>{t('admin.sysAdd')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tagWrap}>
          {blockedIps.map(ip => (
            <TouchableOpacity key={ip} style={styles.tag} onPress={() => removeIp(ip)}>
              <Text style={styles.tagText}>{ip} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 14, fontWeight: '700', color: colors.text, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lbl: { fontSize: 14, color: colors.text, fontWeight: '600' },
  lblSmall: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 10, padding: 12,
    fontSize: 14, color: colors.text, marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8,
  },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  addText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  tagText: { fontSize: 12, color: colors.text },
});
