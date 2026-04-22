import { useState, useCallback } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminListInquiries, adminAnswerInquiry } from '../../lib/api';
import { useLang } from '../../context/LangContext';

export default function AdminInquiriesScreen() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const TYPE_TABS = [
    { v: 'all', label: t('admin.iqAll') },
    { v: 'general', label: t('admin.iqGeneral') },
    { v: 'ad', label: t('admin.iqAd') },
  ];
  const STATUS_TABS = [
    { v: 'all', label: t('admin.iqAllStatus') },
    { v: 'open', label: t('admin.iqUnanswered') },
    { v: 'answered', label: t('admin.iqAnswered') },
  ];

  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [answer, setAnswer] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListInquiries(type, status);
      if (res.success) setItems(res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, [type, status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!answer.trim()) return Alert.alert(t('admin.iqReplyInput'));
    try {
      await adminAnswerInquiry(active.id, answer.trim());
      setActive(null);
      setAnswer('');
      load();
    } catch (e) { Alert.alert(t('admin.boardFailed'), e.message); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TYPE_TABS.map(tb => (
          <TouchableOpacity
            key={tb.v}
            style={[styles.tab, type === tb.v && styles.tabActive]}
            onPress={() => setType(tb.v)}
          >
            <Text style={[styles.tabText, type === tb.v && styles.tabTextActive]}>{tb.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tabBar}>
        {STATUS_TABS.map(tb => (
          <TouchableOpacity
            key={tb.v}
            style={[styles.tab, status === tb.v && styles.tabActive]}
            onPress={() => setStatus(tb.v)}
          >
            <Text style={[styles.tabText, status === tb.v && styles.tabTextActive]}>{tb.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('admin.iqNoInquiries')}</Text>}
          renderItem={({ item }) => {
            const answered = item.status === 'answered';
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => { setActive(item); setAnswer(item.answer || ''); }}
                activeOpacity={0.8}
              >
                <View style={styles.row}>
                  <Text style={[styles.cat, item.category === 'ad' && { color: '#7C3AED' }]}>
                    {item.category}
                  </Text>
                  <Text style={[styles.statusBadge, answered ? styles.statAns : styles.statOpen]}>
                    {answered ? t('admin.iqAnswered') : t('admin.iqUnanswered')}
                  </Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.user?.nickname || '?'} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!active} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{active?.title}</Text>
            <Text style={styles.modalMeta}>
              {active?.user?.nickname} · {active?.user?.email}
            </Text>
            <Text style={styles.modalMeta}>
              {active?.appVersion} · {active?.platform} {active?.osVersion} · {active?.deviceModel}
            </Text>

            <Text style={styles.lbl}>{t('admin.iqContent')}</Text>
            <View style={styles.contentBox}>
              <Text style={styles.contentText}>{active?.content}</Text>
            </View>

            <Text style={styles.lbl}>{t('admin.iqReply')}</Text>
            <TextInput
              style={[styles.input, { height: 120 }]}
              value={answer}
              onChangeText={setAnswer}
              multiline
              placeholder={t('admin.iqReplyPh')}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActive(null)}>
                <Text style={{ color: colors.textSecondary }}>{t('common.close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={submit}>
                <Text style={{ color: colors.white, fontWeight: '700' }}>{t('admin.iqSendReply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, paddingTop: 8 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  card: { backgroundColor: colors.surface, padding: 14, borderRadius: 12, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cat: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  statusBadge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  statOpen: { backgroundColor: '#F59E0B' + '18', color: '#F59E0B' },
  statAns: { backgroundColor: '#10B981' + '18', color: '#2D9E5A' },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  lbl: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  contentBox: { backgroundColor: colors.inputBg, padding: 12, borderRadius: 10 },
  contentText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  input: { backgroundColor: colors.inputBg, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: 'center' },
  applyBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
});
