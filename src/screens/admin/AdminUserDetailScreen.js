import { useState, useEffect, useCallback } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import {
  adminGetUser, adminSanctionUser, adminSetUserRole, adminDeleteUser, adminEditUserProfile,
} from '../../lib/api';

const ROLES = ['admin', 'student', 'working_holiday', 'general'];

export default function AdminUserDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { userId } = route.params;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sanctionModal, setSanctionModal] = useState(false);
  const [sanctionType, setSanctionType] = useState('suspend');
  const [sanctionDays, setSanctionDays] = useState('7');
  const [sanctionReason, setSanctionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetUser(userId);
      if (res.success) setUser(res.data);
    } catch {} finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const applySanction = async () => {
    try {
      await adminSanctionUser(userId, {
        type: sanctionType,
        days: Number(sanctionDays) || 0,
        reason: sanctionReason,
      });
      setSanctionModal(false);
      setSanctionReason('');
      load();
      Alert.alert('완료', '제재가 적용되었습니다');
    } catch (e) {
      Alert.alert('실패', e.message || '오류');
    }
  };

  const changeRole = (role) => {
    Alert.alert('역할 변경', `${role}로 변경할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '변경',
        onPress: async () => {
          try {
            await adminSetUserRole(userId, role);
            load();
          } catch (e) {
            Alert.alert('실패', e.message || '오류');
          }
        },
      },
    ]);
  };

  const forceDelete = () => {
    Alert.alert('강제 탈퇴', '이 유저를 강제 탈퇴시킬까요? (복구 불가)', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminDeleteUser(userId, '관리자 강제 탈퇴');
            navigation.goBack();
          } catch (e) {
            Alert.alert('실패', e.message || '오류');
          }
        },
      },
    ]);
  };

  if (loading || !user) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  const Field = ({ label, value }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '-'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.nick}>{user.nickname}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.statusBadge, statusStyle(user.status)]}>{user.status}</Text>
          <Text style={styles.roleBadge}>{user.role}</Text>
          {user.shadowBanned && <Text style={[styles.statusBadge, { backgroundColor: '#6B7280', color: '#fff' }]}>SHADOW</Text>}
        </View>
      </View>

      {/* 통계 */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user.stats?.postCount ?? 0}</Text>
          <Text style={styles.statLabel}>게시글</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user.stats?.commentCount ?? 0}</Text>
          <Text style={styles.statLabel}>댓글</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user.stats?.reportedCount ?? 0}</Text>
          <Text style={styles.statLabel}>피신고</Text>
        </View>
      </View>

      {/* 정보 */}
      <Text style={styles.section}>정보</Text>
      <View style={styles.card}>
        <Field label="가입일" value={new Date(user.createdAt).toLocaleString()} />
        <Field label="도시" value={user.city} />
        <Field label="학교" value={user.university} />
        <Field label="자기소개" value={user.bio} />
        <Field label="경고 횟수" value={String(user.warningCount ?? 0)} />
        {user.suspendedUntil && <Field label="정지 해제일" value={new Date(user.suspendedUntil).toLocaleString()} />}
        {user.suspendReason ? <Field label="제재 사유" value={user.suspendReason} /> : null}
      </View>

      {/* 제재 */}
      <Text style={styles.section}>제재</Text>
      <View style={styles.card}>
        <ActionBtn styles={styles} label="경고" onPress={() => { setSanctionType('warn'); setSanctionModal(true); }} />
        <ActionBtn styles={styles} label="일시 정지" onPress={() => { setSanctionType('suspend'); setSanctionModal(true); }} />
        <ActionBtn styles={styles} label="영구 차단" onPress={() => { setSanctionType('ban'); setSanctionModal(true); }} danger />
        <ActionBtn styles={styles} label="제재 해제" onPress={() => { setSanctionType('unban'); setSanctionModal(true); }} />
        <ActionBtn styles={styles}
          label={user.shadowBanned ? '쉐도우 해제' : '쉐도우 밴'}
          onPress={() => {
            adminSanctionUser(userId, { type: user.shadowBanned ? 'unshadow' : 'shadow' })
              .then(load).catch(() => {});
          }}
        />
      </View>

      {/* 역할 */}
      <Text style={styles.section}>역할 변경</Text>
      <View style={styles.card}>
        {ROLES.map(r => (
          <ActionBtn
            key={r}
            styles={styles}
            label={r + (user.role === r ? '  ✓' : '')}
            onPress={() => changeRole(r)}
            disabled={user.role === r}
          />
        ))}
      </View>

      {/* 위험 */}
      <Text style={styles.section}>⚠️ 위험</Text>
      <View style={styles.card}>
        <ActionBtn styles={styles} label="강제 탈퇴" onPress={forceDelete} danger />
      </View>

      {/* 제재 모달 */}
      <Modal visible={sanctionModal} transparent animationType="fade" onRequestClose={() => setSanctionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>제재: {sanctionType}</Text>
            {sanctionType === 'suspend' && (
              <>
                <Text style={styles.modalLabel}>기간 (일, 0=무기한)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={sanctionDays}
                  onChangeText={setSanctionDays}
                  keyboardType="number-pad"
                />
              </>
            )}
            {sanctionType !== 'unban' && (
              <>
                <Text style={styles.modalLabel}>사유</Text>
                <TextInput
                  style={[styles.modalInput, { height: 80 }]}
                  value={sanctionReason}
                  onChangeText={setSanctionReason}
                  multiline
                  placeholder="제재 사유를 입력하세요"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSanctionModal(false)}>
                <Text style={{ color: colors.textSecondary }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applySanction}>
                <Text style={{ color: colors.white, fontWeight: '700' }}>적용</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function ActionBtn({ label, onPress, danger, disabled, styles }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, danger && styles.actionBtnDanger, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.actionText, danger && { color: '#EF4444' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusStyle(status) {
  const map = {
    active: { backgroundColor: '#10B981' + '18', color: '#2D9E5A' },
    suspended: { backgroundColor: '#F59E0B' + '18', color: '#F59E0B' },
    banned: { backgroundColor: colors.danger + '15', color: '#EF4444' },
    deleted: { backgroundColor: colors.inputBg, color: '#9CA3AF' },
  };
  return map[status] || map.active;
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, padding: 20 },
  nick: { fontSize: 22, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  statusBadge: {
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    overflow: 'hidden',
  },
  roleBadge: {
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: colors.primary + '15', color: colors.primary,
  },

  statRow: { flexDirection: 'row', padding: 12, gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, padding: 14, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  section: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 8, marginLeft: 22,
  },
  card: { backgroundColor: colors.surface, marginHorizontal: 12, borderRadius: 12, overflow: 'hidden' },
  field: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  fieldLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  fieldValue: { fontSize: 14, color: colors.text, marginTop: 4 },

  actionBtn: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionBtnDanger: {},
  actionText: { fontSize: 14, fontWeight: '600', color: colors.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: colors.surface, borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  modalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  modalInput: {
    backgroundColor: colors.inputBg, borderRadius: 10, padding: 12,
    fontSize: 14, color: colors.text,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: 'center' },
  applyBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
});
