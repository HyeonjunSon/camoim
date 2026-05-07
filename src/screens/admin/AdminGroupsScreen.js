import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  StyleSheet, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import {
  adminGetGroups, adminApproveGroup, adminRejectGroup, adminCloseGroup,
} from '../../lib/api';

const TABS = [
  { key: 'pending_review', labelKey: 'group.statusPending' },
  { key: 'active', labelKey: 'group.statusActive' },
  { key: 'rejected', labelKey: 'group.statusRejected' },
];

const CATEGORY_LABEL = {
  hobby: 'group.catHobby', study: 'group.catStudy', local: 'group.catLocal',
  job: 'group.catJob', workinghol: 'group.catWorkinghol', general: 'group.catGeneral',
};

export default function AdminGroupsScreen() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [tab, setTab] = useState('pending_review');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminGetGroups(tab);
      if (res.success) setList(res.data || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onApprove = (g) => {
    Alert.alert('', `'${g.name}' 모임을 승인하시겠어요?`, [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: '승인',
        onPress: async () => {
          try {
            const res = await adminApproveGroup(g.id);
            if (res.success) load();
            else Alert.alert('', res.message || t('common.serverError'));
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          }
        },
      },
    ]);
  };

  const onReject = async () => {
    if (!rejectTarget) return;
    try {
      const res = await adminRejectGroup(rejectTarget.id, rejectReason);
      if (res.success) {
        setRejectTarget(null);
        setRejectReason('');
        load();
      } else {
        Alert.alert('', res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    }
  };

  const onClose = (g) => {
    Alert.alert('', `'${g.name}' 모임을 폐쇄하시겠어요? 모든 글과 멤버가 삭제됩니다.`, [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: t('group.closeGroup'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await adminCloseGroup(g.id);
            if (res.success) load();
            else Alert.alert('', res.message || t('common.serverError'));
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 탭 */}
      <View style={styles.tabBar}>
        {TABS.map(tb => {
          const active = tab === tb.key;
          return (
            <TouchableOpacity
              key={tb.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(tb.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>대기 중인 항목이 없어요.</Text>
            </View>
          ) : (
            list.map(g => (
              <View key={String(g.id)} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name}>{g.name}</Text>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{t(CATEGORY_LABEL[g.category] || 'group.catGeneral')}</Text>
                  </View>
                </View>
                {!!g.description && (
                  <Text style={styles.desc} numberOfLines={3}>{g.description}</Text>
                )}
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {g.ownerId?.nickname || '—'} ({g.ownerId?.email || '—'})
                  </Text>
                </View>
                {!!g.city && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{g.city}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{new Date(g.createdAt).toLocaleString()}</Text>
                </View>

                {tab === 'pending_review' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => onApprove(g)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionTextWhite}>승인</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => { setRejectTarget(g); setRejectReason(''); }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.actionTextWhite, { color: colors.danger }]}>거절</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {tab === 'active' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.dangerBtn]}
                      onPress={() => onClose(g)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionTextWhite}>{t('group.closeGroup')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {tab === 'rejected' && !!g.rejectReason && (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectLabel}>{t('group.rejectReason')}</Text>
                    <Text style={styles.rejectText}>{g.rejectReason}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* 거절 모달 */}
      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>거절 사유</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="거절 사유를 입력하세요 (선택)"
              placeholderTextColor={colors.textSecondary}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectTarget(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={onReject}>
                <Text style={styles.modalConfirmText}>거절</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface, marginHorizontal: 14, marginTop: 10,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  tag: { backgroundColor: colors.inputBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  desc: { fontSize: 13, color: colors.text, lineHeight: 19, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '40' },
  dangerBtn: { backgroundColor: colors.danger },
  actionTextWhite: { color: colors.white, fontSize: 14, fontWeight: '700' },
  rejectBox: { backgroundColor: colors.inputBg, padding: 10, borderRadius: 8, marginTop: 8 },
  rejectLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  rejectText: { fontSize: 13, color: colors.text },

  modalOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 400, backgroundColor: colors.surface,
    borderRadius: 14, padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  modalInput: {
    backgroundColor: colors.inputBg, borderRadius: 10, padding: 12,
    fontSize: 14, color: colors.text, minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1, borderColor: colors.border,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: '700' },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center' },
  modalConfirmText: { color: colors.white, fontWeight: '700' },
});
