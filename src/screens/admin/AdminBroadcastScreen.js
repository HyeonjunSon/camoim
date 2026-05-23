import { useState, useCallback } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import {
  getNotices, createNotice, deleteNotice, adminBroadcastPush,
} from '../../lib/api';
import { formatTime } from '../../lib/time';

export default function AdminBroadcastScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useLang();

  const [tab, setTab] = useState('notice');

  const [notices, setNotices] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [sendPushWithNotice, setSendPushWithNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadNotices = useCallback(async () => {
    try {
      const res = await getNotices();
      if (res.success) setNotices(res.data ?? []);
    } catch {}
    finally { setLoadingNotices(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadNotices(); }, [loadNotices]));

  const submitNotice = async () => {
    if (!title.trim()) return Alert.alert('', t('admin.bcTitleRequired'));
    if (!content.trim()) return Alert.alert('', t('admin.bcContentRequired'));
    setSaving(true);
    try {
      const res = await createNotice({
        title: title.trim(),
        content: content.trim(),
        pinned,
        sendPush: sendPushWithNotice,
      });
      if (res.success) {
        Alert.alert(t('admin.bcDone'), sendPushWithNotice ? t('admin.bcDoneWithPush') : t('admin.bcDoneNoPush'));
        setTitle(''); setContent(''); setPinned(false); setSendPushWithNotice(false);
        setShowForm(false);
        loadNotices();
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('admin.bcDeleteFailed'));
    } finally { setSaving(false); }
  };

  const handleDeleteNotice = (notice) => {
    Alert.alert(t('admin.bcDeleteTitle'), t('admin.bcDeleteAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try { await deleteNotice(notice.id); loadNotices(); }
          catch (e) { Alert.alert(t('common.error'), e.message); }
        },
      },
    ]);
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) return Alert.alert('', t('admin.bcPushBodyRequired'));
    Alert.alert(t('admin.bcPushConfirmTitle'), t('admin.bcPushConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.bcPushAction'),
        onPress: async () => {
          setSending(true);
          try {
            const res = await adminBroadcastPush({ title: pushTitle, body: pushBody, target: {} });
            Alert.alert(t('admin.bcPushDone'), t('admin.bcPushDoneMsg').replace('{n}', String(res.data?.sent ?? 0)));
            setPushTitle(''); setPushBody('');
          } catch (e) { Alert.alert(t('admin.boardFailed'), e.message); }
          finally { setSending(false); }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'notice' && styles.tabActive]}
          onPress={() => setTab('notice')}
          activeOpacity={0.7}
        >
          <Ionicons name="megaphone-outline" size={16} color={tab === 'notice' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'notice' && styles.tabTextActive]}>{t('admin.bcNoticeTab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'push' && styles.tabActive]}
          onPress={() => setTab('push')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={16} color={tab === 'push' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'push' && styles.tabTextActive]}>{t('admin.bcPushTab')}</Text>
        </TouchableOpacity>
      </View>

      {tab === 'notice' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotices(); }} />}
        >
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{t('admin.bcNewNotice')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('admin.bcTitlePh')}
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={200}
              />
              <TextInput
                style={[styles.input, styles.textArea, { marginTop: 10 }]}
                placeholder={t('admin.bcContentPh')}
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.optRow}>
                <View style={styles.optInfo}>
                  <Ionicons name="pin" size={16} color={colors.primary} />
                  <Text style={styles.optLabel}>{t('admin.bcPinTop')}</Text>
                </View>
                <Switch
                  value={pinned}
                  onValueChange={setPinned}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
              <View style={styles.optRow}>
                <View style={styles.optInfo}>
                  <Ionicons name="notifications" size={16} color="#F59E0B" />
                  <Text style={styles.optLabel}>{t('admin.bcSendPush')}</Text>
                </View>
                <Switch
                  value={sendPushWithNotice}
                  onValueChange={setSendPushWithNotice}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowForm(false); setTitle(''); setContent(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                  onPress={submitNotice}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.submitBtnText}>{t('admin.bcRegister')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>{t('admin.bcNewNotice')}</Text>
            </TouchableOpacity>
          )}

          {loadingNotices ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : notices.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('admin.bcNoNotices')}</Text>
            </View>
          ) : (
            notices.map((notice) => (
              <View key={String(notice.id)} style={styles.noticeCard}>
                <TouchableOpacity
                  style={styles.noticeContent}
                  onPress={() => navigation.navigate('NoticeDetail', { id: notice.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.noticeTagRow}>
                    {notice.pinned && (
                      <View style={styles.pinBadge}>
                        <Ionicons name="pin" size={10} color={colors.primary} />
                        <Text style={styles.pinBadgeText}>{t('admin.bcPinned')}</Text>
                      </View>
                    )}
                    <Text style={styles.noticeDate}>{formatTime(notice.createdAt, t)}</Text>
                  </View>
                  <Text style={styles.noticeTitle} numberOfLines={2}>{notice.title}</Text>
                  <Text style={styles.noticePreview} numberOfLines={2}>{notice.content}</Text>
                </TouchableOpacity>
                <View style={styles.noticeActions}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('NoticeEdit', { notice })}
                    style={styles.noticeActionBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteNotice(notice)}
                    style={styles.noticeActionBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'push' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color="#3B82F6" />
            <Text style={styles.infoText}>
              {t('admin.bcPushOnly')}{'\n'}
              {t('admin.bcPushHint')}
            </Text>
          </View>

          <Text style={styles.label}>{t('admin.bcPushTitle')}</Text>
          <TextInput
            style={styles.input}
            value={pushTitle}
            onChangeText={setPushTitle}
            placeholder={t('admin.bcPushTitlePh')}
            placeholderTextColor={colors.textSecondary}
            maxLength={100}
          />

          <Text style={styles.label}>{t('admin.bcPushContent')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={pushBody}
            onChangeText={setPushBody}
            placeholder={t('admin.bcPushContentPh')}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            onPress={sendPush}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color={colors.white} size="small" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="paper-plane" size={18} color={colors.white} />
                  <Text style={styles.sendBtnText}>{t('admin.bcPushSend')}</Text>
                </View>
              )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  formCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingVertical: 2,
  },
  optInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.inputBg, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary + '10', borderRadius: 14,
    paddingVertical: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.primary + '25', borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  noticeCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14,
    marginBottom: 8, overflow: 'hidden',
  },
  noticeContent: { flex: 1, padding: 14 },
  noticeTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  pinBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  noticeDate: { fontSize: 11, color: colors.textSecondary },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  noticePreview: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  noticeActions: {
    justifyContent: 'center', paddingHorizontal: 8, gap: 8,
    borderLeftWidth: 1, borderLeftColor: colors.border,
  },
  noticeActionBtn: { padding: 6 },
  emptyBox: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  infoCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#3B82F6' + '12', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  sendBtn: {
    marginTop: 24, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  sendBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
