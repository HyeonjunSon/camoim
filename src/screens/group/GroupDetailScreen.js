import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import {
  getGroup, joinGroup, leaveGroup, closeGroup,
} from '../../lib/api';

const CATEGORY_LABEL = {
  hobby: 'group.catHobby', study: 'group.catStudy', local: 'group.catLocal',
  job: 'group.catJob', workinghol: 'group.catWorkinghol', general: 'group.catGeneral',
};

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params || {};
  const { colors } = useTheme();
  const { t } = useLang();
  const { user } = useAuth();
  const styles = createStyles(colors);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getGroup(groupId);
      if (res.success) setGroup(res.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onJoin = async () => {
    setBusy(true);
    try {
      const res = await joinGroup(groupId);
      if (res.success) load();
      else Alert.alert('', res.message || t('common.serverError'));
    } catch (e) {
      Alert.alert('', e?.message || t('common.serverError'));
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    Alert.alert('', t('group.leaveConfirm'), [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: t('group.leave'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await leaveGroup(groupId);
            if (res.success) {
              Alert.alert('', t('group.leaveOk'));
              load();
            } else if (res.message?.includes('그룹장') || /owner/i.test(res.message || '')) {
              Alert.alert('', t('group.ownerCantLeave'));
            } else {
              Alert.alert('', res.message || t('common.serverError'));
            }
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onClose = () => {
    Alert.alert('', t('group.closeConfirm'), [
      { text: t('common.cancel') || '취소', style: 'cancel' },
      {
        text: t('group.closeGroup'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await closeGroup(groupId);
            if (res.success) {
              Alert.alert('', t('group.closeOk'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } else {
              Alert.alert('', res.message || t('common.serverError'));
            }
          } catch (e) {
            Alert.alert('', e?.message || t('common.serverError'));
          } finally {
            setBusy(false);
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
  if (!group) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>{t('common.serverError')}</Text>
      </View>
    );
  }

  const my = group.myMembership;
  const isOwner = my?.role === 'owner';
  const isManager = my?.role === 'manager';
  const isMember = my?.status === 'active';
  const isPendingMember = my?.status === 'pending';
  const isBanned = my?.status === 'banned';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* 커버 + 헤더 */}
      <View style={styles.header}>
        {group.coverImage ? (
          <Image source={{ uri: group.coverImage }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 56 }}>👥</Text>
          </View>
        )}
        <View style={styles.headerBody}>
          <Text style={styles.name}>{group.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>{t(CATEGORY_LABEL[group.category] || 'group.catGeneral')}</Text>
            </View>
            {!!group.city && (
              <View style={styles.metaTag}>
                <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaTagText}>{group.city}</Text>
              </View>
            )}
            <View style={styles.metaTag}>
              <Ionicons name="people-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.metaTagText}>{group.memberCount} {t('group.member')}</Text>
            </View>
          </View>
          {!!group.description && <Text style={styles.desc}>{group.description}</Text>}

          {group.status === 'pending_review' && (
            <View style={[styles.statusBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statusText, { color: '#92400E' }]}>⏳ {t('group.statusPending')}</Text>
            </View>
          )}
          {group.status === 'rejected' && (
            <View style={[styles.statusBox, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.statusText, { color: '#991B1B' }]}>{t('group.statusRejected')}</Text>
              {!!group.rejectReason && (
                <Text style={[styles.statusSub, { color: '#991B1B' }]}>{t('group.rejectReason')}: {group.rejectReason}</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actions}>
        {!my && group.status === 'active' && !isBanned && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={onJoin}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {group.joinPolicy === 'approval' ? t('group.joinApproval') : t('group.joinOpen')}
            </Text>
          </TouchableOpacity>
        )}
        {isPendingMember && (
          <View style={[styles.actionBtn, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ color: '#92400E', fontWeight: '700' }}>⏳ {t('group.pending')}</Text>
          </View>
        )}
        {isMember && !isOwner && (
          <TouchableOpacity style={[styles.actionBtn, styles.outlineBtn]} onPress={onLeave} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.outlineBtnText}>{t('group.leave')}</Text>
          </TouchableOpacity>
        )}
        {(isOwner || isManager) && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.outlineBtn]}
            onPress={() => navigation.navigate('GroupMembers', { groupId, isOwner, isManager })}
            activeOpacity={0.85}
          >
            <Ionicons name="people" size={16} color={colors.text} />
            <Text style={styles.outlineBtnText}>{t('group.manageMembers')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 멤버 보기 (모든 가입자) */}
      {isMember && (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('GroupMembers', { groupId, isOwner, isManager })}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={18} color={colors.text} />
          <Text style={styles.linkText}>{t('group.tabMembers')}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.linkCount}>{group.memberCount}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* 소유자 폐쇄 */}
      {isOwner && (
        <TouchableOpacity style={styles.dangerBtn} onPress={onClose} disabled={busy} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.dangerText}>{t('group.closeGroup')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, marginBottom: 12 },
  cover: { width: '100%', height: 180 },
  headerBody: { padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.inputBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  metaTagText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  desc: { fontSize: 14, color: colors.text, marginTop: 12, lineHeight: 21 },
  statusBox: { marginTop: 12, padding: 10, borderRadius: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusSub: { fontSize: 12, marginTop: 4 },

  actions: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  actionBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  primaryBtn: { backgroundColor: colors.primary },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  outlineBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  outlineBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12,
  },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.text },
  linkCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 12, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.danger + '50',
  },
  dangerText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
