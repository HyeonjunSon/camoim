import { useState, useCallback, useLayoutEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import {
  getGroupMembers, kickGroupMember, setGroupMemberRole, transferGroupOwner,
  approveGroupMember, rejectGroupMember,
} from '../../lib/api';

export default function GroupMembersScreen({ route, navigation }) {
  const { groupId, isOwner, isManager } = route.params || {};
  const { colors } = useTheme();
  const { t } = useLang();
  const { user: me } = useAuth();
  const styles = createStyles(colors);

  // 자기 자신을 탭하면 마이페이지 탭으로, 아니면 그 멤버 프로필로
  const goToMember = (memberId) => {
    if (me?.id && String(memberId) === String(me.id)) {
      navigation.getParent()?.navigate('MyPage');
    } else {
      navigation.push('UserProfile', { userId: memberId });
    }
  };

  const [tab, setTab] = useState('active'); // active | pending
  const [members, setMembers] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionTarget, setActionTarget] = useState(null);

  const canManage = isOwner || isManager;

  const load = useCallback(async () => {
    try {
      const res = await getGroupMembers(groupId, tab);
      if (res.success) setMembers(res.data || []);
      // pending 카운트 (관리자만)
      if (canManage) {
        try {
          const pr = await getGroupMembers(groupId, 'pending');
          if (pr.success) setPendingCount(pr.data?.length || 0);
        } catch {}
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, tab, canManage]);

  // 탭 변경 시 즉시 옛 데이터 비우고 로딩 표시 — stale 데이터가 새 탭 UI에 잠깐
  // 렌더되는 깜빡임 방지
  const switchTab = (next) => {
    if (next === tab) return;
    setMembers([]);
    setLoading(true);
    setTab(next);
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onKick = (userId, ban = false) => {
    Alert.alert('', ban ? t('group.banConfirm') : t('group.kickConfirm'), [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: ban ? t('group.ban') : t('group.kick'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await kickGroupMember(groupId, userId, { ban });
            if (res.success) {
              Alert.alert('', ban ? t('group.banOk') : t('group.kickOk'));
              setActionTarget(null);
              load();
            } else {
              Alert.alert('', res.message || t('common.serverError'));
            }
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          }
        },
      },
    ]);
  };

  const onRoleChange = async (userId, role) => {
    try {
      const res = await setGroupMemberRole(groupId, userId, role);
      if (res.success) {
        setActionTarget(null);
        load();
      } else {
        Alert.alert('', res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    }
  };

  const onApprovePending = async (userId) => {
    try {
      const res = await approveGroupMember(groupId, userId);
      if (res.success) load();
      else Alert.alert('', res.message || t('common.serverError'));
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    }
  };

  const onRejectPending = (userId) => {
    Alert.alert('', '가입 신청을 거절하시겠어요?', [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: '거절',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await rejectGroupMember(groupId, userId);
            if (res.success) load();
            else Alert.alert('', res.message || t('common.serverError'));
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          }
        },
      },
    ]);
  };

  const onTransfer = (userId, nickname) => {
    Alert.alert('', `${nickname}${t('group.transferAsk')}`, [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: t('group.transferOwner'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await transferGroupOwner(groupId, userId);
            if (res.success) {
              Alert.alert('', t('group.transferOk'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
              setActionTarget(null);
            } else {
              Alert.alert('', res.message || t('common.serverError'));
            }
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CustomHeader navigation={navigation} title={t('nav.groupMembers')} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const roleLabel = (role) => t(`group.role_${role}`);
  const roleColor = (role) =>
    role === 'owner' ? '#F59E0B' : role === 'manager' ? '#3B82F6' : colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CustomHeader navigation={navigation} title={t('nav.groupMembers')} />
      {canManage && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'active' && styles.tabActive]}
            onPress={() => switchTab('active')}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>활성 멤버</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'pending' && styles.tabActive]}
            onPress={() => switchTab('pending')}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
              승인 대기{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {members.length === 0 && tab === 'pending' && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>승인 대기 중인 멤버가 없어요.</Text>
          </View>
        )}
        <View style={styles.list}>
          {members.map((m, idx) => (
            <View key={String(m.id)}>
              {tab === 'pending' ? (
                <View style={styles.row}>
                  {m.avatarUrl ? (
                    <Image source={{ uri: m.avatarUrl }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{m.nickname || '—'}</Text>
                      {m.verified && <Ionicons name="checkmark-circle" size={13} color={colors.primary} />}
                    </View>
                    <Text style={styles.role}>가입 신청</Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={[styles.pendingBtn, { backgroundColor: colors.primary }]}
                      onPress={() => onApprovePending(m.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pendingBtnText}>승인</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pendingBtn, styles.pendingBtnReject]}
                      onPress={() => onRejectPending(m.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.pendingBtnText, { color: colors.danger }]}>거절</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => goToMember(m.id)}
                >
                  {m.avatarUrl ? (
                    <Image source={{ uri: m.avatarUrl }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{m.nickname || '—'}</Text>
                      {m.verified && <Ionicons name="checkmark-circle" size={13} color={colors.primary} />}
                    </View>
                    <Text style={[styles.role, { color: roleColor(m.role) }]}>
                      {roleLabel(m.role)}
                    </Text>
                  </View>
                  {canManage && m.role !== 'owner' && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); setActionTarget(m); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.moreBtn}
                      accessibilityRole="button"
                      accessibilityLabel="멤버 관리"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )}
              {idx < members.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 액션 시트 */}
      <Modal
        visible={!!actionTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setActionTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setActionTarget(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{actionTarget?.nickname}</Text>

            {isOwner && actionTarget?.role === 'member' && (
              <TouchableOpacity style={styles.sheetItem} onPress={() => onRoleChange(actionTarget.id, 'manager')}>
                <Ionicons name="arrow-up-circle" size={20} color={colors.primary} />
                <Text style={styles.sheetItemText}>{t('group.promoteManager')}</Text>
              </TouchableOpacity>
            )}
            {isOwner && actionTarget?.role === 'manager' && (
              <TouchableOpacity style={styles.sheetItem} onPress={() => onRoleChange(actionTarget.id, 'member')}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.text} />
                <Text style={styles.sheetItemText}>{t('group.demoteMember')}</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity style={styles.sheetItem} onPress={() => onTransfer(actionTarget.id, actionTarget.nickname)}>
                <Ionicons name="swap-horizontal" size={20} color="#F59E0B" />
                <Text style={styles.sheetItemText}>{t('group.transferOwner')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.sheetItem} onPress={() => onKick(actionTarget.id, false)}>
              <Ionicons name="exit-outline" size={20} color={colors.danger} />
              <Text style={[styles.sheetItemText, { color: colors.danger }]}>{t('group.kick')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => onKick(actionTarget.id, true)}>
              <Ionicons name="ban-outline" size={20} color={colors.danger} />
              <Text style={[styles.sheetItemText, { color: colors.danger }]}>{t('group.ban')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setActionTarget(null)}>
              <Text style={styles.cancelText}>{t('common.cancel') || '취소'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { backgroundColor: colors.surface, marginTop: 10, marginHorizontal: 14, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  role: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30, paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 14, fontWeight: '700', color: colors.text, paddingHorizontal: 20, marginBottom: 8 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetItemText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  cancelBtn: {
    marginTop: 8, marginHorizontal: 20, paddingVertical: 14, alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },

  moreBtn: { padding: 4 },
  pendingActions: { flexDirection: 'row', gap: 6 },
  pendingBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  pendingBtnReject: { backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '40' },
  pendingBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
