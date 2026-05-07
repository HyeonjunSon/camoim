import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import {
  getGroupMembers, kickGroupMember, setGroupMemberRole, transferGroupOwner,
} from '../../lib/api';

export default function GroupMembersScreen({ route, navigation }) {
  const { groupId, isOwner, isManager } = route.params || {};
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionTarget, setActionTarget] = useState(null);

  const canManage = isOwner || isManager;

  const load = useCallback(async () => {
    try {
      const res = await getGroupMembers(groupId);
      if (res.success) setMembers(res.data || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const roleLabel = (role) => t(`group.role_${role}`);
  const roleColor = (role) =>
    role === 'owner' ? '#F59E0B' : role === 'manager' ? '#3B82F6' : colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.list}>
          {members.map((m, idx) => (
            <View key={String(m.id)}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={canManage && m.role !== 'owner' ? 0.7 : 1}
                onPress={() => canManage && m.role !== 'owner' ? setActionTarget(m) : null}
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
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
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
});
